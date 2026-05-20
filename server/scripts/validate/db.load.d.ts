/**
 * Database Load Validation Script
 * Run: npx tsx scripts/validate/db.load.ts
 *
 * Tests:
 * 1. Inbox query latency (conversations + contacts join)
 * 2. Message pagination (large conversations)
 * 3. RLS overhead (tenant-scoped vs service-role)
 * 4. Concurrent write contention (messages)
 * 5. Materialized view impact
 * 6. Missing index detection via pg_stat_user_indexes
 * 7. EXPLAIN ANALYZE slow query detection
 * 8. Lead flow state update throughput
 */
export {};
//# sourceMappingURL=db.load.d.ts.map