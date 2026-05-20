/**
 * Enterprise BullMQ Queue Configuration
 *
 * Architecture:
 *  - Main queue:      whatsapp-messages  (incoming webhooks)
 *  - Outbound queue:  whatsapp-outbound  (sending messages back)
 *  - DLQ:             whatsapp-dlq       (permanently failed jobs)
 *  - Reconcile queue: reconciliation     (delivery status checks)
 *
 * Guarantees:
 *  - At-least-once delivery (via BullMQ retries)
 *  - Deduplication (jobId = Meta messageId)
 *  - DLQ for manual inspection of permanently failed jobs
 *  - Exponential backoff: 2s → 4s → 8s → 16s → 32s (max 5 attempts)
 *  - Stalled job recovery: jobs not acked within 30s are re-queued
 */

import { Queue, Worker, QueueEvents, type QueueOptions, type WorkerOptions } from 'bullmq'
import { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'

// ── Queue Names ───────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  INBOUND:       'whatsapp-messages',
  OUTBOUND:      'whatsapp-outbound',
  DLQ:           'whatsapp-dlq',
  RECONCILE:     'reconciliation',
} as const

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]

// ── Redis Connection Factory ──────────────────────────────────────────────────

let _connection: Redis | null = null

export function getRedisConnection(): Redis {
  if (_connection) return _connection

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  _connection = new Redis(url, {
    maxRetriesPerRequest: null,   // Required by BullMQ
    enableReadyCheck:     false,
    tls: url.startsWith('rediss://') ? {} : undefined,
    reconnectOnError: (err) => {
      logger.warn('[redis] Reconnecting after error', { err: err.message })
      return true
    },
  })

  _connection.on('error', (err) => logger.error('[redis] Connection error', { err: err.message }))
  _connection.on('connect', () => logger.info('[redis] Connected'))
  _connection.on('reconnecting', () => logger.warn('[redis] Reconnecting…'))

  return _connection
}

// ── Default Job Options ───────────────────────────────────────────────────────

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 2_000,  // 2s → 4s → 8s → 16s → 32s
  },
  removeOnComplete: { count: 500, age: 7 * 24 * 3600 },  // Keep 500 or 7 days
  removeOnFail:     { count: 0  },                         // Keep ALL failures for DLQ inspection
}

// ── Queue Factories ───────────────────────────────────────────────────────────

const _queues = new Map<string, Queue>()

export function getQueue(name: QueueName): Queue {
  if (_queues.has(name)) return _queues.get(name)!

  const opts: QueueOptions = {
    connection: getRedisConnection(),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }

  const q = new Queue(name, opts)
  _queues.set(name, q)

  logger.info(`[queue] Queue '${name}' initialized`)
  return q
}

// ── Worker Factory ────────────────────────────────────────────────────────────

export function createWorker<T>(
  name: QueueName,
  processor: (job: import('bullmq').Job<T>) => Promise<void>,
  opts?: Partial<WorkerOptions>
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection:  getRedisConnection(),
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '5', 10),
    limiter: {
      max:      parseInt(process.env.WORKER_RATE_LIMIT ?? '50', 10),
      duration: 1_000,
    },
    stalledInterval: 30_000,   // Recover stalled jobs every 30s
    maxStalledCount: 2,        // After 2 stalls, treat as failure
    ...opts,
  })

  // Standard lifecycle logging
  worker.on('completed', (job) => {
    logger.info(`[worker:${name}] Job completed`, { jobId: job.id, attempts: job.attemptsMade })
  })

  worker.on('failed', async (job, err) => {
    logger.error(`[worker:${name}] Job failed`, {
      jobId:    job?.id,
      attempts: job?.attemptsMade,
      err:      err.message,
      data:     job?.data,
    })

    // If max attempts exhausted → move to DLQ
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      await moveToDLQ(job, err, name)
    }
  })

  worker.on('stalled', (jobId) => {
    logger.warn(`[worker:${name}] Job stalled`, { jobId })
  })

  worker.on('error', (err) => {
    logger.error(`[worker:${name}] Worker error`, { err: err.message })
  })

  return worker
}

// ── Dead-Letter Queue ─────────────────────────────────────────────────────────

