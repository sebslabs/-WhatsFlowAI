/**
 * WhatsApp webhook controller.
 *
 * GET  /webhook — Meta's one-time verification handshake
 * POST /webhook — Incoming messages (signature-verified, then enqueued)
 *
 * CRITICAL: Do NOT process messages synchronously here.
 * Meta requires a 200 within 5 s or it retries → duplicate messages.
 * We verify the signature, enqueue the job, and return 200 immediately.
 * The webhook.worker.ts process handles AI and DB writes asynchronously.
 */

import type { Request, Response } from 'express'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { enqueueWebhookMessage, type WebhookJobData } from '../services/queue.service.js'

const adminDb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyHmacSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) {
    console.error('[webhook] META_APP_SECRET is not set — cannot verify signatures')
    return false
  }
  if (!signatureHeader?.startsWith('sha256=')) return false

  const received = signatureHeader.slice(7)
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

export class WebhookController {
  /** Meta webhook verification handshake */
  static async verify(req: Request, res: Response): Promise<void> {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const tenantId  = req.query['tenantId'] as string | undefined

    let verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

    // Look up custom verify token if tenantId is passed
    if (tenantId) {
      try {
        const { data } = await adminDb
          .from('whatsapp_accounts')
          .select('verify_token')
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (data?.verify_token) {
          verifyToken = data.verify_token
        }
      } catch (err) {
        console.error('[webhook-verify] Tenant lookup failed:', err)
      }
    }

    if (!verifyToken) {
      console.error('[webhook] No verification token configured')
      res.sendStatus(503)
      return
    }

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('[webhook] Meta verification handshake accepted', { tenantId: tenantId ?? 'global' })
      res.status(200).send(challenge)
      return
    }

    console.warn('[webhook] Verification failed — token mismatch or invalid mode', { tenantId: tenantId ?? 'global' })
    res.sendStatus(403)
  }

  /** Incoming message handler — verify → enqueue → 200 */
  static async handle(req: Request, res: Response): Promise<void> {
    // 1. Verify HMAC signature using raw buffer (set by express.raw() in index.ts)
    const rawBody = req.body as Buffer
    const signature = req.headers['x-hub-signature-256'] as string | undefined

    if (!verifyHmacSignature(rawBody, signature)) {
      console.warn('[webhook] Spoofed request rejected — invalid HMAC signature')
      res.sendStatus(403)
      return
    }

    // 2. Return 200 immediately — Meta only waits 5 seconds
    // We send the response BEFORE processing to prevent retries
    res.sendStatus(200)

    // 3. Parse after the response is sent (errors here don't affect the 200)
    try {
      const payload = JSON.parse(rawBody.toString('utf-8'))

      if (payload.object !== 'whatsapp_business_account') return

      const entry   = payload.entry?.[0]
      const changes = entry?.changes?.[0]
      const value   = changes?.value
      const message = value?.messages?.[0]

      if (!message) return

      // Extract phone_number_id — required to resolve tenant from whatsapp_accounts
      const phoneNumberId: string | null = value?.metadata?.phone_number_id ?? null

      const jobData: WebhookJobData = {
        messageId:    message.id,
        from:         message.from,
        text:         message.text?.body ?? '',
        timestamp:    new Date(parseInt(message.timestamp, 10) * 1000).toISOString(),
        phoneNumberId,                   // Used by worker to look up whatsapp_accounts
        rawPayload:   payload,
      }

      // 4. Enqueue — BullMQ deduplicates by messageId so Meta retries are safe
      const jobId = await enqueueWebhookMessage(jobData)
      console.log(`[webhook] Message ${jobData.messageId} enqueued as job ${jobId}`)
    } catch (err) {
      // Log but do not re-send — the 200 is already sent
      console.error('[webhook] Failed to parse or enqueue message:', err)
    }
  }
}
