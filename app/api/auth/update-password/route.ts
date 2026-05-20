import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuthApi } from '@/lib/auth'
import { rateLimitAuth, rateLimitExceededResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(8).max(256),
})

export async function POST(request: NextRequest) {
  const rl = await rateLimitAuth(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, error } = await requireAuthApi(request)
  if (error) return error

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updatePasswordSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const supabase = createClient()
    const { currentPassword, newPassword } = parsed.data

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })
    if (reauthError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) {
      logger.error({ userId: user.id }, 'Password update failed', updateError)
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ userId: user.id }, 'Password update handler error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
