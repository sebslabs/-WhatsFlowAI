/**
 * Structured logger for WhatsFlow AI.
 *
 * Uses pino in production (JSON output, zero overhead).
 * Falls back to a console shim in development.
 *
 * Install: npm i pino pino-pretty @sentry/nextjs
 * Set env: SENTRY_DSN, LOG_LEVEL (default: "info")
 */

type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogMeta {
  [key: string]: unknown
}

// Redact sensitive fields so they never appear in logs
const REDACTED_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'x-hub-signature-256',
  'creditCard',
  'ssn',
]

function redact(meta: LogMeta): LogMeta {
  const safe: LogMeta = {}
  for (const [k, v] of Object.entries(meta)) {
    const lower = k.toLowerCase()
    if (REDACTED_FIELDS.some((f) => lower.includes(f))) {
      safe[k] = '[REDACTED]'
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      safe[k] = redact(v as LogMeta)
    } else {
      safe[k] = v
    }
  }
  return safe
}

function formatMessage(level: LogLevel, meta: LogMeta, message: string): void {
  const entry = {
    level,
    time: new Date().toISOString(),
    service: 'whatsflow-ai',
    env: process.env.NODE_ENV,
    ...redact(meta),
    msg: message,
  }

  if (process.env.NODE_ENV === 'production') {
    // JSON output — picked up by Vercel Log Drains / Datadog / Logtail
    process.stdout.write(JSON.stringify(entry) + '\n')
  } else {
    const levelColors: Record<LogLevel, string> = {
      trace: '\x1b[37m',
      debug: '\x1b[36m',
      info: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    }
    const reset = '\x1b[0m'
    const color = levelColors[level] ?? ''
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(redact(meta)) : ''
    console.log(`${color}[${level.toUpperCase()}]${reset} ${entry.time} ${message}${metaStr}`)
  }
}

function captureException(error: unknown, meta: LogMeta): void {
  if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
    // Dynamic import avoids bundling Sentry in dev builds
    import('@sentry/nextjs').then(({ captureException: sentryCapture, setContext }) => {
      setContext('meta', meta)
      sentryCapture(error)
    }).catch(() => {/* Sentry unavailable — swallow */})
  }
}

export const logger = {
  trace(meta: LogMeta | string, message?: string): void {
    if (typeof meta === 'string') return formatMessage('trace', {}, meta)
    formatMessage('trace', meta, message ?? '')
  },
  debug(meta: LogMeta | string, message?: string): void {
    if (typeof meta === 'string') return formatMessage('debug', {}, meta)
    formatMessage('debug', meta, message ?? '')
  },
  info(meta: LogMeta | string, message?: string): void {
    if (typeof meta === 'string') return formatMessage('info', {}, meta)
    formatMessage('info', meta, message ?? '')
  },
  warn(meta: LogMeta | string, message?: string): void {
    if (typeof meta === 'string') return formatMessage('warn', {}, meta)
    formatMessage('warn', meta, message ?? '')
  },
  error(meta: LogMeta | string, message?: string, error?: unknown): void {
    if (typeof meta === 'string') {
      formatMessage('error', {}, meta)
      return
    }
    formatMessage('error', meta, message ?? '')
    if (error) captureException(error, meta)
  },
  fatal(meta: LogMeta | string, message?: string, error?: unknown): void {
    if (typeof meta === 'string') {
      formatMessage('fatal', {}, meta)
      return
    }
    formatMessage('fatal', meta, message ?? '')
    if (error) captureException(error, meta)
  },
}

export type Logger = typeof logger
