import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { Ratelimit } from '@upstash/ratelimit'

/**
 * Enterprise-grade rate limiter backed by Upstash Redis (sliding-window algorithm).
 *
 * Enforces per tenant_id + user_id limits to guarantee tenant isolation and safety.
 *
 * Uses centralized Redis client singleton and statically compiled Ratelimit caches
 * to achieve zero execution latency and eliminate redundant runtime object allocation.
 */

interface RateLimitConfig {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSec: number
  /** Identifier prefix (e.g. 'api', 'auth', 'webhook', 'ai') */
  prefix: string
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Caching singletons to prevent connection pool exhaustion
const ratelimitSingletons = new Map<string, Ratelimit>()

/**
 * Returns the cached Ratelimit instance for the specific config.
 */
function getRatelimit(config: RateLimitConfig): Ratelimit {
  const cacheKey = `${config.prefix}:${config.limit}:${config.windowSec}`
  let ratelimit = ratelimitSingletons.get(cacheKey)

  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSec} s`),
      prefix: `whatsflow:${config.prefix}`,
      analytics: true,
    })
    
    ratelimitSingletons.set(cacheKey, ratelimit)
  }
  
  return ratelimit
}

async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Skip rate limiting in development if Upstash is not configured
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { success: true, limit: config.limit, remaining: config.limit, reset: 0 }
  }

  try {
    const ratelimit = getRatelimit(config)
    const result = await ratelimit.limit(identifier)
    
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    console.error(`[RateLimit] Limiter execution error for prefix ${config.prefix}:`, error)
    // Fail-closed in production to prevent DDoS / cost explosion when Upstash/Redis is down
    if (process.env.NODE_ENV === 'production') {
      return { success: false, limit: config.limit, remaining: 0, reset: Date.now() + 60000 }
    }
    // Fail-open in non-production/development
    return { success: true, limit: config.limit, remaining: 1, reset: 0 }
  }
}

/**
 * Derives a secure rate limit identifier based on tenant_id + user_id context.
 * Falls back to IP isolation if the request is unauthenticated.
 */
function getTenantUserIdentifier(request: NextRequest): string {
  const tenantId = request.headers.get('x-tenant-id') || 'system'
  const userId = request.headers.get('x-user-id')
  
  if (userId) {
    return `tenant:${tenantId}:user:${userId}`
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `tenant:${tenantId}:ip:${ip}`
}

// ── Rate Limit Configurations per request type ─────────────────────────────────

export async function rateLimitAuth(request: NextRequest) {
  return checkRateLimit(getTenantUserIdentifier(request), {
    limit: 10,
    windowSec: 60,
    prefix: 'auth',
  })
}

export async function rateLimitApi(request: NextRequest) {
  return checkRateLimit(getTenantUserIdentifier(request), {
    limit: 120,
    windowSec: 60,
    prefix: 'api',
  })
}

export async function rateLimitWebhook(request: NextRequest) {
  return checkRateLimit(getTenantUserIdentifier(request), {
    limit: 100, // Max 100 requests/minute
    windowSec: 60,
    prefix: 'webhook',
  })
}

export async function rateLimitAi(request: NextRequest) {
  return checkRateLimit(getTenantUserIdentifier(request), {
    limit: 30, // Max 30 requests/minute
    windowSec: 60,
    prefix: 'ai',
  })
}

/**
 * Returns standard HTTP 429 response with explicit reset and retry headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(result.reset),
        'Retry-After': String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
      },
    }
  )
}
