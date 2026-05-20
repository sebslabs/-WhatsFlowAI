import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { AIGateway } from '@/services/ai-gateway'
import { resolveAllowedKnowledgeIds } from '@/lib/agent-knowledge'
import type { AgentKbSource } from '@/lib/agent-knowledge'

type RouteParams = { params: { id: string } }

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = body.message as string | undefined
  const history = (body.history as { role: string; content: string }[]) ?? []
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  try {
    const { data: agent, error: dbErr } = await supabase
      .from('ai_agents')
      .select('id, name, role, tone, instructions, model, temperature, metadata')
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      .single()

    if (dbErr || !agent) {
      logger.warn({ userId: user.id, agentId: id }, 'AI Sandbox execution: agent not found')
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const kbSources = (agent.metadata?.kbSources ?? []) as AgentKbSource[]
    const knowledgeSourceIds = await resolveAllowedKnowledgeIds(
      user.tenant_id,
      agent.id,
      kbSources
    )

    const systemPrompt =
      `You are an AI agent named "${agent.name}".\n` +
      `Role: ${agent.role || 'Assistant'}\n` +
      `Tone: ${agent.tone || 'Professional'}\n` +
      `Instructions: ${agent.instructions || 'Be helpful and concise.'}\n\n` +
      `Answer using the Knowledge Base context when provided. Keep every reply concise (2-3 sentences max). Stay in character.`

    const fullModel = agent.metadata?.full_model || agent.model || 'mistral-large-latest'
    const safeHistory = history.filter(
      (h): h is { role: 'user' | 'assistant'; content: string } =>
        (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string'
    )

    const result = await AIGateway.generateResponse({
      message,
      systemPrompt,
      history: safeHistory,
      model: fullModel,
      tenantId: user.tenant_id,
      userId: user.id,
      knowledgeSourceIds,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'AI generation failed', reply: result.text },
        { status: result.blockedByGuard ? 400 : 503 }
      )
    }

    return NextResponse.json({
      reply: result.text,
      contextUsed: !!result.context,
    })
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : String(err)
    logger.error({ userId: user.id, agentId: id }, 'AI Sandbox execution failed', err)
    return NextResponse.json(
      { error: 'AI Service connection failure', details },
      { status: 500 }
    )
  }
}
