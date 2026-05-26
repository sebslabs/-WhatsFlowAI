import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'http'

import webhookRoutes from './routes/webhook.routes.js'
import apiRoutes from './routes/api.routes.js'
import internalRoutes from './routes/internal.routes.js'
import scrapeRoutes from './routes/scrape.routes.js'
import { correlationMiddleware, latencyMiddleware } from './middleware/correlation.middleware.js'
import { validateStartup } from './lib/startup.validator.js'
import { createRealtimeServer } from './lib/realtime.js'
import { logger } from './utils/logger.js'
import { renderPrometheusMetrics, startQueueMetricsCollection, metrics, METRICS } from './utils/metrics.js'
import { getAllCircuitStats } from './utils/circuit-breaker.js'
import { initSentry, sentryErrorHandler } from './utils/sentry.js'
import './workers/baileys.worker.js'
import './workers/scrape.worker.js' // Start the scraper BullMQ worker on boot



// ── Service-role client (server-only — NEVER expose to frontend) ─────────────
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const app = express()
const PORT = parseInt(process.env.PORT ?? '5000', 10)

// ── Sentry: init FIRST so it captures all errors including startup ────────────
await initSentry()

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  })
)

// ── CORS — strict allowlist ───────────────────────────────────────────────────
// MEDIUM FIX (#3): Origin header is now REQUIRED in production.
// Previously, requests without an Origin header (e.g. curl, server-to-server abuse)
// bypassed the CORS check entirely. Now they are blocked in production.
const envOrigins = (process.env.ALLOWED_ORIGIN ?? '').split(',').map((o) => o.trim()).filter(Boolean)
const allowedOrigins =
  envOrigins.length > 0
    ? envOrigins
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://whatsflow.vercel.app', process.env.NEXT_PUBLIC_SITE_URL].filter(Boolean) as string[]

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) {
        // Allow origin-less requests (Postman, curl, health checks, server-to-server)
        cb(null, true)
        return
      }

      if (allowedOrigins.includes(origin)) {
        cb(null, true)
        return
      }

      cb(new Error(`CORS: origin ${origin} not in allowlist`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Correlation-Id'],
  })
)

// ── Body parsing ──────────────────────────────────────────────────────────────
// Raw body must be captured BEFORE express.json() for HMAC signature verification
app.use((req, res, next) => {
  if (req.path.startsWith('/webhook') || req.path.startsWith('/api/whatsapp/webhook')) {
    express.raw({ type: '*/*', limit: '1mb' })(req, res, next)
  } else {
    express.json({ limit: '1mb' })(req, res, next)
  }
})

app.use(cookieParser())

// ── Correlation + Latency Logging ─────────────────────────────────────────────
app.use(correlationMiddleware)
app.use(latencyMiddleware)

// ── HTTP Metrics Middleware ───────────────────────────────────────────────────
app.use((req, res, next) => {
  const t0 = Date.now()
  res.on('finish', () => {
    const route = req.route?.path ?? req.path
    const method = req.method
    const status = String(res.statusCode)
    const ms = Date.now() - t0

    metrics.inc(METRICS.HTTP_REQUESTS_TOTAL, { method, route, status })
    metrics.observe(METRICS.HTTP_REQUEST_DURATION, ms, { method, route })
  })
  next()
})

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook', webhookRoutes)
app.use('/api/internal', internalRoutes)
app.use('/api/scrape', scrapeRoutes)
app.use('/api', apiRoutes)

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    ts: new Date().toISOString(),
    version: process.env.npm_package_version,
    env: process.env.NODE_ENV,
  })
})

// ── Metrics (Prometheus format + JSON circuit breaker summary) ────────────────
app.get('/metrics', async (_req, res) => {
  try {
    // Prometheus text format (for Grafana/Prometheus scraping)
    const acceptsPrometheus = _req.headers.accept?.includes('text/plain')

    if (acceptsPrometheus) {
      res.setHeader('Content-Type', 'text/plain; version=0.0.4')
      res.send(renderPrometheusMetrics())
      return
    }

    // JSON format (for /health dashboards and internal monitoring)
    const { getAllQueueMetrics } = await import('./services/queue.enterprise.js')
    const [queueStats, cbStats] = await Promise.all([
      getAllQueueMetrics().catch(() => []),
      Promise.resolve(getAllCircuitStats()),
    ])

    res.json({
      queues: queueStats,
      circuitBreakers: cbStats,
      ts: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({ error: 'Metrics unavailable' })
  }
})

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── Error Handler (Sentry then generic) ──────────────────────────────────────
app.use(await sentryErrorHandler())

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled server exception', { err: err.message, stack: err.stack })
  const status = (err as NodeJS.ErrnoException).code === 'CORS' ? 403 : 500
  res.status(status).json({
    error: 'Internal server error',
    code: 'GENERIC_ERROR',
  })
})

// ── HTTP + WebSocket Server ───────────────────────────────────────────────────
const httpServer = createServer(app)
export let io: Awaited<ReturnType<typeof createRealtimeServer>>

export { getQueue } from './services/queue.enterprise.js'

  // ── Boot Sequence ──────────────────────────────────────────────────────────────
  ; (async () => {
    // 1. Pre-flight: env, schema, Redis connectivity
    await validateStartup()

    // 2. Start WebSocket + Redis adapter
    io = await createRealtimeServer(httpServer)

    // 3. Start Prometheus metrics collection loop
    startQueueMetricsCollection()

    // 4. Bind HTTP
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info('WhatsFlow AI API ready', {
        port: PORT,
        env: process.env.NODE_ENV ?? 'development',
        sentry: !!process.env.SENTRY_DSN,
        metrics: `http://localhost:${PORT}/metrics`,
      })
    })
  })()

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal} — shutting down gracefully…`)

  const { stopQueueMetricsCollection } = await import('./utils/metrics.js')
  stopQueueMetricsCollection()

  const { closeAllQueues } = await import('./services/queue.enterprise.js')
  await closeAllQueues()

  httpServer.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })

  // Force exit after 30s
  setTimeout(() => { process.exit(1) }, 30_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { httpServer }
