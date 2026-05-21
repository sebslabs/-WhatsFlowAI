/**
 * Outbound Message Worker
 *
 * Processes the `whatsapp-outbound` BullMQ queue.
 * Each job represents one message to send via Meta Cloud API.
 *
 * Guarantees:
 *  - Idempotency: idempotency_key in outbound_messages prevents double-sends on retry
 *  - At-least-once: retried up to 5x with exponential backoff
 *  - Delivery tracking: wa_message_id stored after successful send
 *  - DLQ: permanently failed sends moved to dead_letter_queue
 *  - Status reconciliation: outbound_messages.status updated on each attempt
 */

import dotenv from 'dotenv'
dotenv.config()

import { createClient } from '@supabase/supabase-js'
import { WhatsAppService } from '../services/whatsapp.service.js'
import { createWorker, QUEUE_NAMES, moveToDLQ } from '../services/queue.enterprise.js'
import { logger, logStorage } from '../utils/logger.js'
import { generateCorrelationId } from '../utils/logger.js'
import type { OutboundMessageJob } from '../services/queue.enterprise.js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Outbound Worker ───────────────────────────────────────────────────────────

const outboundWorker = createWorker<OutboundMessageJob>(
  QUEUE_NAMES.OUTBOUND,
  async (job) => {
    const data = job.data

    await logStorage.run(
      { correlationId: generateCorrelationId(), tenantId: data.tenantId, ...(job.id ? { jobId: job.id } : {}) },
      async () => {
        logger.info('[outbound] Processing outbound job', {
          idempotencyKey: data.idempotencyKey,
          phone:          data.phoneNumber,
          messageType:    data.messageType,
          attempt:        job.attemptsMade + 1,
        })

        // ── 1. Check idempotency — already sent? ──────────────────────────────
        const { data: existing } = await supabase
          .from('outbound_messages')
          .select('id, status, wa_message_id')
          .eq('idempotency_key', data.idempotencyKey)
          .maybeSingle()

        if (existing?.status === 'sent' || existing?.status === 'delivered') {
          logger.info('[outbound] Skipping — already sent', {
            idempotencyKey: data.idempotencyKey,
            waMessageId:    existing.wa_message_id,
          })
          return
        }

        // ── 2. Mark as "sending" ──────────────────────────────────────────────
        await supabase
          .from('outbound_messages')
          .upsert({
            idempotency_key:  data.idempotencyKey,
            tenant_id:        data.tenantId,
            conversation_id:  data.conversationId,
            phone_number:     data.phoneNumber,
            content:          data.content,
            message_type:     data.messageType,
            status:           'sending',
            attempts:         (existing?.status ? (job.attemptsMade + 1) : 1),
            queued_at:        new Date().toISOString(),
          }, { onConflict: 'idempotency_key' })

        // ── 3. Call Meta Cloud API ────────────────────────────────────────────
        let result
        switch (data.messageType) {
          case 'template':
            result = await WhatsAppService.sendTemplate(
              data.tenantId,
              data.phoneNumber,
              data.templateName!,
              'en_US',
              data.templateParams ? [{ type: 'body', parameters: data.templateParams.map((v) => ({ type: 'text', text: v })) }] : []
            )
            break

          case 'image':
          case 'document':
          case 'video':
          case 'audio':
            result = await WhatsAppService.sendMedia(
              data.tenantId,
              data.phoneNumber,
              data.messageType,
              data.mediaUrl!,
              data.content,
            )
            break

          default:  // text
            result = await WhatsAppService.sendText(
              data.tenantId,
              data.phoneNumber,
              data.content
            )
        }

        // ── 4. Update outbound record with result ─────────────────────────────
        if (result.success) {
          await supabase.from('outbound_messages').update({
            status:       'sent',
            wa_message_id: result.waMessageId,
            sent_at:      new Date().toISOString(),
            last_error:   null,
          }).eq('idempotency_key', data.idempotencyKey)

          // Update the existing AI/agent message with the wa_message_id to avoid duplicates
          const { data: matchedMsg } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', data.conversationId)
            .is('wa_message_id', null)
            .eq('content', data.content)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (matchedMsg) {
            await supabase.from('messages').update({
              wa_message_id: result.waMessageId,
              delivery_status: 'sent'
            }).eq('id', matchedMsg.id)
          } else {
            // Fallback just in case caller didn't insert
            await supabase.from('messages').insert({
              tenant_id:       data.tenantId,
              conversation_id: data.conversationId,
              sender_type:     'ai',
              content:         data.content,
              message_type:    data.messageType === 'template' ? 'template' : 'text',
              wa_message_id:   result.waMessageId,
              delivery_status: 'sent',
            })
          }

          logger.info('[outbound] Message sent successfully', {
            waMessageId: result.waMessageId,
            phone:       data.phoneNumber,
          })
        } else {
          // Record failure, will be retried by BullMQ
          await supabase.from('outbound_messages').update({
            status:     'failed',
            last_error: result.error,
            attempts:   job.attemptsMade + 1,
          }).eq('idempotency_key', data.idempotencyKey)

          // Determine if retryable
          const isRateLimit = result.statusCode === 429
          const isFatal     = result.statusCode === 400 || result.statusCode === 401

          if (isFatal) {
            // Don't retry — immediately DLQ
            logger.error('[outbound] Fatal error — moving to DLQ', {
              statusCode: result.statusCode,
              error:      result.error,
            })
            throw Object.assign(new Error(result.error ?? 'Fatal API error'), { fatal: true })
          }

          if (isRateLimit) {
            logger.warn('[outbound] Rate limited by Meta — will retry with backoff')
          }

          throw new Error(result.error ?? 'Send failed')
        }
      }
    )
  },
  {
    concurrency: parseInt(process.env.OUTBOUND_CONCURRENCY ?? '3', 10),
    limiter: {
      max:      parseInt(process.env.OUTBOUND_RATE_LIMIT ?? '30', 10),
      duration: 1_000,  // 30 outbound messages/sec max (WhatsApp Cloud API rate limit ~80/sec per number)
    },
  }
)

// ── Delivery Status Webhook Handler ──────────────────────────────────────────
// Called by webhook.worker when Meta sends a delivery/read status update

export async function handleDeliveryStatusUpdate(
  waMessageId: string,
  status:       'sent' | 'delivered' | 'read' | 'failed',
  timestamp:    string
): Promise<void> {
  // Update outbound_messages
  const { error: outboundErr } = await supabase
    .from('outbound_messages')
    .update({ status, delivered_at: status === 'delivered' ? timestamp : undefined })
    .eq('wa_message_id', waMessageId)

  // Update messages.delivery_status
  const { error: msgErr } = await supabase
    .from('messages')
    .update({ delivery_status: status })
    .eq('wa_message_id', waMessageId)

  if (outboundErr) logger.warn('[outbound] Failed to update outbound status', { waMessageId, error: outboundErr.message })
  if (msgErr)      logger.warn('[outbound] Failed to update message delivery status', { waMessageId, error: msgErr.message })
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  logger.info('[outbound-worker] Shutting down gracefully…')
  await outboundWorker.close()
  logger.info('[outbound-worker] Shutdown complete')
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

logger.info('[outbound-worker] Started', {
  concurrency:  process.env.OUTBOUND_CONCURRENCY ?? '3',
  rateLimit:    process.env.OUTBOUND_RATE_LIMIT ?? '30',
})

export { outboundWorker }
