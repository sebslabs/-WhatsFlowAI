import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { assertPermission } from '@/lib/rbac'

type RouteParams = { params: { id: string } }

// DELETE /api/campaigns/[id] — Safely deletes a campaign definition scoped by enterprise tenancy
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'campaigns:delete')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    const { error: dbError } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)

    if (dbError) throw dbError

    logger.info({ userId: user.id, campaignId: id }, 'Campaign deleted successfully')
    return NextResponse.json({ success: true })

  } catch (err: any) {
    logger.error({ userId: user.id, campaignId: id }, 'DELETE /api/campaigns failed', err)
    return NextResponse.json({ error: err.message || 'Failed to delete campaign' }, { status: 500 })
  }
}
