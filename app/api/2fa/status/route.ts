import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuthApi } from '@/lib/auth'
import { rateLimitAuth, rateLimitExceededResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const rl = await rateLimitAuth(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, error } = await requireAuthApi(request)
  if (error) return error

  const supabase = createClient()
  const { data, error: dbError } = await supabase
    .from('user_totp_settings')
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (dbError) {
    return NextResponse.json({ error: 'Failed to check 2FA status' }, { status: 503 })
  }

  return NextResponse.json({ enabled: Boolean(data?.enabled) })
}
