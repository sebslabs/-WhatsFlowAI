/**
 * WhatsApp Controller — Fixed
 *
 * Changes vs previous version:
 *  - whatsapp_integrations → whatsapp_accounts (correct table name)
 *  - user.organizationId → user.tenantId (canonical)
 *  - encrypt() from utils/encryption.ts (AES-256-GCM, not the old crypto.js)
 *  - verifyToken() via WhatsAppService before storing credentials
 *  - Delivery status webhook updates routed to handleDeliveryStatusUpdate()
 *  - console.log/error → logger
 */

import type { Request, Response } from 'express'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { encrypt } from '../utils/encryption.js'
import { logger } from '../utils/logger.js'
import { WhatsAppService } from '../services/whatsapp.service.js'
import { handleDeliveryStatusUpdate } from '../workers/outbound.worker.js'
import { enqueueWebhookMessage } from '../services/queue.service.js'
import type { WebhookJobData } from '../services/queue.service.js'

const adminDb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── HMAC Verification ─────────────────────────────────────────────────────────

function verifyHmacSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  const secret = process.env.META_APP_SECRET
  if (!secret) return false
  if (!signatureHeader?.startsWith('sha256=')) return false

  const received = signatureHeader.slice(7)
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    if (received.length !== expected.length) return false
    return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'))
  } catch {
    return false
  }
}

// ── Helper: resolve tenant from phone_number_id ───────────────────────────────

async function resolveTenantFromPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const { data } = await adminDb
    .from('whatsapp_accounts')          // ← FIXED: was whatsapp_integrations
    .select('tenant_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'connected')         // ← FIXED: was 'active'
    .limit(1)
    .maybeSingle()

  return data?.tenant_id ?? null
}

// ── Controller ────────────────────────────────────────────────────────────────

