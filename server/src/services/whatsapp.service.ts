/**
 * WhatsApp Cloud API Service
 *
 * The ONLY file that calls the Meta Graph API.
 * All outbound message sends go through this service.
 *
 * Supports:
 *  - Text messages
 *  - Template messages
 *  - Media messages (image, document, video)
 *  - Mark as read (delivery reconciliation)
 *
 * All sends are idempotent — Meta uses message IDs for dedup on their side.
 * On our side, outbound_messages.idempotency_key prevents double sends on retry.
 */

import { createClient } from '@supabase/supabase-js'
import { decrypt } from '../utils/encryption.js'
import { logger } from '../utils/logger.js'
import { breakers, CircuitOpenError } from '../utils/circuit-breaker.js'

const META_API_VERSION = process.env.META_API_VERSION ?? 'v19.0'
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TextMessage {
  type: 'text'
  body: string
}

export interface TemplateMessage {
  type: 'template'
  templateName: string
  languageCode: string
  components?: unknown[]
}

export interface MediaMessage {
  type: 'image' | 'document' | 'video' | 'audio'
  mediaUrl: string
  caption?: string
  filename?: string
}

export type OutboundPayload = TextMessage | TemplateMessage | MediaMessage

export interface SendResult {
  success: boolean
  waMessageId?: string
  error?: string
  statusCode?: number
}

// ── Token resolution ──────────────────────────────────────────────────────────

const adminDb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WaAccount {
  phone_number_id: string
  encrypted_access_token: string  // AES-256-GCM encrypted
  business_account_id: string | null
}

const accountCache = new Map<string, { account: WaAccount; cachedAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes

async function getAccount(tenantId: string): Promise<WaAccount | null> {
  const cached = accountCache.get(tenantId)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) return cached.account

  const { data, error } = await adminDb
    .from('whatsapp_accounts')       
    .select('phone_number_id, encrypted_access_token, business_account_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected')       
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    logger.warn('[WhatsAppService] No active account for tenant', { tenantId, error: error?.message })
    return null
  }

  accountCache.set(tenantId, { account: data, cachedAt: Date.now() })
  return data
}

/** Invalidate the token cache for a tenant (call after token rotation) */
export function invalidateAccountCache(tenantId: string): void {
  accountCache.delete(tenantId)
}

// ── Meta API Caller ───────────────────────────────────────────────────────────

async function callMetaAPI(
  phoneNumberId: string,
  plainTextToken: string,
  body: Record<string, unknown>
): Promise<SendResult> {
  const url = `${META_BASE_URL}/${phoneNumberId}/messages`

  // Circuit breaker: fast-fail if Meta API is repeatedly failing
  try {
    return await breakers.metaApi.execute(async () => {
      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${plainTextToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
          signal: AbortSignal.timeout(15_000),
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        logger.error('[WhatsAppService] Network error', { url, err: msg })
        throw new Error(`Network error: ${msg}`)  // Let CB count this as a failure
      }

      let json: Record<string, unknown>
      try { json = await response.json() as Record<string, unknown> }
      catch { throw new Error(`Non-JSON response: ${response.status}`) }

      if (!response.ok) {
        const metaErr = (json.error as Record<string, unknown> | undefined)?.message ?? JSON.stringify(json)
        // 4xx = fatal (don't count toward CB), 5xx = transient (count toward CB)
        if (response.status >= 500) throw new Error(String(metaErr))
        return { success: false, error: String(metaErr), statusCode: response.status }
      }

      const messages = json.messages as Array<{ id: string }> | undefined
      const waMessageId = messages?.[0]?.id
      return {
        success: true,
        statusCode: response.status,
        ...(waMessageId !== undefined ? { waMessageId } : {}),
      }
    })
  } catch (err) {
    if (err instanceof CircuitOpenError) {
      logger.warn('[WhatsAppService] Circuit OPEN — skipping Meta API call', { err: err.message })
      return { success: false, error: err.message, statusCode: 503 }
    }
    logger.error('[WhatsAppService] Meta API call failed', { err: (err as Error).message })
    return { success: false, error: (err as Error).message }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export class WhatsAppService {
  /**
   * Send a text message to a WhatsApp number.
   * @param tenantId   Tenant UUID (used to look up the WhatsApp account)
   * @param toPhone    Recipient E.164 phone number (e.g. "14155238886")
   * @param text       Message body (max 4096 chars)
   */
  static async sendText(
    tenantId: string,
    toPhone: string,
    text: string
  ): Promise<SendResult> {
    const account = await getAccount(tenantId)
    if (!account) return { success: false, error: 'No active WhatsApp account for tenant' }

    const plainToken = decrypt(account.encrypted_access_token)
    if (!plainToken) return { success: false, error: 'Failed to decrypt access token' }

    return callMetaAPI(account.phone_number_id, plainToken, {
      recipient_type: 'individual',
      to: toPhone,
      type: 'text',
      text: { preview_url: false, body: text.slice(0, 4096) },
    })
  }

  /**
   * Send a WhatsApp Approved Template message.
   */
  static async sendTemplate(
    tenantId: string,
    toPhone: string,
    templateName: string,
    languageCode: string,
    components: unknown[] = []
  ): Promise<SendResult> {
    const account = await getAccount(tenantId)
    if (!account) return { success: false, error: 'No active WhatsApp account' }

    const plainToken = decrypt(account.encrypted_access_token)
    if (!plainToken) return { success: false, error: 'Failed to decrypt access token' }

    return callMetaAPI(account.phone_number_id, plainToken, {
      recipient_type: 'individual',
      to: toPhone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    })
  }

  /**
   * Send a media message (image, document, video, audio).
   * mediaUrl must be a public HTTPS URL accessible by Meta.
   */
  static async sendMedia(
    tenantId: string,
    toPhone: string,
    mediaType: 'image' | 'document' | 'video' | 'audio',
    mediaUrl: string,
    caption?: string,
    filename?: string
  ): Promise<SendResult> {
    const account = await getAccount(tenantId)
    if (!account) return { success: false, error: 'No active WhatsApp account' }

    const plainToken = decrypt(account.encrypted_access_token)
    if (!plainToken) return { success: false, error: 'Failed to decrypt access token' }

    const mediaObj: Record<string, unknown> = { link: mediaUrl }
    if (caption) mediaObj.caption = caption
    if (filename && mediaType === 'document') mediaObj.filename = filename

    return callMetaAPI(account.phone_number_id, plainToken, {
      recipient_type: 'individual',
      to: toPhone,
      type: mediaType,
      [mediaType]: mediaObj,
    })
  }

  /**
   * Mark a received message as read (improves user experience — shows blue ticks).
   */
  static async markAsRead(
    tenantId: string,
    waMessageId: string
  ): Promise<void> {
    const account = await getAccount(tenantId)
    if (!account) return

    const plainToken = decrypt(account.encrypted_access_token)
    if (!plainToken) return

    await callMetaAPI(account.phone_number_id, plainToken, {
      status: 'read',
      message_id: waMessageId,
    })
  }

  /**
   * Verify that a token is valid by calling the Graph API /me endpoint.
   * Used during WhatsApp account connection flow.
   */
  static async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const res = await fetch(`${META_BASE_URL}/me?access_token=${accessToken}`, {
        signal: AbortSignal.timeout(10_000),
      })
      return res.ok
    } catch {
      return false
    }
  }
}
