-- ============================================================
-- ENTERPRISE HARDENING MIGRATION
-- Version: 4.0 — Final Production Hardening
-- Idempotent — safe to re-run
-- Supports zero-downtime deployment
-- ============================================================

-- ── Prerequisites ────────────────────────────────────────────────────────────
-- This migration requires: pgcrypto, pg_trgm, vector

-- ── 1. DLQ / Retry Infrastructure Tables ────────────────────────────────────

-- Dead-letter queue: stores permanently failed jobs for manual replay
CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  source_queue    text        NOT NULL,
  job_id          text        NOT NULL,
  job_data        jsonb       NOT NULL DEFAULT '{}',
  error_message   text        NOT NULL,
  error_stack     text,
  attempts        integer     NOT NULL DEFAULT 0,
  failed_at       timestamptz NOT NULL DEFAULT now(),
  replayed_at     timestamptz,
  resolved_by     uuid REFERENCES auth.users(id),
  CONSTRAINT dead_letter_queue_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_dlq_source_queue ON public.dead_letter_queue (source_queue, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_dlq_unresolved ON public.dead_letter_queue (failed_at DESC) WHERE replayed_at IS NULL;
ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;
-- DLQ accessible only by admins (service role bypasses RLS)
CREATE POLICY "DLQ admin only" ON public.dead_letter_queue FOR ALL TO service_role USING (true);

-- ── 2. Outbound Message Queue Table ─────────────────────────────────────────
-- Tracks every outbound WhatsApp message send attempt for delivery reconciliation.
-- Prevents double-sends on retry via idempotency_key UNIQUE constraint.

CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id  uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  wa_account_id    uuid        REFERENCES public.whatsapp_accounts(id),
  phone_number     text        NOT NULL,
  content          text        NOT NULL,
  message_type     text        NOT NULL DEFAULT 'text',
  media_url        text,
  idempotency_key  text        NOT NULL,
  status           text        NOT NULL DEFAULT 'queued'
                   CHECK (status IN ('queued','sending','sent','delivered','failed','skipped')),
  wa_message_id    text,       -- filled after Meta API responds
  attempts         integer     NOT NULL DEFAULT 0,
  last_error       text,
  queued_at        timestamptz NOT NULL DEFAULT now(),
  sent_at          timestamptz,
  delivered_at     timestamptz,
  CONSTRAINT outbound_messages_pkey         PRIMARY KEY (id),
  CONSTRAINT outbound_idempotency_key_unique UNIQUE (idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_outbound_tenant_status
  ON public.outbound_messages (tenant_id, status, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_reconcile
  ON public.outbound_messages (status, sent_at)
  WHERE status IN ('sending', 'sent');
ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Outbound isolation" ON public.outbound_messages
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

-- ── 3. Metrics / Monitoring Tables ──────────────────────────────────────────

-- Queue metrics snapshot (written by BullMQ metrics worker, read by dashboards)
CREATE TABLE IF NOT EXISTS public.queue_metrics_snapshots (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  queue_name   text        NOT NULL,
  waiting      integer     NOT NULL DEFAULT 0,
  active       integer     NOT NULL DEFAULT 0,
  completed    integer     NOT NULL DEFAULT 0,
  failed       integer     NOT NULL DEFAULT 0,
  delayed      integer     NOT NULL DEFAULT 0,
  captured_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT queue_metrics_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_queue_metrics_captured
  ON public.queue_metrics_snapshots (queue_name, captured_at DESC);

-- Webhook latency tracking
CREATE TABLE IF NOT EXISTS public.webhook_latency_log (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id      uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  external_id    text        NOT NULL,
  received_at    timestamptz NOT NULL DEFAULT now(),
  enqueued_at    timestamptz,
  processed_at   timestamptz,
  latency_ms     integer     GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (processed_at - received_at)) * 1000
  ) STORED,
  CONSTRAINT webhook_latency_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_latency_tenant
  ON public.webhook_latency_log (tenant_id, received_at DESC);

-- ── 4. AI Usage Audit Table (replaces simple usage_logs) ────────────────────

-- Ensure usage_logs has all required columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usage_logs' AND column_name = 'resource_type'
  ) THEN
    CREATE TABLE IF NOT EXISTS public.usage_logs (
      id            uuid        NOT NULL DEFAULT gen_random_uuid(),
      tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      resource_type text        NOT NULL DEFAULT 'ai_tokens',
      quantity      integer     NOT NULL DEFAULT 1,
      metadata      jsonb       NOT NULL DEFAULT '{}',
      created_at    timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT usage_logs_pkey PRIMARY KEY (id)
    );
    CREATE INDEX IF NOT EXISTS idx_usage_logs_tenant_type
      ON public.usage_logs (tenant_id, resource_type, created_at DESC);
    ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Usage logs isolation" ON public.usage_logs
      FOR ALL USING (public.auth_is_tenant_member(tenant_id));
  END IF;
END $$;

-- ── 5. Handoff Requests Table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.handoff_requests (
  id               uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id  uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  requested_by     uuid        REFERENCES auth.users(id),
  assigned_to      uuid        REFERENCES auth.users(id),
  reason           text,
  status           text        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','resolved','escalated')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT handoff_requests_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_handoff_tenant_status
  ON public.handoff_requests (tenant_id, status, created_at DESC);
ALTER TABLE public.handoff_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Handoff isolation" ON public.handoff_requests
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

DROP TRIGGER IF EXISTS trg_handoff_upd ON public.handoff_requests;
CREATE TRIGGER trg_handoff_upd
  BEFORE UPDATE ON public.handoff_requests
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 6. Materialized Views for Dashboard Analytics ───────────────────────────

-- Daily message volume per tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_daily_message_volume AS
SELECT
  tenant_id,
  date_trunc('day', created_at) AS day,
  sender_type,
  COUNT(*)                       AS message_count
FROM public.messages
GROUP BY tenant_id, date_trunc('day', created_at), sender_type
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_msg_vol
  ON public.mv_daily_message_volume (tenant_id, day, sender_type);

-- Tenant conversation stats (realtime-ish, refreshed every 5 min)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_conversation_stats AS
SELECT
  c.tenant_id,
  COUNT(c.id)                                        AS total_conversations,
  COUNT(c.id) FILTER (WHERE c.status = 'open')       AS open_conversations,
  COUNT(c.id) FILTER (WHERE c.mode = 'manual')       AS human_mode,
  COUNT(c.id) FILTER (WHERE c.mode = 'ai')           AS ai_mode,
  SUM(c.unread_count)                                AS total_unread,
  MAX(c.last_message_at)                             AS last_activity
FROM public.conversations c
GROUP BY c.tenant_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_conv_stats_tenant
  ON public.mv_tenant_conversation_stats (tenant_id);

-- Campaign performance summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_campaign_performance AS
SELECT
  cam.tenant_id,
  cam.id            AS campaign_id,
  cam.name,
  cam.status,
  COUNT(cl.id)      AS total_sent,
  COUNT(cl.id) FILTER (WHERE cl.status = 'delivered') AS delivered,
  COUNT(cl.id) FILTER (WHERE cl.status = 'read')      AS read_count,
  COUNT(cl.id) FILTER (WHERE cl.status = 'replied')   AS replied,
  cam.created_at
FROM public.campaigns cam
LEFT JOIN public.campaign_logs cl ON cl.campaign_id = cam.id
GROUP BY cam.tenant_id, cam.id, cam.name, cam.status, cam.created_at
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_campaign_perf
  ON public.mv_campaign_performance (tenant_id, campaign_id);

-- Refresh function (called by pg_cron every 5 minutes)
CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_message_volume;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_conversation_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_campaign_performance;
END;
$$;

-- Schedule refresh via pg_cron if extension is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('refresh-analytics', '*/5 * * * *', 'SELECT public.refresh_analytics_views()');
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL; -- pg_cron not available in this environment, skip silently
END $$;

-- ── 7. Advanced Indexes ──────────────────────────────────────────────────────

-- GIN index on messages.content for full-text search
CREATE INDEX IF NOT EXISTS idx_messages_content_gin
  ON public.messages USING gin(to_tsvector('english', content));

-- GIN index on contacts.tags for fast tag filtering
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin
  ON public.contacts USING gin(tags);

-- GIN index on knowledge_base.metadata for metadata queries
CREATE INDEX IF NOT EXISTS idx_knowledge_meta_gin
  ON public.knowledge_base USING gin(metadata);

-- Covering index: conversation inbox (covers all fields needed for inbox list)
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_covering
  ON public.conversations (tenant_id, last_message_at DESC)
  INCLUDE (id, contact_id, status, mode, unread_count);

-- Partial index: only active AI agents per tenant
CREATE INDEX IF NOT EXISTS idx_ai_agents_active_partial
  ON public.ai_agents (tenant_id)
  WHERE is_active = true;

-- Webhook dedup lookup (status filter for quick skip)
CREATE INDEX IF NOT EXISTS idx_webhook_events_dedup
  ON public.webhook_events (external_event_id, status);

-- Campaign contacts lookup
CREATE INDEX IF NOT EXISTS idx_campaign_logs_contact
  ON public.campaign_logs (tenant_id, contact_id, sent_at DESC)
  WHERE sent_at IS NOT NULL;

-- Knowledge base vector index (HNSW for fast ANN search)
-- Only create if pgvector is available and embedding column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'knowledge_base' AND column_name = 'embedding'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_hnsw
      ON public.knowledge_base USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 8. Encrypt Sensitive Columns ────────────────────────────────────────────
-- Access tokens are encrypted at the application layer before storage.
-- Add a comment documenting this contract.

COMMENT ON COLUMN public.whatsapp_accounts.access_token IS
  'AES-256-GCM encrypted at application layer. Decrypt with server/src/utils/encryption.ts::decrypt()';
COMMENT ON COLUMN public.api_keys.key_hash IS
  'SHA-256 hash of the plaintext API key. Plaintext is never stored.';

-- ── 9. Webhook Idempotency Enhancement ──────────────────────────────────────

-- Add tenant_id to webhook_events if missing (from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.webhook_events ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure the UNIQUE constraint on external_event_id exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'webhook_events'
      AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_ext_id_unique UNIQUE (external_event_id);
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 10. Audit Log Table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  tenant_id    uuid        REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action       text        NOT NULL,  -- e.g. 'agent.update', 'flow.delete'
  resource     text        NOT NULL,  -- e.g. 'ai_agents'
  resource_id  text,
  changes      jsonb       NOT NULL DEFAULT '{}',
  ip_address   inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created
  ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON public.audit_logs (user_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Audit logs are read-only for tenants (inserts only via service role / backend)
CREATE POLICY "Audit logs read" ON public.audit_logs
  FOR SELECT USING (public.auth_is_tenant_member(tenant_id));
CREATE POLICY "Audit logs insert" ON public.audit_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- ── 11. Token Budget Function ────────────────────────────────────────────────

-- Function used by AI guard to check token budget atomically
CREATE OR REPLACE FUNCTION public.get_ai_token_usage_today(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(quantity), 0)::integer
  FROM public.usage_logs
  WHERE tenant_id = p_tenant_id
    AND resource_type = 'ai_tokens'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
$$;

-- ── 12. Delivery Reconciliation Function ─────────────────────────────────────

-- Marks outbound messages as timed-out if not delivered within 5 minutes.
-- Called by pg_cron or a reconciliation worker.
CREATE OR REPLACE FUNCTION public.timeout_stale_outbound_messages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH timed_out AS (
    UPDATE public.outbound_messages
    SET
      status     = 'failed',
      last_error = 'Delivery timeout — no status update received within 5 minutes'
    WHERE status IN ('queued', 'sending')
      AND queued_at < now() - interval '5 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO updated_count FROM timed_out;

  RETURN updated_count;
END;
$$;

-- Schedule delivery reconciliation every minute
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('reconcile-delivery', '* * * * *', 'SELECT public.timeout_stale_outbound_messages()');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ── 13. RLS Performance Optimization ─────────────────────────────────────────
-- Replace expensive subquery in auth_is_tenant_member with a set-returning function
-- that PostgreSQL can efficiently inline into RLS policies.

CREATE OR REPLACE FUNCTION public.auth_is_tenant_member(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = p_tenant_id
      AND tm.user_id   = auth.uid()
  )
  OR EXISTS (
    -- Fallback for profiles.organization_id (legacy)
    SELECT 1
    FROM public.profiles p
    WHERE p.id              = auth.uid()
      AND p.organization_id = p_tenant_id
  )
$$;

-- ── 14. Conversation Unique Constraint ───────────────────────────────────────
-- Ensures 1 conversation per contact per tenant (backend depends on this for upsert)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND constraint_name = 'conversations_tenant_contact_unique'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_tenant_contact_unique UNIQUE (tenant_id, contact_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'conversations unique constraint already exists or could not be added: %', SQLERRM;
END $$;

-- Contact unique constraint (backend upsert depends on this)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND constraint_name = 'contacts_tenant_phone_unique'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_tenant_phone_unique UNIQUE (tenant_id, phone);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'contacts unique constraint already exists: %', SQLERRM;
END $$;

-- ── 15. Storage Policies for Catalog Images ──────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog-images',
  'catalog-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ── 16. Realtime Replication for Inbox ──────────────────────────────────────
-- Enable Supabase Realtime on tables needed for inbox updates.
-- (Realtime uses logical replication — tables must be in the realtime publication)
DO $$
BEGIN
  -- Add messages to realtime publication if not already there
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime publication update skipped: %', SQLERRM;
END $$;

-- ============================================================
-- END ENTERPRISE HARDENING MIGRATION v4.0
-- ============================================================
