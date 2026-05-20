import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

// ── Encryption Core ────────────────────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    throw new Error('[encryption] ENCRYPTION_KEY must be exactly 64 hex characters.')
  }
  return Buffer.from(hex, 'hex')
}

function encrypt(value: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH })

  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  const packed = Buffer.concat([iv, authTag, encrypted])
  return packed.toString('base64')
}

// ── Meta Graph Gateway ──────────────────────────────────────────────────────────────
async function verifyToken(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${accessToken}`, {
      signal: AbortSignal.timeout(10_000)
    })
    return res.ok
  } catch {
    return false
  }
}

async function fetchPhoneProfile(phoneId: string, accessToken: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number,verified_name&access_token=${accessToken}`, {
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}


// ── Main Operation Handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // SECURITY FIX (CRITICAL #3): Fail fast if META_VERIFY_TOKEN is absent in production.
  // A missing env var means the webhook handshake cannot be securely validated.
  if (process.env.NODE_ENV === 'production' && !process.env.WHATSAPP_VERIFY_TOKEN && !process.env.META_VERIFY_TOKEN) {
    logger.error('[whatsapp/connect] WHATSAPP_VERIFY_TOKEN / META_VERIFY_TOKEN is not set — refusing to accept connection in production')
    return NextResponse.json(
      { error: 'Server misconfiguration: verify token env var is required in production', code: 'MISSING_VERIFY_TOKEN' },
      { status: 500 }
    )
  }

  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    phone_number_id,
    business_account_id,
    access_token,
    webhook_verify_token,
    verify_token,
    display_name
  } = body

  if (!phone_number_id || !access_token || !business_account_id) {
    return NextResponse.json({ error: 'Phone Number ID, Business Account ID and Access Token are mandatory' }, { status: 400 })
  }

  try {
    // 1. Meta API upstream active verify handshake
    const isTokenValid = await verifyToken(access_token)
    if (!isTokenValid) {
      return NextResponse.json({ error: 'Invalid or expired Meta access_token' }, { status: 422 })
    }

    // 2. Encrypt access credentials
    let encryptedToken: string
    try {
      encryptedToken = encrypt(access_token)
    } catch (encryptErr: any) {
      logger.error({ err: encryptErr.message }, 'Next.js GCM Encryption failed')
      return NextResponse.json({ error: 'Encryption key configuration invalid. Contact administrator.' }, { status: 500 })
    }

    // 3. Fetch active Profile details from Meta API for richer dashboard UX
    const profile = await fetchPhoneProfile(phone_number_id, access_token)
    const phoneString = profile?.display_phone_number || null
    const activeVerifiedName = profile?.verified_name || display_name || null

    // 4. Correctly align structure to MATCH final PROD Database schema exactly
    const payload = {
      tenant_id: user.tenant_id,
      phone_number_id,
      business_account_id, 
      encrypted_access_token: encryptedToken, 
      status: 'connected',
      metadata: {
        // SECURITY FIX (CRITICAL #3): Use only the explicitly provided token or the env var.
        // Never fall back to a hardcoded predictable default.
        verify_token: verify_token || webhook_verify_token || process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || null,
        display_name: activeVerifiedName,
        display_phone_number: phoneString,
      },
      updated_at: new Date().toISOString()
    }

    const { data, error: dbErr } = await supabase
      .from('whatsapp_accounts')
      .upsert(payload, { onConflict: 'phone_number_id' })
      .select('id, phone_number_id, status')
      .single()

    if (dbErr) {
      logger.error({ err: dbErr.message, code: dbErr.code }, 'Supabase insert into whatsapp_accounts failed')
      throw new Error(`Database constraint failure: ${dbErr.message}`)
    }

    logger.info({ userId: user.id, phoneId: phone_number_id }, 'Meta WhatsApp schema alignment SUCCESS')

    return NextResponse.json({
      message: 'WhatsApp Infrastructure Successfully Linked!',
      phone_number_id: data.phone_number_id,
      status: data.status
    })

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/whatsapp/connect execution error', err)
    return NextResponse.json(
      { error: 'Establishment failure', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
