import { Redis } from '@upstash/redis'

/**
 * Enterprise-grade Upstash Redis client singleton.
 * Guarantees a single connection state across all requests and handles
 * credentials absence gracefully with a developer-friendly proxy fallback in dev.
 */
let redisClientSingleton: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClientSingleton) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      console.warn('[Redis] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing in environment. Using mock proxy.');
      return new Proxy({} as Redis, {
        get(_, prop) {
          return () => {
            throw new Error(`[Redis Client] Attempted to access property "${String(prop)}" but Upstash Redis credentials are not configured in environment.`);
          }
        }
      })
    }

    redisClientSingleton = new Redis({
      url,
      token,
    })
  }
  return redisClientSingleton
}

export const redis = getRedisClient()
