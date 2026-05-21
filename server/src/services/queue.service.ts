/**
 * Webhook message queue using BullMQ + Redis.
 *
 * Why queues are mandatory for WhatsApp webhooks:
 *   1. Meta requires a 200 response within 5 seconds or it retries.
 *   2. AI inference (OpenAI/Gemini) can take 3-15 seconds.
 *   3. A slow DB or AI call would cause Meta to retry → duplicate messages.
 *   4. Queues provide retry logic, backpressure, and dead-letter handling.
 *
 * Flow:
 *   Webhook POST → validate signature → enqueue job → return 200 immediately
 *   Worker (separate process) → dequeue → process AI → write to DB → send reply
 *
 * Install: npm i bullmq ioredis
 * Set env: REDIS_URL (e.g. redis://localhost:6379 or Upstash TLS URL)
 */

import { Queue } from 'bullmq'
import type { QueueOptions } from 'bullmq'
import { Redis } from 'ioredis'

export interface WebhookJobData {
  /** Unique message ID from Meta (for deduplication + webhook_events idempotency) */
  messageId: string
  /** WhatsApp sender phone number (E.164 format) */
  from: string
  /** Message text content */
  text: string
  /** ISO timestamp from Meta */
  timestamp: string
  /** Meta phone_number_id — resolves tenant from whatsapp_accounts table */
  phoneNumberId: string | null
  /** Pre-resolved tenant UUID (short-circuit if known) */
  tenantId?: string
  /** Raw Meta payload for audit/debug */
  rawPayload: Record<string, unknown>
}

const QUEUE_NAME = 'whatsapp-messages'

function createRedisConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  return new Redis(url, {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    tls: url.startsWith('rediss://') ? {} : undefined,
  })
}

let _queue: Queue<WebhookJobData> | null = null

export function getMessageQueue(): Queue<WebhookJobData> {
  if (_queue) return _queue

  const connection = createRedisConnection()

  const opts: QueueOptions = {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000, // Start at 2s, double each retry: 2s, 4s, 8s, 16s, 32s
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  }

  _queue = new Queue<WebhookJobData>(QUEUE_NAME, opts)
  return _queue
}

/**
 * Enqueue an incoming WhatsApp message for async processing.
 * Call this from the webhook handler — do NOT process inline.
 */
export async function enqueueWebhookMessage(data: WebhookJobData): Promise<string> {
  const queue = getMessageQueue()

  const job = await queue.add('process-message', data, {
    // Use Meta's message ID as the job ID for natural deduplication
    jobId: data.messageId,
    // Deduplicate: if the same messageId arrives twice, BullMQ silently skips
    // This prevents double-processing when Meta retries after a slow response
  })

  return job.id!
}

export { QUEUE_NAME }