export interface DLQEntry {
  originalQueue: string
  jobId:         string | undefined
  jobData:       unknown
  errorMessage:  string
  errorStack:    string | undefined
  attempts:      number
  failedAt:      string
}

export async function moveToDLQ(
  job: import('bullmq').Job,
  err: Error,
  sourceQueue: string
): Promise<void> {
  const dlq = getQueue(QUEUE_NAMES.DLQ)
  const entry: DLQEntry = {
    originalQueue: sourceQueue,
    jobId:         job.id,
    jobData:       job.data,
    errorMessage:  err.message,
    errorStack:    err.stack,
    attempts:      job.attemptsMade,
    failedAt:      new Date().toISOString(),
  }

  await dlq.add('dead-letter', entry, {
    jobId:            `dlq-${sourceQueue}-${job.id}-${Date.now()}`,
    attempts:         1,
    removeOnComplete: false,
    removeOnFail:     false,
  })

  logger.error('[dlq] Job moved to dead-letter queue', {
    sourceQueue,
    jobId:  job.id,
    reason: err.message,
  })
}

// ── Queue Metrics ─────────────────────────────────────────────────────────────

export interface QueueMetrics {
  queue:      string
  waiting:    number
  active:     number
  completed:  number
  failed:     number
  delayed:    number
  paused:     number
}

export async function getQueueMetrics(name: QueueName): Promise<QueueMetrics> {
  const q = getQueue(name)

  // getJobCounts() returns all states in a single Redis roundtrip.
  // getPausedCount() does not exist in this version of BullMQ —
  // paused is included in the getJobCounts() result object.
  const counts = await q.getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed',
    'paused',
  )

  return {
    queue:     name,
    waiting:   counts.waiting   ?? 0,
    active:    counts.active    ?? 0,
    completed: counts.completed ?? 0,
    failed:    counts.failed    ?? 0,
    delayed:   counts.delayed   ?? 0,
    paused:    counts.paused    ?? 0,
  }
}

export async function getAllQueueMetrics(): Promise<QueueMetrics[]> {
  return Promise.all(Object.values(QUEUE_NAMES).map(getQueueMetrics))
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

export async function closeAllQueues(): Promise<void> {
  logger.info('[queue] Closing all queues…')
  await Promise.all([..._queues.values()].map((q) => q.close()))
  if (_connection) await _connection.quit()
  logger.info('[queue] All queues closed')
}

// ── Enqueue Helpers ───────────────────────────────────────────────────────────

export { type WebhookJobData } from './queue.service.js'

export async function enqueueInbound(data: import('./queue.service.js').WebhookJobData): Promise<string> {
  const q = getQueue(QUEUE_NAMES.INBOUND)
  const job = await q.add('process-message', data, {
    jobId: data.messageId,  // Deduplication via Meta message ID
  })
  return job.id!
}

export interface OutboundMessageJob {
  tenantId:        string
  phoneNumber:     string
  content:         string
  messageType:     'text' | 'image' | 'document' | 'video' | 'audio' | 'template'
  mediaUrl?:       string
  templateName?:   string
  templateParams?: string[]
  conversationId:  string
  waAccountId:     string
  idempotencyKey:  string  // prevents double-sends on retry
}

export async function enqueueOutbound(data: OutboundMessageJob): Promise<string> {
  const q = getQueue(QUEUE_NAMES.OUTBOUND)
  const job = await q.add('send-message', data, {
    jobId: data.idempotencyKey,  // Deduplicate outbound sends
  })
  return job.id!
}

// ── Replay Failed DLQ Jobs ────────────────────────────────────────────────────

export async function replayDLQJob(dlqJobId: string): Promise<void> {
  const dlq = getQueue(QUEUE_NAMES.DLQ)
  const job = await dlq.getJob(dlqJobId)
  if (!job) throw new Error(`DLQ job ${dlqJobId} not found`)

  const entry = job.data as DLQEntry
  const targetQueue = getQueue(entry.originalQueue as QueueName)

  await targetQueue.add('replayed-job', entry.jobData, {
    jobId: `replay-${dlqJobId}-${Date.now()}`,
    attempts: 5,
  })

  await job.remove()
  logger.info('[dlq] Job replayed from DLQ', { dlqJobId, targetQueue: entry.originalQueue })
}
