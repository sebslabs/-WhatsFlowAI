import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET /api/whatsapp/templates — Retrieves all WhatsApp templates scoped to the current tenant
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { data, error: dbError } = await supabase
      .from('whatsapp_templates')
      .select('id, name, language, category, status, wa_template_id, components, created_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    return NextResponse.json(data || [])
  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/whatsapp/templates failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
