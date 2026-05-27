import { Redis } from '@upstash/redis'

/**
 * OPTIMIZATION: Single global Redis singleton for all non-BullMQ usage.
 *
 * Uses global._redis on the Node.js global object so that hot-reloads in
 * Next.js dev mode do NOT create a new client on every module re-evaluation,
 * which was a primary driver of excess Upstash command usage.
 *
 * For BullMQ connections use the ioredis `bullConnection` export below —
 * BullMQ requires a persistent TCP connection, not the Upstash REST client.
 */

declare global {
  // eslint-disable-next-line no-var
  var _redis: Redis | undefined
}

function buildRedisClient(): Redis {
  const url   = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn(
      '[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing. ' +
      'Using a no-op proxy — Redis calls will throw at runtime.'
    )
    return new Proxy({} as Redis, {
      get(_, prop) {
        return () => {
          throw new Error(
            `[Redis] Attempted to call .${String(prop)}() but Upstash credentials are not configured.`
          )
        }
      },
    })
  }

  return new Redis({ url, token })
}

/**
 * The single Redis client instance for all Next.js API routes and lib/ helpers.
 * Hot-reload safe: reuses the existing instance across module re-evaluations.
 */
export const redis: Redis =
  global._redis ?? (global._redis = buildRedisClient())

/**
 * ioredis connection config for BullMQ queues and workers.
 * BullMQ requires a real TCP Redis connection (not REST), so this is kept
 * separate from the Upstash REST client above.
 *
 * Usage:
 *   import { bullConnection } from '@/lib/redis'
 *   const queue = new Queue('my-queue', { connection: bullConnection })
 */
export const bullConnection = {
  host:                 process.env.UPSTASH_REDIS_HOST ?? 'localhost',
  port:                 6379,
  tls:                  process.env.UPSTASH_REDIS_HOST ? {} : undefined,
  maxRetriesPerRequest: null as null, // Required by BullMQ
  enableReadyCheck:     false,
} as const

/**
 * Legacy named export — kept for backward-compatibility with callers that
 * import `getRedisClient`. Prefer importing `redis` directly.
 */
export function getRedisClient(): Redis {
  return redis
}
