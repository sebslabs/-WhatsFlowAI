import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { syncAgentKnowledgeSources } from '@/lib/agent-knowledge'
import type { AgentKbSource } from '@/lib/agent-knowledge'

// GET /api/ai-agents — Queries list of AI agents configured for the current tenant
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { data, error: dbError } = await supabase
      .from('ai_agents')
      .select('id, tenant_id, name, model, instructions, tone, temperature, max_tokens, is_active, role, metadata, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    // Map structural properties and unpack metadata JSON elements seamlessly for frontend compatibility
    const mapped = (data ?? []).map((agent: any) => ({
      ...agent,
      role: agent.role || 'Assistant',
      tone: agent.tone || 'professional',
      status: agent.is_active ? 'active' : 'paused',
      model: agent.metadata?.full_model || agent.model || 'mistral-large-latest',
      kbSources: agent.metadata?.kbSources || [],
      pipeline: agent.metadata?.pipeline || 'Default Pipeline',
      phoneNumber: agent.metadata?.phone_number || 'all',
      allowedTemplates: agent.metadata?.allowedTemplates || [],
      allowedCatalogItems: agent.metadata?.allowedCatalogItems || []
    }))

    return NextResponse.json(mapped)
  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/ai-agents failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// POST /api/ai-agents — Instantiates a new persistent cloud-backed AI Agent configuration
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { name, role, tone, instructions, model, kbSources, pipeline, temperature, phoneNumber, allowedTemplates, allowedCatalogItems } = body

    // Multi-tier enum safety alignment: Transposes high-fidelity model strings into restricted Enum types
    const lowercaseModel = String(model || 'mistral').toLowerCase()
    let dbProvider = 'mistral'
    if (lowercaseModel.includes('gpt') || lowercaseModel.includes('o1-') || lowercaseModel.includes('openai')) {
      dbProvider = 'openai'
    } else if (lowercaseModel.includes('claude') || lowercaseModel.includes('anthropic')) {
      dbProvider = 'anthropic'
    } else if (lowercaseModel.includes('llama') || lowercaseModel.includes('groq')) {
      dbProvider = 'groq'
    } else if (lowercaseModel.includes('mistral') || lowercaseModel.includes('mixtral')) {
      dbProvider = 'mistral'
    }

    const payload = {
      tenant_id: user.tenant_id, // Injected safely from server-side authentication context
      name: name,
      role: role || 'Assistant',
      tone: tone || 'Professional',
      instructions: instructions || 'You are a helpful AI assistant.',
      model: dbProvider,
      is_active: true,
      temperature: temperature !== undefined ? parseFloat(temperature) : 0.7,
      metadata: {
        full_model: model || 'mistral-large-latest',
        kbSources: kbSources || [],
        pipeline: pipeline || 'Default Pipeline',
        phone_number: phoneNumber || 'all',
        allowedTemplates: allowedTemplates || [],
        allowedCatalogItems: allowedCatalogItems || []
      },
      updated_at: new Date().toISOString()
    }

    const { data, error: dbError } = await supabase
      .from('ai_agents')
      .insert([payload])
      .select()
      .single()

    if (dbError) throw dbError

    await syncAgentKnowledgeSources(
      user.tenant_id,
      data.id,
      (kbSources ?? []) as AgentKbSource[]
    )

    logger.info({ userId: user.id, agentId: data.id }, 'AI Agent created successfully')

    return NextResponse.json({
      ...data,
      role: data.role || 'Assistant',
      tone: data.tone || 'Professional',
      status: data.is_active ? 'active' : 'paused',
      model: data.metadata?.full_model || data.model || 'mistral-large-latest',
      kbSources: data.metadata?.kbSources || [],
      pipeline: data.metadata?.pipeline || 'Default Pipeline',
      phoneNumber: data.metadata?.phone_number || 'all',
      allowedTemplates: data.metadata?.allowedTemplates || [],
      allowedCatalogItems: data.metadata?.allowedCatalogItems || []
    }, { status: 201 })

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/ai-agents failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
