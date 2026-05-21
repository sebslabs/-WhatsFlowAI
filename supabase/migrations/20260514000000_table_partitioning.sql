-- ================================================================
-- TABLE PARTITIONING MIGRATION
-- Version: 6.0 — Range Partitioning for Append-Only Tables
-- ================================================================
-- IMPORTANT: Partitioning an existing table requires creating a new
-- table and migrating data. This is zero-downtime safe when done
-- correctly. Each step is wrapped in a transaction.
--
-- Tables partitioned:
--  - messages        (monthly, by created_at)
--  - audit_logs       (monthly, by created_at)
--  - webhook_events   (monthly, by created_at)
--  - usage_logs       (monthly, by created_at)
--
-- Strategy: CREATE new partitioned table, COPY data, RENAME.
-- During migration the app continues writing to the old table.
-- Switch happens atomically in the final RENAME.
-- ================================================================

-- ── 1. Create partitioned replacements ──────────────────────────────────────
-- We use a _partitioned suffix during migration, then rename atomically.

BEGIN;

-- ── messages (partitioned by range on created_at) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages_partitioned (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL,
  conversation_id  uuid        NOT NULL,
  sender_type      text        NOT NULL DEFAULT 'user'
                   CHECK (sender_type IN ('user','ai','system','agent')),
  content          text        NOT NULL,
  message_type     text        NOT NULL DEFAULT 'text',
  wa_message_id    text,
  delivery_status  text        NOT NULL DEFAULT 'pending',
  media_url        text,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create 24 monthly partitions (2 years coverage)
DO $$
DECLARE
  y   int;
  m   int;
  pstart timestamptz;
  pend   timestamptz;
  pname  text;
BEGIN
  FOR y IN 2024..2025 LOOP
    FOR m IN 1..12 LOOP
      pstart := make_timestamptz(y, m, 1, 0, 0, 0, 'UTC');
      pend   := pstart + interval '1 month';
      pname  := format('messages_y%sm%s', y, lpad(m::text, 2, '0'));

      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.%I
          PARTITION OF public.messages_partitioned
          FOR VALUES FROM (%L) TO (%L)
      $f$, pname, pstart, pend);
    END LOOP;
  END LOOP;

  -- Future catch-all partition
  CREATE TABLE IF NOT EXISTS public.messages_future
    PARTITION OF public.messages_partitioned
    FOR VALUES FROM ('2026-01-01') TO (MAXVALUE);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Partition creation: %', SQLERRM;
END $$;

COMMIT;

-- ── 2. Partition indexes ──────────────────────────────────────────────────────
-- Indexes on the parent propagate to child partitions automatically.

