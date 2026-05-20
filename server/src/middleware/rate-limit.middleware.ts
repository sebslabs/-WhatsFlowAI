/**
 * Upstash Redis rate limiter middleware for Express.
 *
 * Install: npm i @upstash/redis @upstash/ratelimit
 * Set env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import type { Request, Response, NextFunction } from 'express'

interface RateLimitOptions {
  limit: number
  windowSec: number
  prefix: string
}

function getIdentifier(req: Request): string {
  // Authenticated users are identified by their user ID (more precise than IP)
  if (req.user?.id) return `user:${req.user.id}`
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  return `ip:${ip}`
}

// SECURITY FIX (HIGH #6): Redis client singleton — instantiate once per process,
// not on every request. Creating new Redis() per request exhausted connection
// pools under moderate load and caused cascading failures.
let _redisInstance: import('@upstash/redis').Redis | null = null
let _redisInitAttempted = false

async function getRedisClient(): Promise<import('@upstash/redis').Redis | null> {
  if (_redisInitAttempted) return _redisInstance

  _redisInitAttempted = true

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  try {
    const { Redis } = await import('@upstash/redis')
    _redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return _redisInstance
  } catch (err) {
    console.error('[rate-limit] Failed to initialise Redis singleton:', err)
    return null
  }
}

// Cache Ratelimit instances per config key to avoid re-instantiation
const ratelimitCache = new Map<string, import('@upstash/ratelimit').Ratelimit>()

function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const redis = await getRedisClient()

    if (!redis) {
      // Redis not configured — skip in development; block in production
      // SECURITY FIX (HIGH #6): Fail-closed in production to prevent DDoS cost explosion.
      if (process.env.NODE_ENV === 'production') {
        console.error('[rate-limit] Redis unavailable in production \u2014 failing closed to protect system')
        res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' })
        return
      }
      // Non-production: skip rate limiting
      next()
      return
    }

    try {
      const { Ratelimit } = await import('@upstash/ratelimit')
      const cacheKey = `${options.prefix}:${options.limit}:${options.windowSec}`

      let ratelimit = ratelimitCache.get(cacheKey)
      if (!ratelimit) {
        ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSec} s`),
          prefix: `whatsflow:${options.prefix}`,
          analytics: true,
        })
        ratelimitCache.set(cacheKey, ratelimit)
      }

      const identifier = getIdentifier(req)
      const result = await ratelimit.limit(identifier)

      res.setHeader('X-RateLimit-Limit', result.limit)
      res.setHeader('X-RateLimit-Remaining', result.remaining)
      res.setHeader('X-RateLimit-Reset', result.reset)

      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
        res.setHeader('Retry-After', retryAfter)
        res.status(429).json({ error: 'Too many requests. Please slow down.' })
        return
      }

      next()
    } catch (err) {
      // SECURITY FIX (HIGH #6): On Redis error, fail-closed in production to prevent
      // an attacker from intentionally triggering Redis errors to bypass rate limits.
      console.error('[rate-limit] Redis error during limit check:', err)
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'Service temporarily unavailable. Please retry.' })
        return
      }
      // Non-production: fail-open (allow traffic through for developer convenience)
      next()
    }
  }
}

// Pre-built limiters for different route groups

/** 120 requests / 60s per authenticated user */
export const apiRateLimit = createRateLimiter({
  limit: 120,
  windowSec: 60,
  prefix: 'api',
})

/** 10 requests / 60s for auth endpoints */
export const authRateLimit = createRateLimiter({
  limit: 10,
  windowSec: 60,
  prefix: 'auth',
})

/** 30 AI calls / 60s per user (controls OpenAI spend) */
export const aiRateLimit = createRateLimiter({
  limit: 30,
  windowSec: 60,
  prefix: 'ai',
})

/** 300 webhook events / 60s per IP */
export const webhookRateLimit = createRateLimiter({
  limit: 300,
  windowSec: 60,
  prefix: 'webhook',
})
