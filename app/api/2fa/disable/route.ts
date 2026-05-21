import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuthApi } from '@/lib/auth'
import { rateLimitAuth, rateLimitExceededResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const rl = await rateLimitAuth(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const supabase = createClient()
    const { error: dbError } = await supabase
      .from('user_totp_settings')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    if (dbError) {
      logger.error({ userId: user.id }, '2FA disable failed', dbError)
      return NextResponse.json({ error: 'Failed to disable 2FA' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ userId: user.id }, '2FA disable handler error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
