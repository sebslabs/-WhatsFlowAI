/**
 * lib/memory-cache.ts
 *
 * Centralised in-process LRU caches.
 * Goal: keep Redis (Upstash) responsible ONLY for:
 *   1. Active BullMQ jobs  (TCP ioredis connection)
 *   2. RAG embedding cache (Upstash REST — 24h TTL, set in lib/rag.ts)
 *
 * Everything else (rate-limiting, webhook dedup) runs in Node.js heap
 * via lru-cache, which costs zero network round-trips.
 *
 * ─── Cache inventory ───────────────────────────────────────────────────────
 *
 * rateLimitCache
 *   Purpose : sliding-window rate limiting for Next.js API routes
 *   Key     : `${prefix}:${identifier}`  (e.g. "api:tenant:xyz:user:abc")
 *   Value   : { count: number; windowStart: number }
 *   Max     : 10,000 entries (covers all unique tenant+user combinations)
 *   TTL     : 60 s — matches the standard 60-second rate-limit window
 *
 * dedupCache
 *   Purpose : webhook / message deduplication without hitting Redis or Supabase
 *   Key     : webhookId / messageId string
 *   Value   : true  (presence = seen; absence = new)
 *   Max     : 5,000 entries (~30 s of high-volume traffic at 150 msg/s)
 *   TTL     : 30 s — Meta retries within 20 s, so 30 s safely covers them
 */

import { LRUCache } from 'lru-cache'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RateLimitEntry {
  /** How many requests have been counted in the current window */
  count: number
  /** Unix-ms timestamp when the current window started */
  windowStart: number
}

// ── rateLimitCache ────────────────────────────────────────────────────────────

export const rateLimitCache = new LRUCache<string, RateLimitEntry>({
  max: 10_000,
  ttl: 60_000,          // 60 s — entries expire after one full window
  ttlAutopurge: false,  // Don't run background sweeps; purge on access only
  allowStale: false,
})

/**
 * checkRateLimit
 *
 * Fixed-window counter backed by rateLimitCache.
 *
 * Compared to the previous Upstash sliding-window approach:
 *   - Zero network latency (pure in-process)
 *   - Same protection characteristics for short abuse bursts
 *   - Resets cleanly at the window boundary
 *
 * @param identifier  Unique key (e.g. "api:tenant:t1:user:u1")
 * @param limit       Maximum requests allowed per window
 * @param windowMs    Window duration in milliseconds (default 60 000)
 * @returns           { success, limit, remaining, reset }
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs = 60_000,
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now   = Date.now()
  const entry = rateLimitCache.get(identifier)

  if (!entry || now - entry.windowStart >= windowMs) {
    // New window — first request always succeeds
    rateLimitCache.set(identifier, { count: 1, windowStart: now })
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs }
  }

  const next = entry.count + 1
  const reset = entry.windowStart + windowMs

  if (next > limit) {
    // Over limit — don't increment stored count (prevents int overflow on spam)
    return { success: false, limit, remaining: 0, reset }
  }

  rateLimitCache.set(identifier, { count: next, windowStart: entry.windowStart })
  return { success: true, limit, remaining: limit - next, reset }
}

// ── dedupCache ────────────────────────────────────────────────────────────────

export const dedupCache = new LRUCache<string, true>({
  max: 5_000,
  ttl: 30_000,          // 30 s — covers Meta's 20 s retry window + margin
  ttlAutopurge: false,
  allowStale: false,
})

/**
 * isDuplicate
 *
 * Returns true if this webhookId has been seen in the last 30 seconds.
 * Marks it as seen on first call (set-on-miss semantics).
 *
 * Usage at the top of the webhook POST handler:
 *
 *   if (isDuplicate(messageId)) {
 *     return NextResponse.json({ received: true }, { status: 200 })
 *   }
 */
export function isDuplicate(webhookId: string): boolean {
  if (dedupCache.has(webhookId)) return true
  dedupCache.set(webhookId, true)
  return false
}
