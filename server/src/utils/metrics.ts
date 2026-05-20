/**
 * Prometheus Metrics Service
 *
 * Exposes metrics at GET /metrics (Prometheus text format)
 * Compatible with Grafana + Prometheus scraping.
 *
 * Tracks:
 *  - HTTP request duration by route + status
 *  - Queue depth per queue name
 *  - AI requests by provider + outcome
 *  - WhatsApp send success/failure rate
 *  - Circuit breaker state per service
 *  - Active WebSocket connections
 *  - DB query latency (manual instrumentation)
 *
 * Zero external deps — hand-rolled Prometheus format.
 * Drop-in replacement when you add prom-client later.
 */

// ── Metric Types ──────────────────────────────────────────────────────────────

interface Counter  { value: number; labels: Record<string, string> }
interface Gauge    { value: number; labels: Record<string, string> }
interface Histogram {
  sum: number; count: number; buckets: Map<number, number>
  labels: Record<string, string>
}

const counters   = new Map<string, Counter[]>()
const gauges     = new Map<string, Gauge[]>()
const histograms = new Map<string, Histogram[]>()

const HTTP_BUCKETS  = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
const QUEUE_BUCKETS = [10, 25, 50, 100, 250, 500, 1000, 2500]

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelKey(labels: Record<string, string>): string {
  return Object.entries(labels).map(([k, v]) => `${k}="${v}"`).join(',')
}

function findOrCreate<T>(
  store: Map<string, T[]>,
  name:  string,
  labels: Record<string, string>,
  create: () => T
): T {
  let items = store.get(name)
  if (!items) { items = []; store.set(name, items) }
  const key = labelKey(labels)
  let item = items.find((i) => labelKey((i as unknown as { labels: Record<string, string> }).labels) === key)
  if (!item) { item = create(); items.push(item) }
  return item
}

// ── Public API ────────────────────────────────────────────────────────────────

export const metrics = {
  /** Increment a counter */
  inc(name: string, labels: Record<string, string> = {}, value = 1): void {
    const c = findOrCreate<Counter>(counters, name, labels, () => ({ value: 0, labels }))
    c.value += value
  },

  /** Set a gauge */
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const g = findOrCreate<Gauge>(gauges, name, labels, () => ({ value: 0, labels }))
    g.value = value
  },

  /** Record a duration in ms to a histogram */
  observe(name: string, ms: number, labels: Record<string, string> = {}, buckets = HTTP_BUCKETS): void {
    const h = findOrCreate<Histogram>(histograms, name, labels, () => ({
      sum: 0, count: 0,
      buckets: new Map(buckets.map((b) => [b, 0])),
      labels,
    }))
    h.sum += ms
    h.count++
    for (const [le, _] of h.buckets) {
      if (ms <= le) h.buckets.set(le, (h.buckets.get(le) ?? 0) + 1)
    }
  },

  /** Time an async function and record result */
  async timed<T>(
    name:   string,
    fn:     () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const t0 = Date.now()
    try {
      const result = await fn()
      metrics.observe(name, Date.now() - t0, { ...labels, outcome: 'success' })
      return result
    } catch (err) {
      metrics.observe(name, Date.now() - t0, { ...labels, outcome: 'error' })
      throw err
    }
  },
}

// ── Prometheus Text Format Serializer ─────────────────────────────────────────