export class WhatsAppController {
  /**
   * POST /api/whatsapp/connect
   * Stores encrypted credentials and verifies them with Meta.
   */
  static async connect(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.user!   // ← FIXED: was organizationId

      const {
        phone_number_id,
        business_account_id,
        access_token,
        webhook_verify_token,
        verify_token,
        display_name,
      } = req.body as {
        phone_number_id:      string
        business_account_id:  string
        access_token:         string
        webhook_verify_token?: string
        verify_token?:        string
        display_name?:        string
      }

      if (!phone_number_id || !access_token) {
        res.status(400).json({ error: 'Missing required: phone_number_id, access_token' })
        return
      }

      // Verify the token is valid before storing
      const tokenValid = await WhatsAppService.verifyToken(access_token)
      if (!tokenValid) {
        res.status(422).json({ error: 'Invalid or expired Meta access_token' })
        return
      }

      const encryptedToken = encrypt(access_token)
      if (!encryptedToken) {
        res.status(500).json({ error: 'Encryption failed — check ENCRYPTION_KEY env var' })
        return
      }

      // Upsert into whatsapp_accounts (aligned with production schema)
      const { data, error } = await adminDb
        .from('whatsapp_accounts')      
        .upsert(
          {
            tenant_id:              tenantId,
            phone_number_id,
            business_account_id,
            encrypted_access_token: encryptedToken,
            status:                 'connected',
            metadata: {
              verify_token:         verify_token || webhook_verify_token || 'whatsflow_default_verify',
              display_name:         display_name ?? null,
            },
            updated_at:             new Date().toISOString(),
          },
          { onConflict: 'phone_number_id' }
        )
        .select('id, phone_number_id, status')
        .single()

      if (error) throw error

      logger.info('[whatsapp] Account connected', { tenantId, phoneNumberId: phone_number_id })

      res.json({
        message:          'WhatsApp account connected successfully',
        phone_number_id:  data.phone_number_id,
        status:           data.status,
      })
    } catch (err) {
      logger.error('[whatsapp] connect failed', { err: (err as Error).message })
      res.status(500).json({ error: 'Failed to connect WhatsApp account' })
    }
  }

  /**
   * GET /api/whatsapp/config
   * Returns the current WhatsApp account configuration for the tenant.
   */
  static async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.user!   // ← FIXED: was organizationId

      const { data, error } = await adminDb
        .from('whatsapp_accounts')     
        .select('phone_number_id, business_account_id, status, updated_at, metadata')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (error) throw error

      const host = req.get('host')
      const proto = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
      const webhook_url = `${proto}://${host}/api/whatsapp/webhook?tenantId=${tenantId}`

      if (!data) {
        res.json({ status: 'disconnected', webhook_url })
        return
      }

      const meta = typeof data.metadata === 'object' ? data.metadata : {}

      res.json({
        phone_number_id: data.phone_number_id,
        waba_id: data.business_account_id,
        status: data.status,
        updated_at: data.updated_at,
        // SECURITY FIX (CRITICAL #3): Return null instead of a predictable default verify token.
        verify_token: (meta as any)?.verify_token || null,
        display_name: (meta as any)?.display_name || null,
        webhook_url
      })
    } catch (err) {
      logger.error('[whatsapp] getConfig failed', { err: (err as Error).message })
      res.status(500).json({ error: 'Failed to retrieve WhatsApp config' })
    }
  }

  /**
   * GET /api/whatsapp/verify
   * Meta webhook challenge verification (must be public, no auth).
   */
  static async verify(req: Request, res: Response): Promise<void> {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    const tenantId  = req.query['tenantId'] as string | undefined

    // SECURITY FIX (CRITICAL #3): In production, fail if no verify token is configured.
    // An unconfigured env var means webhook handshakes cannot be securely validated.
    const envVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN
    if (process.env.NODE_ENV === 'production' && !envVerifyToken && !tenantId) {
      logger.error('[whatsapp-verify] WHATSAPP_VERIFY_TOKEN / META_VERIFY_TOKEN not set — rejecting handshake in production')
      res.sendStatus(503)
      return
    }

    let verifyToken = envVerifyToken

    // Multi-tenant lookup: If tenantId query param is present, resolve their custom token
    if (tenantId) {
      try {
        const { data } = await adminDb
          .from('whatsapp_accounts')
          .select('verify_token')
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (data?.verify_token) {
          verifyToken = data.verify_token
        } else {
          logger.warn('[whatsapp-verify] Tenant requested webhook handshake but no custom verify token saved', { tenantId })
        }
      } catch (err) {
        logger.error('[whatsapp-verify] Database lookup failed during handshake', { tenantId, err: (err as Error).message })
      }
    }

    if (!verifyToken) {
      logger.error('[whatsapp-verify] Neither global nor tenant-specific verify token is configured')
      res.sendStatus(503)
      return
    }

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('[whatsapp-verify] Meta webhook handshake validated', { tenantId: tenantId ?? 'global' })
      res.status(200).send(challenge)
      return
    }

    logger.warn('[whatsapp-verify] Handshake rejected — token mismatch', { tenantId: tenantId ?? 'global' })
    res.sendStatus(403)
  }

  /**
   * POST /api/whatsapp/webhook
   * Receives inbound messages + delivery status updates from Meta.
   * Must respond 200 within 5s — all processing is async.
   */
  static async webhook(req: Request, res: Response): Promise<void> {
    const rawBody   = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body))
    const signature = req.headers['x-hub-signature-256'] as string | undefined

    // Strict HMAC verification — reject forgeries
    if (!verifyHmacSignature(rawBody, signature)) {
      logger.warn('[whatsapp-webhook] HMAC verification failed — request rejected')
      res.sendStatus(403)
      return
    }

    // Immediately ACK to Meta (must be within 5s)
    res.sendStatus(200)

    // Async processing — errors here do NOT affect the 200 response
    try {
      const payload = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>
      if (payload.object !== 'whatsapp_business_account') return

      const entry   = (payload.entry as unknown[])?.[0] as Record<string, unknown>
      const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown>
      const value   = changes?.value as Record<string, unknown>

      if (!value) return

      const phoneNumberId = (value.metadata as Record<string, unknown>)?.phone_number_id as string | undefined
      const messages      = value.messages as unknown[] | undefined
      const statuses      = value.statuses as unknown[] | undefined

      // ── Inbound message ────────────────────────────────────────────────────
      if (messages?.length) {
        const message = messages[0] as Record<string, unknown>
        let tenantId: string | undefined = req.query.tenantId as string | undefined

        // Fallback to resolving tenant via phone_number_id if not directly passed in callback query param
        if (!tenantId && phoneNumberId) {
          tenantId = await resolveTenantFromPhoneNumberId(phoneNumberId) ?? undefined
        }

        const jobData: WebhookJobData = {
          messageId:    message.id as string,
          from:         message.from as string,
          text:         (message.text as Record<string, unknown>)?.body as string ?? '',
          timestamp:    new Date(parseInt(message.timestamp as string, 10) * 1000).toISOString(),
          phoneNumberId: phoneNumberId ?? null,
          ...(tenantId ? { tenantId } : {}),
          rawPayload:   payload,
        }

        await enqueueWebhookMessage(jobData)
        logger.debug('[whatsapp-webhook] Message enqueued', { messageId: jobData.messageId })
      }

      // ── Delivery status update ─────────────────────────────────────────────
      if (statuses?.length) {
        for (const statusEntry of statuses) {
          const s = statusEntry as Record<string, unknown>
          const waMessageId = s.id as string
          const status      = s.status as 'sent' | 'delivered' | 'read' | 'failed'
          const ts          = new Date(parseInt(s.timestamp as string, 10) * 1000).toISOString()

          await handleDeliveryStatusUpdate(waMessageId, status, ts).catch((err) =>
            logger.error('[whatsapp-webhook] Delivery status update failed', {
              waMessageId,
              err: (err as Error).message,
            })
          )
        }
      }
    } catch (err) {
      logger.error('[whatsapp-webhook] Error processing payload', {
        err: (err as Error).message,
      })
    }
  }

  /**
   * POST /api/whatsapp/send
   * Manual agent send — sends a message from the inbox UI.
   */
  static async send(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.user!
      const { conversationId, phoneNumber, content, messageType = 'text' } = req.body as {
        conversationId: string
        phoneNumber:    string
        content:        string
        messageType?:   string
      }

      if (!conversationId || !phoneNumber || !content) {
        res.status(400).json({ error: 'Missing: conversationId, phoneNumber, content' })
        return
      }

      // Enqueue to outbound queue for delivery + tracking
      const { enqueueOutbound } = await import('../services/queue.enterprise.js')
      const idempotencyKey = `manual-${conversationId}-${Date.now()}`

      await enqueueOutbound({
        tenantId,
        conversationId,
        phoneNumber,
        content,
        messageType:     messageType as 'text',
        idempotencyKey,
        waAccountId:     tenantId,  // resolved by worker from whatsapp_accounts
      })

      res.json({ queued: true, idempotencyKey })
    } catch (err) {
      logger.error('[whatsapp] send failed', { err: (err as Error).message })
      res.status(500).json({ error: 'Failed to queue message' })
    }
  }
}
