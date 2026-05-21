import { NextRequest, NextResponse } from 'next/server'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { rateLimitAuth, rateLimitExceededResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Returns a fresh TOTP enrollment payload for the authenticated user only.
 * Secret is not persisted until /api/2fa/verify succeeds.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimitAuth(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const secret = speakeasy.generateSecret({
      name: `WhatsFlow (${user.email})`,
    })

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url ?? '')

    logger.info({ userId: user.id }, '2FA setup payload generated')

    return NextResponse.json({
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCode: qrCodeUrl,
    })
  } catch (err) {
    logger.error({ userId: user.id }, '2FA setup failed', err)
    return NextResponse.json({ error: 'Failed to set up 2FA' }, { status: 500 })
  }
}
