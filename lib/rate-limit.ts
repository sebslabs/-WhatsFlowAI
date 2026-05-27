import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/memory-cache'

/**
 * lib/rate-limit.ts  — Next.js Edge / API-route rate limiter
 *
 * SWITCHED from Upstash Redis to in-process LRU cache (lib/memory-cache.ts).
 *
 * Before : every rate-limit check = 1 Redis GET + 1 Redis SET via Upstash REST
 * After  : every rate-limit check = O(1) HashMap lookup — zero network I/O
 *
 * Trade-off acknowledged:
 *   Single-process deployments (Vercel serverless, single EC2, etc.) → identical
 *   protection. Multi-instance deployments (e.g. 3 Next.js replicas) → each
 *   instance tracks its own window, so the effective limit is limit × instances.
 *   For a single-tenant SaaS at this scale this is acceptable and vastly cheaper
 *   than paying Upstash for 300K+ rate-limit commands per day.
 *
 * Redis (Upstash) is now reserved exclusively for:
 *   - BullMQ active jobs  (ioredis TCP connection)
 *   - RAG embedding cache (Upstash REST, 24h TTL)
 */

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Derives a stable rate-limit key from tenant_id + user_id / IP.
 * Falls back to IP isolation for unauthenticated requests.
 */
function getIdentifier(prefix: string, request: NextRequest): string {
  const tenantId = request.headers.get('x-tenant-id') || 'system'
  const userId   = request.headers.get('x-user-id')

  if (userId) return `${prefix}:tenant:${tenantId}:user:${userId}`

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
  return `${prefix}:tenant:${tenantId}:ip:${ip}`
}

// ── Public rate-limit helpers ──────────────────────────────────────────────────

/** 10 req / 60 s — auth endpoints (login, 2FA, password reset) */
export async function rateLimitAuth(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(getIdentifier('auth', request), 10, 60_000)
}

/** 120 req / 60 s — standard authenticated API routes */
export async function rateLimitApi(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(getIdentifier('api', request), 120, 60_000)
}

/** 100 req / 60 s — inbound webhook endpoints */
export async function rateLimitWebhook(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(getIdentifier('webhook', request), 100, 60_000)
}

/** 30 req / 60 s — AI generation endpoints */
export async function rateLimitAi(request: NextRequest): Promise<RateLimitResult> {
  return checkRateLimit(getIdentifier('ai', request), 30, 60_000)
}

/**
 * getRateLimiter — kept for backward-compat with callers that used the old
 * Upstash-backed factory (e.g. services/ai-gateway.ts).
 *
 * Returns a thin object with a `.limit(identifier)` method so existing call
 * sites need zero changes.
 */
export function getRateLimiter(prefix: string, limit: number, windowSec: number) {
  return {
    limit: (identifier: string): Promise<RateLimitResult> =>
      Promise.resolve(checkRateLimit(`${prefix}:${identifier}`, limit, windowSec * 1000)),
  }
}

/**
 * Returns a standard HTTP 429 response with retry headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit':     String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset':     String(result.reset),
        'Retry-After':           String(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))),
      },
    }
  )
}
