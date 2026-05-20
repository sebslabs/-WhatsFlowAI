/**
 * Flow Service — Unified Flow Engine
 *
 * Consolidated from the old `flows` + `chatbot_flows` split.
 * Now reads exclusively from `chatbot_flows` with `tenant_id` scope.
 * Tracks state in `leads.current_flow_id` + `leads.current_step_index`.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FlowStep } from '../types/db.types.js'
import { AIService } from './ai.service.js'

export class FlowService {
  /**
   * Execute the next step of a flow.
   * @param db         Service-role Supabase client
   * @param tenantId   Tenant UUID (NOT organization_id)
   * @param contactId  Contact UUID
   * @param conversationId Conversation UUID (messages go here)
   * @param message    The incoming message text
   * @param flowId     chatbot_flows.id
   * @param stepIndex  Current step index (0-based)
   */
  static async processFlow(
    db: SupabaseClient,
    tenantId: string,
    contactId: string,
    conversationId: string,
    message: string,
    flowId: string,
    stepIndex = 0
  ): Promise<void> {
    // Load flow from chatbot_flows (tenant-scoped)
    const { data: flow, error } = await db
      .from('chatbot_flows')
      .select('id, definition, is_active')
      .eq('id', flowId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !flow || !flow.is_active) {
      console.warn(`[FlowService] Flow ${flowId} not found or inactive for tenant ${tenantId}`)
      return
    }

    const steps = flow.definition as FlowStep[]
    if (!steps || stepIndex >= steps.length) {
      // Flow finished — clear state on lead
      await FlowService.clearFlowState(db, tenantId, contactId)
      return
    }

    const step = steps[stepIndex]!

    switch (step.type) {
      case 'message': {
        await FlowService.sendMessage(db, tenantId, conversationId, contactId, step.message ?? '', 'ai', flowId, stepIndex)
        await FlowService.processFlow(db, tenantId, contactId, conversationId, message, flowId, stepIndex + 1)
        break
      }

      case 'question': {
        await FlowService.sendMessage(db, tenantId, conversationId, contactId, step.message ?? '', 'ai', flowId, stepIndex)
        // Save flow state — wait for user reply
        await FlowService.saveFlowState(db, tenantId, contactId, flowId, stepIndex)
        break
      }

      case 'buttons': {
        const text = step.message ?? ''
        const buttonLabels = (step.buttons ?? []).map((b) => b.label).join(' | ')
        await FlowService.sendMessage(db, tenantId, conversationId, contactId, `${text}\n\n${buttonLabels}`, 'ai', flowId, stepIndex)
        await FlowService.saveFlowState(db, tenantId, contactId, flowId, stepIndex)
        break
      }

      case 'delay': {
        const delayMs = (step.delayMinutes ?? 1) * 60 * 1000
        await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 30_000))) // Cap at 30s in-process
        await FlowService.processFlow(db, tenantId, contactId, conversationId, message, flowId, stepIndex + 1)
        break
      }

      case 'ai_agent': {
        const { data: agents } = await db
          .from('ai_agents')
          .select('id, name, role, tone, instructions, model, metadata')
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)

        const agent = agents?.[0]
        const flowExtra = step.aiPrompt ? `\n\nFlow step context:\n${step.aiPrompt}` : ''
        const systemPrompt = agent
          ? `You are "${agent.name ?? 'Assistant'}".\n${agent.instructions ?? 'Be helpful.'}${flowExtra}`
          : `You are a helpful business assistant.${flowExtra}`

        const modelStr =
          (agent?.metadata as Record<string, string> | undefined)?.full_model ||
          agent?.model ||
          'mistral-large-latest'

        const reply = await AIService.getAgentResponse(
          message,
          systemPrompt,
          [],
          modelStr,
          tenantId,
          agent?.id
        )

        await FlowService.sendMessage(
          db,
          tenantId,
          conversationId,
          contactId,
          reply || 'How can I help you further?',
          'ai',
          flowId,
          stepIndex
        )
        await FlowService.processFlow(db, tenantId, contactId, conversationId, message, flowId, stepIndex + 1)
        break
      }

      case 'tag': {
        if (step.tagName) {
          // Fetch current tags, append the new tag (deduplicated), then write back.
          // contacts.tags is a jsonb column storing string[].
          const { data: contact } = await db
            .from('contacts')
            .select('tags')
            .eq('id', contactId)
            .eq('tenant_id', tenantId)
            .maybeSingle()

          const existingTags: string[] = Array.isArray(contact?.tags) ? contact.tags : []

          // Deduplicate — don't add the same tag twice
          if (!existingTags.includes(step.tagName)) {
            const updatedTags = [...existingTags, step.tagName]
            await db
              .from('contacts')
              .update({ tags: updatedTags })
              .eq('id', contactId)
              .eq('tenant_id', tenantId)
          }
        }
        await FlowService.processFlow(db, tenantId, contactId, conversationId, message, flowId, stepIndex + 1)
        break
      }

      case 'handover': {
        // Switch conversation to manual mode — stops AI replies
        await db
          .from('conversations')
          .update({ mode: 'manual' })
          .eq('id', conversationId)
          .eq('tenant_id', tenantId)

        if (step.handoverNote) {
          await FlowService.sendMessage(
            db,
            tenantId,
            conversationId,
            contactId,
            `[HANDOVER] ${step.handoverNote}`,
            'system',
            flowId,
            stepIndex
          )
        }
        await FlowService.clearFlowState(db, tenantId, contactId)
        break
      }

      case 'end': {
        if (step.endMessage) {
          await FlowService.sendMessage(db, tenantId, conversationId, contactId, step.endMessage, 'ai', flowId, stepIndex)
        }
        if (step.endLeadStage) {
          await db
            .from('leads')
            .update({ stage: step.endLeadStage, updated_at: new Date().toISOString() })
            .eq('contact_id', contactId)
            .eq('tenant_id', tenantId)
        }
        await FlowService.clearFlowState(db, tenantId, contactId)
        break
      }

      default: {
        // Skip unhandled step types and continue
        await FlowService.processFlow(db, tenantId, contactId, conversationId, message, flowId, stepIndex + 1)
      }
    }
  }

  /** Find the active keyword flow for a given message */
  static async matchKeywordFlow(
    db: SupabaseClient,
    tenantId: string,
    message: string
  ): Promise<string | null> {
    const { data } = await db
      .from('chatbot_flows')
      .select('id, definition')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('definition', 'is', null)

    if (!data) return null

    // Find keyword-trigger flows where trigger_keyword matches message
    const lower = message.toLowerCase().trim()
    for (const flow of data) {
      const def = flow.definition as { triggerType?: string; triggerKeyword?: string }[]
      const meta = def?.[0] as { triggerType?: string; triggerKeyword?: string } | undefined
      if (meta?.triggerType === 'keyword' && meta?.triggerKeyword) {
        if (lower.includes(meta.triggerKeyword.toLowerCase())) {
          return flow.id as string
        }
      }
    }
    return null
  }

  /**
   * Welcome flows should run only on the first customer message in a conversation,
   * not on every inbound message (which would block the AI agent entirely).
   */
  static async shouldTriggerWelcomeFlow(
    db: SupabaseClient,
    tenantId: string,
    conversationId: string
  ): Promise<string | null> {
    const welcomeFlowId = await FlowService.findWelcomeFlow(db, tenantId)
    if (!welcomeFlowId) return null

    try {
      const { data: conv } = await db
        .from('conversations')
        .select('contact_id')
        .eq('id', conversationId)
        .maybeSingle()

      if (conv?.contact_id) {
        const { data: lead } = await db
          .from('leads')
          .select('conversation_count, is_first_message, metadata')
          .eq('contact_id', conv.contact_id)
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (lead) {
          const metadata = (lead.metadata || {}) as Record<string, any>
          const conversationCount = Number(lead.conversation_count ?? metadata.conversation_count ?? 1)
          const isFirstMessage = Boolean(lead.is_first_message ?? metadata.is_first_message ?? true)
          if (conversationCount === 1 || isFirstMessage === true) {
            return welcomeFlowId
          }
        }
      }
    } catch (err: any) {
      console.warn('[FlowService] Welcome flow lead property check failed safely:', err.message)
    }

    const { count, error } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('conversation_id', conversationId)
      .in('sender_type', ['user', 'customer'])

    if (error) {
      console.warn('[FlowService] Welcome flow user message count failed:', error.message)
      return null
    }

    // Inbound message is already persisted when the worker runs — first message => count 1
    if ((count ?? 0) <= 1) return welcomeFlowId
    return null
  }

  /** Find the first_message trigger flow for a tenant */
  static async findWelcomeFlow(
    db: SupabaseClient,
    tenantId: string
  ): Promise<string | null> {
    const { data } = await db
      .from('chatbot_flows')
      .select('id, definition')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('definition', 'is', null)
      .limit(10)

    if (!data) return null

    for (const flow of data) {
      const def = flow.definition as { triggerType?: string }[]
      const meta = def?.[0] as { triggerType?: string } | undefined
      if (meta?.triggerType === 'first_message') {
        return flow.id as string
      }
    }
    return null
  }

  /** Insert an AI/system message into a conversation and transmit it */
  private static async sendMessage(
    db: SupabaseClient,
    tenantId: string,
    conversationId: string,
    contactId: string,
    content: string,
    senderType: 'ai' | 'system' = 'ai',
    flowId?: string,
    stepIndex?: number
  ): Promise<void> {
    // 1. Fetch contact's phone number
    const { data: contact, error: contactErr } = await db
      .from('contacts')
      .select('phone_number, phone')
      .eq('id', contactId)
      .single()

    const contactPhone = (contact?.phone_number || (contact as { phone?: string })?.phone || '')
      .replace(/\D/g, '')

    if (contactErr || !contactPhone) {
      console.error(`[FlowService.sendMessage] Contact phone resolution failed: ${contactErr?.message}`)
      return
    }

    // 2. Insert message into logs
    const { data: insertedMsg, error } = await db.from('messages').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      sender_type: senderType,
      content,
      message_type: 'text',
      delivery_status: 'sent'
    }).select().single()

    if (error) {
      console.error(`[FlowService.sendMessage] Message log failed: ${error.message}`)
    }

    // Touch last_message_at
    await db
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    // Check if the tenant has an active Baileys QR session. If so, route through Baileys.
    const { data: session } = await db
      .from('whatsapp_qr_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .maybeSingle()

    if (session) {
      const nextjsUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/internal/baileys/send`
      const internalKey = process.env.INTERNAL_API_KEY || ''
      try {
        const res = await fetch(nextjsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': internalKey,
            'x-internal-secret': process.env.WEBHOOK_INTERNAL_SECRET || '',
          },
          body: JSON.stringify({
            tenantId,
            sessionId: session.id,
            jid: `${contactPhone}@s.whatsapp.net`,
            text: content,
          }),
        })
        if (!res.ok) {
          throw new Error(`Baileys flow send returned HTTP ${res.status}`)
        }
        console.log(`[FlowService] Outbound flow message successfully dispatched via Baileys for ${contactPhone}`)
      } catch (err: any) {
        console.error(`[FlowService] Baileys flow send failed:`, err.message)
      }
    } else {
      // Trigger standard BullMQ outbound dispatch for Meta Cloud API
      try {
        const { enqueueOutbound } = await import('./queue.enterprise.js')
        await enqueueOutbound({
          tenantId,
          conversationId,
          phoneNumber: contactPhone,
          content,
          messageType: 'text',
          idempotencyKey: `flow-${flowId ?? 'gen'}-${stepIndex ?? Date.now()}-${insertedMsg?.id ?? Date.now()}`,
          waAccountId: tenantId,
        })
        console.log(`[FlowService] Outbound message enqueued successfully for ${contactPhone}`)
      } catch (enqueueErr: any) {
        console.error(`[FlowService] Outbound enqueue failed:`, enqueueErr.message)
      }
    }
  }

  /** Persist flow execution state onto the lead record */
  private static async saveFlowState(
    db: SupabaseClient,
    tenantId: string,
    contactId: string,
    flowId: string,
    stepIndex: number
  ): Promise<void> {
    const { error } = await db
      .from('leads')
      .update({
        current_flow_id: flowId,
        current_step_index: stepIndex,
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId)

    if (error) console.error(`[FlowService.saveFlowState] ${error.message}`)
  }

  /** Clear flow state when flow finishes or is abandoned */
  private static async clearFlowState(
    db: SupabaseClient,
    tenantId: string,
    contactId: string
  ): Promise<void> {
    await db
      .from('leads')
      .update({
        current_flow_id: null,
        current_step_index: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId)
  }
}
