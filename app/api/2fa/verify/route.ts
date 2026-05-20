import { NextRequest, NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuthApi } from '@/lib/auth'
import { encryptTotpSecret, decryptTotpSecret } from '@/lib/totp-crypto'
import { logger } from '@/lib/logger'
import { rateLimitAuth, rateLimitExceededResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

const verifyBodySchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/),
  /** Base32 secret from the enrollment QR step — required on first activation */
  secret: z.string().min(1).max(200).optional(),
})

export async function POST(req: NextRequest) {
  const rl = await rateLimitAuth(req)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, error } = await requireAuthApi(req)
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = verifyBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  const { token, secret: enrollmentSecret } = parsed.data

  try {
    const supabase = createClient()

    let secretBase32: string | null = enrollmentSecret ?? null

    if (!secretBase32) {
      const { data: row, error: selErr } = await supabase
        .from('user_totp_settings')
        .select('secret_ciphertext, secret_iv, secret_tag, enabled')
        .eq('user_id', user.id)
        .maybeSingle()

      if (selErr) {
        logger.error({ userId: user.id }, '2FA load failed', selErr)
        return NextResponse.json({ error: '2FA storage is not available' }, { status: 503 })
      }
      if (!row?.secret_ciphertext) {
        return NextResponse.json({ error: 'No 2FA secret on file; run setup again' }, { status: 400 })
      }
      try {
        secretBase32 = decryptTotpSecret({
          ciphertext: row.secret_ciphertext,
          iv: row.secret_iv,
          tag: row.secret_tag,
        })
      } catch {
        return NextResponse.json({ error: '2FA configuration error' }, { status: 500 })
      }
    }

    const verified = speakeasy.totp.verify({
      secret: secretBase32,
      encoding: 'base32',
      token,
      window: 1,
    })

    if (!verified) {
      logger.warn({ userId: user.id }, '2FA verification failed (bad code)')
      return NextResponse.json({ success: false, error: 'Invalid verification code' }, { status: 400 })
    }

    if (enrollmentSecret) {
      try {
        const enc = encryptTotpSecret(enrollmentSecret)
        const { error: upErr } = await supabase.from('user_totp_settings').upsert(
          {
            user_id: user.id,
            secret_ciphertext: enc.ciphertext,
            secret_iv: enc.iv,
            secret_tag: enc.tag,
            enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        if (upErr) {
          logger.error({ userId: user.id }, '2FA persist failed', upErr)
          return NextResponse.json(
            { error: 'Could not save 2FA settings. Apply DB migration and set TOTP_ENCRYPTION_KEY.' },
            { status: 503 }
          )
        }
      } catch (e) {
        logger.error({ userId: user.id }, '2FA encryption or DB error', e)
        return NextResponse.json(
          { error: 'Server missing TOTP_ENCRYPTION_KEY (min 32 chars) or database migration not applied.' },
          { status: 503 }
        )
      }
    } else {
      const { error: upErr } = await supabase
        .from('user_totp_settings')
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
      if (upErr) {
        logger.error({ userId: user.id }, '2FA enable flag update failed', upErr)
      }
    }

    logger.info({ userId: user.id }, '2FA verification succeeded')
    return NextResponse.json({ success: true, message: '2FA verified' })
  } catch (err) {
    logger.error({ userId: user.id }, '2FA verify handler error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
