/**
 * server/src/middleware/rate-limit.middleware.ts
 *
 * Express rate-limiter — SWITCHED from Upstash Redis to in-process LRU
 * (the same lib/memory-cache.ts logic, re-implemented here for the Express
 * server process which cannot import from Next.js `@/lib/*` aliases).
 *
 * Before : each request → 1 Redis GET + 1 Redis SET via Upstash REST
 * After  : each request → O(1) HashMap lookup, zero network I/O
 *
 * Redis (Upstash) is now reserved exclusively for:
 *   - BullMQ active jobs  (ioredis TCP connection)
 *   - RAG embedding cache (Upstash REST, 24h TTL)
 */

import type { Request, Response, NextFunction } from 'express'
import { LRUCache } from 'lru-cache'

// ── In-process rate-limit store ───────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  windowStart: number
}

/**
 * Single LRU store shared across all Express rate-limit middleware instances.
 * 10K entries × ~80 bytes each ≈ 800 KB max heap usage.
 */
const _store = new LRUCache<string, RateLimitEntry>({
  max: 10_000,
  ttl: 60_000,         // 60 s — entries auto-expire after one window
  ttlAutopurge: false,
  allowStale: false,
})

function inProcessLimit(
  identifier: string,
  limit: number,
  windowMs: number,
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now   = Date.now()
  const entry = _store.get(identifier)

  if (!entry || now - entry.windowStart >= windowMs) {
    _store.set(identifier, { count: 1, windowStart: now })
    return { success: true, limit, remaining: limit - 1, reset: now + windowMs }
  }

  const next  = entry.count + 1
  const reset = entry.windowStart + windowMs

  if (next > limit) {
    return { success: false, limit, remaining: 0, reset }
  }

  _store.set(identifier, { count: next, windowStart: entry.windowStart })
  return { success: true, limit, remaining: limit - next, reset }
}

// ── Identifier resolver ───────────────────────────────────────────────────────

function getIdentifier(req: Request): string {
  if (req.user?.id) return `user:${req.user.id}`
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  return `ip:${ip}`
}

// ── Middleware factory ────────────────────────────────────────────────────────

interface RateLimitOptions {
  limit: number
  windowSec: number
  prefix: string
}

function createRateLimiter(options: RateLimitOptions) {
  const windowMs = options.windowSec * 1_000

  return (req: Request, res: Response, next: NextFunction): void => {
    const key    = `${options.prefix}:${getIdentifier(req)}`
    const result = inProcessLimit(key, options.limit, windowMs)

    res.setHeader('X-RateLimit-Limit',     result.limit)
    res.setHeader('X-RateLimit-Remaining', result.remaining)
    res.setHeader('X-RateLimit-Reset',     result.reset)

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
      res.setHeader('Retry-After', retryAfter)
      res.status(429).json({ error: 'Too many requests. Please slow down.' })
      return
    }

    next()
  }
}

// ── Pre-built middleware for route groups ─────────────────────────────────────

/** 120 requests / 60 s per authenticated user */
export const apiRateLimit = createRateLimiter({
  limit: 120,
  windowSec: 60,
  prefix: 'api',
})

/** 10 requests / 60 s for auth endpoints */
export const authRateLimit = createRateLimiter({
  limit: 10,
  windowSec: 60,
  prefix: 'auth',
})

/** 30 AI calls / 60 s per user (controls OpenAI spend) */
export const aiRateLimit = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: 'ai',
})

/** 300 webhook events / 60 s per IP */
export const webhookRateLimit = createRateLimiter({
  limit: 300,
  windowSec: 60,
  prefix: 'webhook',
})