function formatLabels(labels: Record<string, string>): string {
  const parts = Object.entries(labels).map(([k, v]) => `${k}="${v}"`)
  return parts.length ? `{${parts.join(',')}}` : ''
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = []

  // Counters
  for (const [name, items] of counters) {
    lines.push(`# TYPE ${name} counter`)
    for (const { value, labels } of items) {
      lines.push(`${name}${formatLabels(labels)} ${value}`)
    }
  }

  // Gauges
  for (const [name, items] of gauges) {
    lines.push(`# TYPE ${name} gauge`)
    for (const { value, labels } of items) {
      lines.push(`${name}${formatLabels(labels)} ${value}`)
    }
  }

  // Histograms
  for (const [name, items] of histograms) {
    lines.push(`# TYPE ${name} histogram`)
    for (const { sum, count, buckets, labels } of items) {
      for (const [le, val] of buckets) {
        lines.push(`${name}_bucket${formatLabels({ ...labels, le: String(le) })} ${val}`)
      }
      lines.push(`${name}_bucket${formatLabels({ ...labels, le: '+Inf' })} ${count}`)
      lines.push(`${name}_sum${formatLabels(labels)} ${sum}`)
      lines.push(`${name}_count${formatLabels(labels)} ${count}`)
    }
  }

  return lines.join('\n') + '\n'
}

// ── Pre-defined Metric Names ──────────────────────────────────────────────────

export const METRICS = {
  // HTTP
  HTTP_REQUEST_DURATION: 'http_request_duration_ms',
  HTTP_REQUESTS_TOTAL:   'http_requests_total',

  // Queue
  QUEUE_DEPTH:           'bullmq_queue_depth',
  QUEUE_PROCESSED:       'bullmq_jobs_processed_total',
  QUEUE_FAILED:          'bullmq_jobs_failed_total',
  QUEUE_DLQ_SIZE:        'bullmq_dlq_size',

  // WhatsApp
  WA_SEND_TOTAL:         'whatsapp_send_total',
  WA_SEND_LATENCY:       'whatsapp_send_latency_ms',

  // AI
  AI_REQUESTS_TOTAL:     'ai_requests_total',
  AI_LATENCY:            'ai_request_latency_ms',
  AI_TOKENS_USED:        'ai_tokens_used_total',

  // Circuit Breakers
  CB_STATE:              'circuit_breaker_state',
  CB_FAILURES:           'circuit_breaker_failures_total',

  // WebSocket
  WS_CONNECTIONS:        'websocket_connections_active',

  // DB
  DB_QUERY_LATENCY:      'db_query_latency_ms',
} as const

// ── Express Route Handler ─────────────────────────────────────────────────────

export function metricsHandler() {
  return (_req: unknown, res: { setHeader: Function; end: Function }) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    res.end(renderPrometheusMetrics())
  }
}

// ── Periodic Queue Metrics Collection ────────────────────────────────────────

let _metricsInterval: ReturnType<typeof setInterval> | null = null

export function startQueueMetricsCollection(): void {
  if (_metricsInterval) return

  _metricsInterval = setInterval(async () => {
    try {
      const { getAllQueueMetrics } = await import('../services/queue.enterprise.js')
      const queueStats = await getAllQueueMetrics()

      for (const q of queueStats) {
        metrics.set(METRICS.QUEUE_DEPTH, q.waiting, { queue: q.queue, state: 'waiting' })
        metrics.set(METRICS.QUEUE_DEPTH, q.active,  { queue: q.queue, state: 'active' })
        metrics.set(METRICS.QUEUE_DEPTH, q.delayed, { queue: q.queue, state: 'delayed' })
      }

      // Circuit breaker states (encode as gauge: 0=CLOSED, 1=HALF_OPEN, 2=OPEN)
      const { getAllCircuitStats } = await import('./circuit-breaker.js')
      const cbStats = getAllCircuitStats()
      const stateMap: Record<string, number> = { CLOSED: 0, HALF_OPEN: 1, OPEN: 2 }

      for (const cb of cbStats) {
        metrics.set(METRICS.CB_STATE,    stateMap[cb.state] ?? 0,  { service: cb.name })
        metrics.set(METRICS.CB_FAILURES, cb.failures,              { service: cb.name })
      }
    } catch {
      // Metrics collection should never throw — log silently
    }
  }, 15_000)  // Every 15 seconds
}

export function stopQueueMetricsCollection(): void {
  if (_metricsInterval) {
    clearInterval(_metricsInterval)
    _metricsInterval = null
  }
}
