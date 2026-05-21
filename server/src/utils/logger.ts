/**
 * Logger Service — Structured, Correlation-ID–aware
 *
 * Every log line is a JSON object containing:
 *   - level, message, timestamp
 *   - correlationId (propagated through async context via AsyncLocalStorage)
 *   - tenantId, userId when available
 *   - arbitrary metadata fields
 *
 * Usage:
 *   import { logger } from '../utils/logger.js'
 *   logger.info('Webhook processed', { tenantId, messageId, latencyMs })
 *   logger.error('Worker failed', { jobId, err })
 */

import { AsyncLocalStorage } from 'async_hooks'

// ── Async Context ─────────────────────────────────────────────────────────────

export interface LogContext {
  correlationId?: string
  tenantId?: string
  userId?: string
  jobId?: string
  traceId?: string
}

export const logStorage = new AsyncLocalStorage<LogContext>()

// ── Log Levels ────────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
}

const MIN_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info'

// ── Core Log Function ─────────────────────────────────────────────────────────

function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  if (LEVELS[level] < LEVELS[MIN_LEVEL]) return

  const ctx = logStorage.getStore() ?? {}

  const entry: Record<string, unknown> = {
    ts:            new Date().toISOString(),
    level,
    msg:           message,
    service:       'whatsflow-api',
    env:           process.env.NODE_ENV ?? 'development',
    ...ctx,
    ...meta,
  }

  // Serialize errors properly
  if (meta.err instanceof Error) {
    entry.err = { message: meta.err.message, stack: meta.err.stack, name: meta.err.name }
  }

  // In production, emit JSON to stdout for log aggregators (Datadog, Logtail, etc.)
  // In dev, pretty-print
  if (process.env.NODE_ENV === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n')
  } else {
    const color = { debug: '\x1b[36m', info: '\x1b[32m', warn: '\x1b[33m', error: '\x1b[31m' }[level]
    const ctxStr = ctx.correlationId ? ` [${ctx.correlationId?.slice(0, 8)}]` : ''
    const tenantStr = ctx.tenantId ? ` tenant=${ctx.tenantId.slice(0, 8)}` : ''
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : ''
    process.stdout.write(
      `${color}[${level.toUpperCase()}]\x1b[0m${ctxStr}${tenantStr} ${message}${metaStr}\n`
    )
  }
}

// ── Public Logger API ─────────────────────────────────────────────────────────

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),

  /** Run a function with an established log context (correlationId, tenantId, etc.) */
  withContext<T>(ctx: LogContext, fn: () => T): T {
    return logStorage.run(ctx, fn)
  },

  /** Measure and log execution time of an async operation */
  async timed<T>(
    label: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await fn()
      log('info', `${label} completed`, { ...meta, latencyMs: Date.now() - start })
      return result
    } catch (err) {
      log('error', `${label} failed`, {
        ...meta,
        latencyMs: Date.now() - start,
        err: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
      })
      throw err
    }
  },
}

// ── Correlation ID Generator ──────────────────────────────────────────────────

export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}
