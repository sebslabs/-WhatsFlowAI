import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { syncAgentKnowledgeSources } from '@/lib/agent-knowledge'
import type { AgentKbSource } from '@/lib/agent-knowledge'

type RouteParams = { params: { id: string } }

// PUT /api/ai-agents/[id] — Updates configuration protocols for an existing agent instance
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const { name, role, tone, instructions, model, kbSources, pipeline, temperature, phoneNumber } = body

    // Multi-tier enum safety alignment: Transposes high-fidelity model strings into restricted Enum types
    let dbProvider: string | undefined = undefined
    if (model) {
      const lowercaseModel = String(model).toLowerCase()
      dbProvider = 'mistral'
      if (lowercaseModel.includes('gpt') || lowercaseModel.includes('o1-') || lowercaseModel.includes('openai')) {
        dbProvider = 'openai'
      } else if (lowercaseModel.includes('claude') || lowercaseModel.includes('anthropic')) {
        dbProvider = 'anthropic'
      } else if (lowercaseModel.includes('llama') || lowercaseModel.includes('groq')) {
        dbProvider = 'groq'
      } else if (lowercaseModel.includes('mistral') || lowercaseModel.includes('mixtral')) {
        dbProvider = 'mistral'
      }
    }

    const updatePayload: Record<string, any> = {
      name: name,
      role: role,
      tone: tone,
      instructions: instructions,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
      updated_at: new Date().toISOString()
    }

    if (dbProvider) {
      updatePayload.model = dbProvider
    }

    // Fetch existing agent's metadata to merge elegantly
    const { data: existingAgent } = await supabase
      .from('ai_agents')
      .select('metadata')
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      .single()

    const mergedMetadata = {
      ...(existingAgent?.metadata || {}),
      full_model: model || existingAgent?.metadata?.full_model || 'mistral-large-latest',
      kbSources: kbSources !== undefined ? kbSources : (existingAgent?.metadata?.kbSources || []),
      pipeline: pipeline !== undefined ? pipeline : (existingAgent?.metadata?.pipeline || 'Default Pipeline'),
      phone_number: phoneNumber !== undefined ? phoneNumber : (existingAgent?.metadata?.phone_number || 'all')
    }

    updatePayload.metadata = mergedMetadata

    // Clean undefined properties to avoid Null pointer injection in payload
    Object.keys(updatePayload).forEach(
      (key) => updatePayload[key] === undefined && delete updatePayload[key]
    )

    const { data, error: dbError } = await supabase
      .from('ai_agents')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Mandatory security scope isolation
      .select()
      .single()

    if (dbError) throw dbError

    await syncAgentKnowledgeSources(
      user.tenant_id,
      id,
      mergedMetadata.kbSources as AgentKbSource[]
    )

    logger.info({ userId: user.id, agentId: id }, 'AI Agent updated successfully')

    return NextResponse.json({
      ...data,
      role: data.role || 'Assistant',
      tone: data.tone || 'Professional',
      status: data.is_active ? 'active' : 'paused',
      model: data.metadata?.full_model || data.model || 'mistral-large-latest',
      kbSources: data.metadata?.kbSources || [],
      pipeline: data.metadata?.pipeline || 'Default Pipeline',
      phoneNumber: data.metadata?.phone_number || 'all'
    })

  } catch (err: any) {
    logger.error({ userId: user.id, agentId: id }, 'PUT /api/ai-agents/[id] failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// DELETE /api/ai-agents/[id] — Safely destroys an existing agent deployment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { error: dbError } = await supabase
      .from('ai_agents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Zero-trust scoping

    if (dbError) throw dbError

    logger.info({ userId: user.id, agentId: id }, 'AI Agent deleted successfully')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    logger.error({ userId: user.id, agentId: id }, 'DELETE /api/ai-agents/[id] failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
