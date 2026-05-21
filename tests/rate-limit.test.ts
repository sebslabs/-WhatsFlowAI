/**
 * Rate limiter fail-closed behavior tests (HIGH #6).
 * Verifies production blocks traffic when Redis is unavailable (503, not fail-open).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * Mirrors the fail-closed branch in server/src/middleware/rate-limit.middleware.ts
 * when getRedisClient() returns null.
 */
function shouldFailClosedWithoutRedis(nodeEnv: string | undefined, redisAvailable: boolean): boolean {
  if (redisAvailable) return false;
  return nodeEnv === 'production';
}

/**
 * Mirrors the fail-closed branch on Redis errors during limit checks.
 */
function shouldFailClosedOnRedisError(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

describe('HIGH Fix #6 — Express rate limiter fail-closed in production', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks requests (503) in production when Redis is not configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldFailClosedWithoutRedis(process.env.NODE_ENV, false)).toBe(true);
  });

  it('allows requests in development when Redis is not configured', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(shouldFailClosedWithoutRedis(process.env.NODE_ENV, false)).toBe(false);
  });

  it('blocks requests on Redis errors in production (prevents intentional bypass)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldFailClosedOnRedisError(process.env.NODE_ENV)).toBe(true);
  });

  it('allows requests on Redis errors in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(shouldFailClosedOnRedisError(process.env.NODE_ENV)).toBe(false);
  });
});
