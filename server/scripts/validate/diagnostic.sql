-- ============================================================
-- Production Diagnostic SQL Queries
-- Run in Supabase SQL Editor (as service role)
-- These are READ-ONLY and safe to run in production
-- ============================================================

-- ── 1. EXPLAIN ANALYZE: Inbox Query ─────────────────────────────────────────
-- Replace 'YOUR-TENANT-ID' with a real tenant UUID before running.
-- Look for: "Index Scan" (good) vs "Seq Scan" (bad)

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT
  c.id,
  c.status,
  c.mode,
  c.unread_count,
  c.last_message_at,
  ct.name,
  ct.phone
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
WHERE c.tenant_id = 'YOUR-TENANT-ID'
ORDER BY c.last_message_at DESC
LIMIT 25;

-- ── 2. EXPLAIN ANALYZE: Message Pagination ───────────────────────────────────
-- Replace 'YOUR-CONV-ID' with a real conversation UUID.

EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT id, sender_type, content, created_at, delivery_status
FROM messages
WHERE conversation_id = 'YOUR-CONV-ID'
ORDER BY created_at ASC
LIMIT 50;

-- ── 3. Slow Query Detection ───────────────────────────────────────────────────
-- Requires pg_stat_statements extension (enabled by default in Supabase).

SELECT
  round(total_exec_time::numeric, 2)  AS total_ms,
  round(mean_exec_time::numeric, 2)   AS mean_ms,
  round(stddev_exec_time::numeric, 2) AS stddev_ms,
  calls,
  rows,
  round((shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0))::numeric * 100, 2) AS cache_hit_pct,
  LEFT(query, 120)                    AS query_preview
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries averaging >100ms
  AND calls > 10
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ── 4. Index Usage Analysis ───────────────────────────────────────────────────
-- Indexes with very low scan counts may be unused and waste write performance.

SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan           AS scans,
  idx_tup_read       AS tuples_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 30;

-- ── 5. Table Size Analysis ────────────────────────────────────────────────────

SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS total_size,
  pg_size_pretty(pg_relation_size('public.' || tablename))       AS table_size,
  pg_size_pretty(
    pg_total_relation_size('public.' || tablename) -
    pg_relation_size('public.' || tablename)
  )                                                              AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC
LIMIT 20;

-- ── 6. Lock Contention Analysis ───────────────────────────────────────────────
-- Run this during peak load to detect blocking queries.

SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state,
  wait_event_type,
  wait_event
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < now() - interval '5 seconds'
ORDER BY duration DESC;

-- ── 7. Blocking Queries ───────────────────────────────────────────────────────

SELECT
  blocked.pid        AS blocked_pid,
  blocked.query      AS blocked_query,
  blocking.pid       AS blocking_pid,
  blocking.query     AS blocking_query,
  now() - blocked.query_start AS wait_duration
FROM pg_stat_activity AS blocked
JOIN pg_stat_activity AS blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE blocked.cardinality(pg_blocking_pids(blocked.pid)) > 0;

-- ── 8. RLS Policy Audit ───────────────────────────────────────────────────────
-- Lists all active RLS policies. Verify every table has appropriate policies.

SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ── 9. Missing RLS Detection ──────────────────────────────────────────────────
-- Tables WITHOUT row-level security enabled = potential data exposure.

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        SELECT relname
        FROM pg_class
        WHERE relrowsecurity = true
      )
  )
ORDER BY tablename;

-- ── 10. Tenant Data Distribution ─────────────────────────────────────────────
-- Shows how data is distributed across tenants. Identifies heavy tenants.

SELECT
  t.name                    AS tenant_name,
  t.id                      AS tenant_id,
  COUNT(DISTINCT c.id)      AS conversations,
  COUNT(DISTINCT m.id)      AS messages,
  COUNT(DISTINCT ct.id)     AS contacts,
  COUNT(DISTINCT l.id)      AS leads
FROM tenants t
LEFT JOIN conversations c  ON c.tenant_id = t.id
LEFT JOIN messages m       ON m.tenant_id = t.id
LEFT JOIN contacts ct      ON ct.tenant_id = t.id
LEFT JOIN leads l          ON l.tenant_id = t.id
GROUP BY t.id, t.name
ORDER BY messages DESC
LIMIT 20;

-- ── 11. Webhook Event Status Distribution ────────────────────────────────────

SELECT
  status,
  COUNT(*)              AS count,
  MIN(created_at)       AS oldest,
  MAX(created_at)       AS newest,
  AVG(EXTRACT(EPOCH FROM (now() - created_at))) AS avg_age_secs
FROM webhook_events
GROUP BY status
ORDER BY count DESC;

-- ── 12. DLQ Inspection ────────────────────────────────────────────────────────

SELECT
  source_queue,
  COUNT(*)           AS job_count,
  MAX(failed_at)     AS last_failure,
  COUNT(*) FILTER (WHERE replayed_at IS NOT NULL) AS replayed_count
FROM dead_letter_queue
GROUP BY source_queue
ORDER BY job_count DESC;

-- ── 13. AI Usage Per Tenant (Last 7 Days) ────────────────────────────────────

SELECT
  t.name               AS tenant,
  SUM(ul.quantity)     AS total_tokens,
  COUNT(ul.id)         AS ai_calls,
  MAX(ul.created_at)   AS last_call
FROM usage_logs ul
JOIN tenants t ON t.id = ul.tenant_id
WHERE ul.resource_type = 'ai_tokens'
  AND ul.created_at > now() - interval '7 days'
GROUP BY t.id, t.name
ORDER BY total_tokens DESC
LIMIT 20;

-- ── 14. Outbound Message Delivery Rate ───────────────────────────────────────

SELECT
  status,
  COUNT(*)                          AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS pct
FROM outbound_messages
WHERE queued_at > now() - interval '24 hours'
GROUP BY status
ORDER BY count DESC;

-- ── 15. Materialized View Freshness Check ────────────────────────────────────

SELECT
  matviewname,
  last_refresh,
  EXTRACT(EPOCH FROM (now() - last_refresh)) / 60 AS minutes_since_refresh
FROM pg_stat_user_tables t
JOIN LATERAL (
  SELECT matviewname, now() AS last_refresh
  FROM pg_matviews
  WHERE matviewname IN (
    'mv_daily_message_volume',
    'mv_tenant_conversation_stats',
    'mv_campaign_performance'
  )
) mv ON true
WHERE t.relname = mv.matviewname;

-- ── 16. Cache Hit Ratio ───────────────────────────────────────────────────────
-- Should be >99% for a healthy production database.

SELECT
  sum(heap_blks_read)                                                     AS heap_read,
  sum(heap_blks_hit)                                                      AS heap_hit,
  round(sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2)
                                                                          AS cache_hit_pct
FROM pg_statio_user_tables;

-- ════════════════════════════════════════════════════
-- INTERPRETATION GUIDE
-- ════════════════════════════════════════════════════
-- Query 1-2: Look for "Index Scan" in EXPLAIN output.
--            "Seq Scan" on large tables = add an index.
-- Query 3:   mean_ms > 100ms → optimize or add index.
-- Query 4:   Indexes with 0 scans after 7 days → DROP.
-- Query 6-7: Any wait_event = 'Lock' → contention risk.
-- Query 9:   Any table listed = MISSING RLS → critical.
-- Query 15:  minutes_since_refresh > 10 → pg_cron broken.
-- Query 16:  cache_hit_pct < 99 → increase Postgres memory.