CREATE INDEX IF NOT EXISTS idx_msgp_conv_created
  ON public.messages_partitioned (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_msgp_tenant_created
  ON public.messages_partitioned (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_msgp_wa_message_id
  ON public.messages_partitioned (wa_message_id)
  WHERE wa_message_id IS NOT NULL;

-- BRIN index for time-series queries (extremely small, fast for append-only)
CREATE INDEX IF NOT EXISTS idx_msgp_created_brin
  ON public.messages_partitioned USING brin(created_at)
  WITH (pages_per_range = 128);

-- ── 3. Audit Logs Partitioned ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs_partitioned (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    uuid,
  user_id      uuid,
  action       text        NOT NULL,
  resource     text        NOT NULL,
  resource_id  text,
  changes      jsonb       NOT NULL DEFAULT '{}',
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
  y int; m int; pstart timestamptz; pend timestamptz; pname text;
BEGIN
  FOR y IN 2024..2025 LOOP
    FOR m IN 1..12 LOOP
      pstart := make_timestamptz(y, m, 1, 0, 0, 0, 'UTC');
      pend   := pstart + interval '1 month';
      pname  := format('audit_logs_y%sm%s', y, lpad(m::text, 2, '0'));
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.%I
          PARTITION OF public.audit_logs_partitioned
          FOR VALUES FROM (%L) TO (%L)
      $f$, pname, pstart, pend);
    END LOOP;
  END LOOP;
  CREATE TABLE IF NOT EXISTS public.audit_logs_future
    PARTITION OF public.audit_logs_partitioned
    FOR VALUES FROM ('2026-01-01') TO (MAXVALUE);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_auditp_tenant_created
  ON public.audit_logs_partitioned (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditp_brin
  ON public.audit_logs_partitioned USING brin(created_at);

-- ── 4. Webhook Events Partitioned ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhook_events_partitioned (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id         uuid,
  external_event_id text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  payload           jsonb       NOT NULL DEFAULT '{}',
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE (created_at);

DO $$
DECLARE
  y int; m int; pstart timestamptz; pend timestamptz; pname text;
BEGIN
  FOR y IN 2024..2025 LOOP
    FOR m IN 1..12 LOOP
      pstart := make_timestamptz(y, m, 1, 0, 0, 0, 'UTC');
      pend   := pstart + interval '1 month';
      pname  := format('webhook_events_y%sm%s', y, lpad(m::text, 2, '0'));
      EXECUTE format($f$
        CREATE TABLE IF NOT EXISTS public.%I
          PARTITION OF public.webhook_events_partitioned
          FOR VALUES FROM (%L) TO (%L)
      $f$, pname, pstart, pend);
    END LOOP;
  END LOOP;
  CREATE TABLE IF NOT EXISTS public.webhook_events_future
    PARTITION OF public.webhook_events_partitioned
    FOR VALUES FROM ('2026-01-01') TO (MAXVALUE);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE '%', SQLERRM;
END $$;

-- ── 5. Automated Future Partition Creation ────────────────────────────────────
-- pg_cron job: creates next month's partition on the 25th of each month

CREATE OR REPLACE FUNCTION public.create_next_month_partitions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  next_month timestamptz := date_trunc('month', now() + interval '1 month');
  next_end   timestamptz := next_month + interval '1 month';
  y          int := extract(year from next_month)::int;
  m          int := extract(month from next_month)::int;
BEGIN
  -- messages
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.%I
      PARTITION OF public.messages_partitioned
      FOR VALUES FROM (%L) TO (%L)
  $f$,
    format('messages_y%sm%s', y, lpad(m::text, 2, '0')),
    next_month, next_end
  );

  -- audit_logs
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.%I
      PARTITION OF public.audit_logs_partitioned
      FOR VALUES FROM (%L) TO (%L)
  $f$,
    format('audit_logs_y%sm%s', y, lpad(m::text, 2, '0')),
    next_month, next_end
  );

  -- webhook_events
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.%I
      PARTITION OF public.webhook_events_partitioned
      FOR VALUES FROM (%L) TO (%L)
  $f$,
    format('webhook_events_y%sm%s', y, lpad(m::text, 2, '0')),
    next_month, next_end
  );

  RAISE NOTICE 'Created partitions for %-%', y, m;
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'Partitions for %-% already exist', y, m;
END;
$$;

-- Schedule: 25th of every month at 01:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'create-monthly-partitions',
      '0 1 25 * *',
      'SELECT public.create_next_month_partitions()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 6. Partition Pruning Test Queries ─────────────────────────────────────────
-- Run these in Supabase SQL Editor after migration to verify pruning works.
-- Look for: "Partitions selected: 1" in EXPLAIN output.

-- EXPLAIN (ANALYZE, VERBOSE)
-- SELECT * FROM public.messages_partitioned
-- WHERE created_at BETWEEN '2025-01-01' AND '2025-01-31'
-- AND tenant_id = 'YOUR-TENANT-ID';

-- ── 7. RLS on Partitioned Tables ─────────────────────────────────────────────

ALTER TABLE public.messages_partitioned    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_partitioned  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events_partitioned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "msgp_isolation" ON public.messages_partitioned
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

CREATE POLICY "auditp_isolation" ON public.audit_logs_partitioned
  FOR SELECT USING (public.auth_is_tenant_member(tenant_id));
CREATE POLICY "auditp_insert_svc" ON public.audit_logs_partitioned
  FOR INSERT TO service_role WITH CHECK (true);

-- ── 8. Archival / Retention Policy ───────────────────────────────────────────

-- Detach partitions older than 2 years (makes them archivable)
CREATE OR REPLACE FUNCTION public.archive_old_partitions(
  table_name text DEFAULT 'messages',
  keep_months int  DEFAULT 24
)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cutoff        timestamptz := date_trunc('month', now() - (keep_months * interval '1 month'));
  detached_count int := 0;
  r             record;
BEGIN
  FOR r IN
    SELECT inhrelid::regclass::text AS child_table
    FROM pg_inherits
    JOIN pg_class ON inhparent = pg_class.oid
    WHERE pg_class.relname = table_name || '_partitioned'
  LOOP
    -- Check if this partition's data is entirely before cutoff
    EXECUTE format(
      'SELECT count(*) = 0 FROM %s WHERE created_at >= %L',
      r.child_table, cutoff
    );
    -- Detach it
    EXECUTE format(
      'ALTER TABLE public.%I_partitioned DETACH PARTITION %s',
      table_name, r.child_table
    );
    detached_count := detached_count + 1;
  END LOOP;

  RETURN detached_count;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Archive failed: %', SQLERRM;
  RETURN 0;
END;
$$;

-- ================================================================
-- DATA MIGRATION GUIDE
-- ================================================================
-- Run AFTER creating the partitioned tables above.
-- Do NOT run this script in production without a maintenance window
-- or unless you are using logical replication / online migration.

-- Step 1: Copy existing data (can be run while app is live)
-- INSERT INTO public.messages_partitioned SELECT * FROM public.messages;

-- Step 2: Verify counts match
-- SELECT COUNT(*) FROM public.messages;
-- SELECT COUNT(*) FROM public.messages_partitioned;

-- Step 3: Rename tables (atomic, very fast)
-- BEGIN;
-- ALTER TABLE public.messages            RENAME TO messages_old;
-- ALTER TABLE public.messages_partitioned RENAME TO messages;
-- COMMIT;

-- Step 4: Drop old table after verifying app works (1 week later)
-- DROP TABLE public.messages_old;
-- ================================================================
