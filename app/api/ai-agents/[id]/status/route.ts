import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

type RouteParams = { params: { id: string } }

// PATCH /api/ai-agents/[id]/status — Activates or Pauses a deployed AI agent
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { status } = body // 'active' | 'paused'
    const is_active = status === 'active'

    const { data, error: dbError } = await supabase
      .from('ai_agents')
      .update({
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Tenant level security isolation
      .select()
      .single()

    if (dbError) throw dbError

    logger.info({ userId: user.id, agentId: id, status }, 'AI Agent status toggled successfully')

    return NextResponse.json({
      ...data,
      role: data.role || 'Assistant',
      tone: data.tone || 'Professional',
      status: data.is_active ? 'active' : 'paused',
      model: data.metadata?.full_model || data.model || 'mistral-large-latest',
      kbSources: data.metadata?.kbSources || [],
      pipeline: data.metadata?.pipeline || 'Default Pipeline'
    })

  } catch (err: any) {
    logger.error({ userId: user.id, agentId: id }, 'PATCH /api/ai-agents/[id]/status failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
