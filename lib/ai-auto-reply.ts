/**
 * QR/WhatsApp inbound AI auto-reply — runs in Next.js right after inbox persist.
 */
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { isConversationAiEnabled } from '@/lib/whatsapp-message-utils'
import { resolveAllowedKnowledgeIds } from '@/lib/agent-knowledge'
import type { AgentKbSource } from '@/lib/agent-knowledge'
import { AIGateway } from '@/services/ai-gateway'
import { resolveOpenRouterModel, shouldUseOpenRouterOnly } from '@/lib/openrouter-model'
import { logger } from '@/lib/logger'

const FALLBACK_DELAY_MS = 600

export interface TriggerAiAutoReplyInput {
  tenantId: string
  conversationId: string
  contactId: string
  phone: string
  rawJid: string
  inboundText: string
  userMessageId: string
  sessionId?: string
  sendJid?: string
}

interface AIAgent {
  id: string
  name: string | null
  role: string | null
  tone: string | null
  instructions: string | null
  model: string | null
  metadata: Record<string, unknown> | null
  is_active: boolean | null
}

async function fetchActiveAgent(tenantId: string, conversationId: string) {
  const admin = getSupabaseAdmin()
  const { data: conv } = await admin
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle() as { data: { metadata: any, ai_agent_id?: string } | null; error: any }

  const meta = (conv?.metadata ?? {}) as Record<string, string>
  const selectedId = meta.selected_agent_id || meta.ai_agent_id

  if (selectedId) {
    const { data: agent } = await admin
      .from('ai_agents')
      .select('id, name, role, tone, instructions, model, metadata, is_active')
      .eq('id', selectedId)
      .eq('tenant_id', tenantId)
      .maybeSingle() as { data: AIAgent | null; error: any }
    if (agent?.is_active) return agent
  }

  const { data: agents } = await admin
    .from('ai_agents')
    .select('id, name, role, tone, instructions, model, metadata, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false }) as { data: AIAgent[] | null; error: any }

  if (!agents?.length) return null
  return (
    agents.find((a) => String((a.metadata as Record<string, string>)?.phone_number || 'all') === 'all') ||
    agents[0]
  )
}

async function workerAlreadyReplied(conversationId: string, afterMessageId: string): Promise<boolean> {
  const admin = getSupabaseAdmin()
  const { data: rows } = await admin
    .from('messages')
    .select('id, sender_type')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(6) as { data: { id: string, sender_type: string }[] | null; error: any }

  if (!rows?.length) return false

  const userIdx = rows.findIndex((r) => r.id === afterMessageId)
  if (userIdx < 0) return rows.some((r) => r.sender_type === 'ai')

  return rows.slice(0, userIdx).some((r) => r.sender_type === 'ai')
}

async function isAiAllowedForLead(tenantId: string, contactId: string): Promise<{ ok: boolean; leadId?: string }> {
  const admin = getSupabaseAdmin()
  const { data: lead } = await admin
    .from('leads')
    .select('id, ai_active')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle() as { data: { id: string, ai_active: boolean } | null; error: any }

  if (lead?.ai_active === false) return { ok: false, leadId: lead.id }

  const { data: aiCfg } = await admin
    .from('ai_settings')
    .select('auto_response_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle() as { data: { auto_response_enabled: boolean } | null; error: any }

  if (aiCfg?.auto_response_enabled === false) return { ok: false, leadId: lead?.id }

  return { ok: true, leadId: lead?.id }
}

export function scheduleAiAutoReply(input: TriggerAiAutoReplyInput): void {
  if (!input.inboundText?.trim()) return

  if (!shouldUseOpenRouterOnly() && !process.env.OPENAI_API_KEY && !process.env.MISTRAL_API_KEY) {
    logger.error('[ai-auto-reply] No OPENROUTER_API_KEY or other LLM key — cannot reply')
    return
  }

  setTimeout(() => {
    runAiAutoReply(input).catch((err) => {
      logger.error({ err, conversationId: input.conversationId }, '[ai-auto-reply] Failed')
    })
  }, FALLBACK_DELAY_MS)
}

export async function runAiAutoReply(input: TriggerAiAutoReplyInput): Promise<void> {
  const { tenantId, conversationId, contactId, inboundText, userMessageId, sessionId, sendJid, rawJid, phone } =
    input

  const admin = getSupabaseAdmin()

  const { data: conv } = await admin
    .from('conversations')
    .select('ai_enabled, mode')
    .eq('id', conversationId)
    .maybeSingle() as { data: { ai_enabled: boolean, mode: string } | null; error: any }

  if (!conv || !isConversationAiEnabled(conv)) {
    logger.info({ conversationId }, '[ai-auto-reply] Skipped — AI off for conversation')
    return
  }

  const { ok, leadId } = await isAiAllowedForLead(tenantId, contactId)
  if (!ok) {
    logger.info({ conversationId, leadId }, '[ai-auto-reply] Skipped — lead/tenant AI disabled')
    return
  }

  if (await workerAlreadyReplied(conversationId, userMessageId)) {
    logger.info({ conversationId }, '[ai-auto-reply] Skipped — worker already replied')
    return
  }

  const agent = await fetchActiveAgent(tenantId, conversationId)
  if (!agent) {
    logger.warn({ tenantId }, '[ai-auto-reply] No active AI agent')
    return
  }

  const { data: historyMsgs } = await admin
    .from('messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(14) as { data: { sender_type: string, content: string }[] | null; error: any }

  const history = (historyMsgs ?? []).map((m) => ({
    role: (m.sender_type === 'user' || m.sender_type === 'customer'
      ? 'user'
      : 'assistant') as 'user' | 'assistant',
    content: String(m.content ?? ''),
  }))

  const kbSources = ((agent.metadata as Record<string, unknown>)?.kbSources ?? []) as AgentKbSource[]
  const knowledgeSourceIds = await resolveAllowedKnowledgeIds(tenantId, agent.id, kbSources)

  const rawModel =
    (agent.metadata as Record<string, string>)?.full_model || agent.model || 'mistral-large-latest'
  const model = shouldUseOpenRouterOnly()
    ? `openrouter/${resolveOpenRouterModel(rawModel)}`
    : rawModel

  const systemPrompt =
    `You are an AI assistant named "${agent.name ?? 'Assistant'}".\n` +
    `Role: ${agent.role ?? 'Customer support'}\n` +
    `Tone: ${agent.tone ?? 'Professional'}\n` +
    `Instructions: ${agent.instructions ?? 'Be helpful and concise.'}\n\n` +
    `Reply naturally in 1-3 short sentences. Greet the customer when they say hello.`

  logger.info({ conversationId, agentId: agent.id, model }, '[ai-auto-reply] Generating reply')

  const result = await AIGateway.generateResponse({
    message: inboundText,
    systemPrompt,
    history,
    model,
    tenantId,
    userId: 'ai-auto-reply',
    knowledgeSourceIds,
    handoffContext: { contactId, leadId },
  })

  if (!result.success || !result.text?.trim()) {
    logger.error(
      { conversationId, error: result.error, blocked: result.blockedByGuard },
      '[ai-auto-reply] Gateway returned no reply'
    )
    return
  }

  const reply = result.text.trim()

  if (await workerAlreadyReplied(conversationId, userMessageId)) {
    return
  }

  let waMessageId: string | null = null
  const resolvedJid = sendJid || `${phone.replace(/\D/g, '')}@s.whatsapp.net`

  try {
    const { getConnectedSession } = await import('@/lib/whatsapp-qr')
    const connected = await getConnectedSession(tenantId, sessionId)
    if (connected?.sock) {
      const sent = await connected.sock.sendMessage(resolvedJid, { text: reply })
      waMessageId = sent?.key?.id ?? null
    } else {
      logger.warn({ tenantId, sessionId }, '[ai-auto-reply] No active Baileys socket — inbox only')
    }
  } catch (err) {
    logger.error({ err, conversationId }, '[ai-auto-reply] Baileys direct send failed')
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    conversation_id: conversationId,
    sender_type: 'ai',
    content: reply,
    message_type: 'text',
    wa_message_id: waMessageId ?? undefined,
    metadata: { source: 'nextjs_ai_auto_reply', phone, raw_jid: rawJid },
  }

  const { data: aiMsg, error: insertErr } = await (admin.from('messages') as any)
    .insert(insertPayload)
    .select()
    .single() as { data: any; error: any }

  if (insertErr) {
    logger.error({ insertErr, conversationId }, '[ai-auto-reply] Failed to save AI message')
    return
  }

  await (admin.from('conversations') as any)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  if (aiMsg) {
    try {
      const { broadcastMessageToRealtime } = await import('@/lib/realtime-broadcast')
      await broadcastMessageToRealtime(tenantId, conversationId, {
        ...aiMsg,
        conversation_id: conversationId,
      })
    } catch {
      /* non-fatal */
    }
  }

  logger.info({ conversationId, agentId: agent.id }, '[ai-auto-reply] Reply sent successfully')
}
