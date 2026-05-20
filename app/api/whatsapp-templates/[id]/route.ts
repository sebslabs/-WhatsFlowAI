import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { assertPermission } from '@/lib/rbac'

type RouteParams = { params: { id: string } }

// DELETE /api/whatsapp-templates/[id] — Safely destroys an existing template configuration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'templates:delete')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    const { error: dbError } = await supabase
      .from('whatsapp_templates')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Forced enterprise multi-tenant security scoping

    if (dbError) throw dbError

    logger.info({ userId: user.id, templateId: id }, 'WhatsApp template deleted successfully')
    return NextResponse.json({ success: true })

  } catch (err: any) {
    logger.error({ userId: user.id, templateId: id }, 'DELETE /api/whatsapp-templates/[id] failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
