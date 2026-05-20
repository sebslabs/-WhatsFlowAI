/**
 * Circuit Breaker
 *
 * Implements the classic circuit breaker pattern for external APIs:
 *  - Meta Cloud API
 *  - Gemini / Groq / OpenAI / OpenRouter
 *  - Supabase (for write operations under extreme load)
 *
 * States:
 *  CLOSED   → normal operation, calls pass through
 *  OPEN     → too many failures, calls fail fast (no network hit)
 *  HALF_OPEN → test mode, one probe call allowed
 *
 * Benefits:
 *  - Prevents thundering herd on failing external services
 *  - Gives providers time to recover
 *  - Protects BullMQ retry budget from being exhausted instantly
 *  - Provides fast failure instead of 15s timeout storms
 */

import { logger } from './logger.js'

export type CBState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit */
  failureThreshold:  number
  /** Milliseconds the circuit stays OPEN before probing */
  recoveryTimeoutMs: number
  /** Optional success threshold in HALF_OPEN before re-closing */
  successThreshold?: number
  /** Name for logging/metrics */
  name:              string
}

export class CircuitBreaker {
  private state:          CBState = 'CLOSED'
  private failureCount:   number  = 0
  private successCount:   number  = 0
  private lastFailureTime: number = 0
  private readonly opts:  Required<CircuitBreakerOptions>

  constructor(opts: CircuitBreakerOptions) {
    this.opts = { successThreshold: 1, ...opts }
  }

  get currentState(): CBState { return this.state }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.opts.successThreshold) {
        this.state        = 'CLOSED'
        this.successCount = 0
        logger.info(`[circuit:${this.opts.name}] Circuit CLOSED (recovered)`)
      }
    }
  }

  private onFailure(err: Error): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === 'HALF_OPEN') {
      this.state        = 'OPEN'
      this.successCount = 0
      logger.warn(`[circuit:${this.opts.name}] HALF_OPEN probe failed → OPEN again`)
      return
    }

    if (this.failureCount >= this.opts.failureThreshold) {
      this.state = 'OPEN'
      logger.error(`[circuit:${this.opts.name}] Circuit OPENED after ${this.failureCount} failures`, {
        lastError: err.message,
      })
    }
  }

  /**
   * Execute a function protected by the circuit breaker.
   * Throws CircuitOpenError if the circuit is OPEN.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.opts.recoveryTimeoutMs) {
        this.state        = 'HALF_OPEN'
        this.successCount = 0
        logger.info(`[circuit:${this.opts.name}] Circuit HALF_OPEN (probing)`)
      } else {
        const waitSec = ((this.opts.recoveryTimeoutMs - elapsed) / 1000).toFixed(0)
        throw new CircuitOpenError(
          `Circuit breaker OPEN for '${this.opts.name}'. Retry in ${waitSec}s.`
        )
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err instanceof Error ? err : new Error(String(err)))
      throw err
    }
  }

  /** Reset the circuit to CLOSED (for testing or manual intervention) */
  reset(): void {
    this.state        = 'CLOSED'
    this.failureCount = 0
    this.successCount = 0
    logger.info(`[circuit:${this.opts.name}] Circuit manually reset to CLOSED`)
  }

  stats(): { name: string; state: CBState; failures: number; lastFailure: string | null } {
    return {
      name:        this.opts.name,
      state:       this.state,
      failures:    this.failureCount,
      lastFailure: this.lastFailureTime
        ? new Date(this.lastFailureTime).toISOString()
        : null,
    }
  }
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN'
  constructor(message: string) {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

// ── Pre-configured Breakers (singleton) ──────────────────────────────────────

export const breakers = {
  metaApi: new CircuitBreaker({
    name:              'meta-cloud-api',
    failureThreshold:  5,
    recoveryTimeoutMs: 60_000,   // 1 minute
    successThreshold:  2,
  }),

  gemini: new CircuitBreaker({
    name:              'gemini',
    failureThreshold:  3,
    recoveryTimeoutMs: 30_000,   // 30 seconds
  }),

  groq: new CircuitBreaker({
    name:              'groq',
    failureThreshold:  3,
    recoveryTimeoutMs: 30_000,
  }),

  openai: new CircuitBreaker({
    name:              'openai',
    failureThreshold:  3,
    recoveryTimeoutMs: 60_000,
  }),

  openrouter: new CircuitBreaker({
    name:              'openrouter',
    failureThreshold:  3,
    recoveryTimeoutMs: 30_000,
  }),
}

/** Get all circuit breaker stats for /metrics endpoint */
export function getAllCircuitStats() {
  return Object.values(breakers).map((b) => b.stats())
}
