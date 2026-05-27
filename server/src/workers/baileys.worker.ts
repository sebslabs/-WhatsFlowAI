import { Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { FlowService } from '../services/flow.service.js'
import { AiReplyPipeline, type ActiveAgentRecord } from '../services/ai-reply.pipeline.js'
import { logger } from '../utils/logger.js'
import { broadcastNewMessage } from '../lib/realtime.js'
import type { BaileysJobData } from '../services/baileys-queue.js'
import { QUEUE_NAME } from '../services/baileys-queue.js'

dotenv.config()

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const connection = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: (process.env.REDIS_URL ?? '').startsWith('rediss://') ? {} : undefined,
})

function isPlaceholderContactName(name?: string | null): boolean {
  if (!name) return true
  const clean = name.trim().toLowerCase()
  return (
    clean === 'unknown' ||
    clean === 'anonymous' ||
    /^\+?\d{8,15}$/.test(clean) ||
    clean.includes('whatsapp user')
  )
}

function resolveContactDisplayName(opts: {
  pushName?: string | null
  existingName?: string | null
  whatsAppLookupName?: string | null
}): string {
  if (opts.existingName && !isPlaceholderContactName(opts.existingName)) {
    return opts.existingName
  }
  if (opts.pushName && !isPlaceholderContactName(opts.pushName)) {
    return opts.pushName
  }
  if (opts.whatsAppLookupName && !isPlaceholderContactName(opts.whatsAppLookupName)) {
    return opts.whatsAppLookupName
  }
  return 'WhatsApp User'
}

async function isConversationAiEnabled(convId: string): Promise<boolean> {
  const { data } = await supabase
    .from('conversations')
    .select('ai_enabled, mode')
    .eq('id', convId)
    .maybeSingle()
  if (!data) return false
  if (data.ai_enabled === false) return false
  if (data.mode === 'manual') return false
  return true
}

async function saveMessageToDB(
  tenantId: string,
  messageId: string,
  phone: string,
  rawJid: string,
  pushName: string | null,
  text: string,
  fromMe: boolean,
  rawMessage?: any
) {
  const { data: existingWa } = await supabase
    .from('messages')
    .select('id, conversation_id')
    .eq('wa_message_id', messageId)
    .maybeSingle()

  if (existingWa) return null

  const idempotencyKey = `qr-${messageId}`
  const { data: duplicateEvent } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('external_event_id', idempotencyKey)
    .maybeSingle()

  if (duplicateEvent) return null

  await supabase.from('webhook_events').insert({
    external_event_id: idempotencyKey,
    payload: { messageId, phone, raw_jid: rawJid, pushName, text, fromMe },
    tenant_id: tenantId,
  })

  const { data: existingContact } = await supabase
    .from('contacts')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone)
    .maybeSingle()

  const contactName = resolveContactDisplayName({
    pushName,
    existingName: existingContact?.name,
  })

  const contactMetadata = {
    whatsapp_raw_jid: rawJid,
    ...(pushName ? { whatsapp_push_name: pushName } : {}),
  }

  let contact
  if (existingContact) {
    contact = existingContact
    const shouldUpdateName =
      !!pushName ||
      (isPlaceholderContactName(existingContact.name) &&
        !isPlaceholderContactName(contactName))

    await supabase
      .from('contacts')
      .update({
        ...(shouldUpdateName && contactName !== existingContact.name ? { name: contactName } : {}),
        metadata: {
          ...(typeof existingContact.metadata === 'object' && existingContact.metadata !== null
            ? existingContact.metadata
            : {}),
          ...contactMetadata,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingContact.id)

    if (shouldUpdateName) {
      contact = { ...existingContact, name: contactName }
    }
  } else {
    const { data: newContact, error: e } = await supabase
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        phone_number: phone,
        name: contactName,
        metadata: contactMetadata,
      })
      .select()
      .single()
    if (e) throw e
    contact = newContact
  }

  await upsertLead(tenantId, contact.id, phone, contact.name || contactName)

  let conversation
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contact.id)
    .maybeSingle()

  if (existingConv) {
    conversation = existingConv
  } else {
    const { data: newConv, error: e } = await supabase
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        contact_id: contact.id,
        status: 'open',
        mode: 'bot',
        ai_enabled: true,
        unread_count: 0,
      })
      .select()
      .single()
    if (e) throw e
    conversation = newConv
  }

  const senderType = fromMe ? 'agent' : 'user'

  // Process incoming Baileys media if present
  let mediaUrl: string | null = null
  let messageType = 'text'
  let contentText = text
  let mediaError: string | null = null

  if (rawMessage && !fromMe) {
    let msgContent = rawMessage
    if (msgContent.ephemeralMessage?.message) msgContent = msgContent.ephemeralMessage.message
    if (msgContent.viewOnceMessage?.message) msgContent = msgContent.viewOnceMessage.message
    if (msgContent.viewOnceMessageV2?.message) msgContent = msgContent.viewOnceMessageV2.message
    if (msgContent.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message

    let mediaMessage = null
    let typeKey: 'image' | 'video' | 'audio' | 'document' | null = null
    let extension = ''

    if (msgContent.imageMessage) {
      mediaMessage = msgContent.imageMessage
      typeKey = 'image'
      extension = 'jpg'
    } else if (msgContent.videoMessage) {
      mediaMessage = msgContent.videoMessage
      typeKey = 'video'
      extension = 'mp4'
    } else if (msgContent.audioMessage) {
      mediaMessage = msgContent.audioMessage
      typeKey = 'audio'
      extension = 'ogg'
    } else if (msgContent.documentMessage) {
      mediaMessage = msgContent.documentMessage
      typeKey = 'document'
      extension = msgContent.documentMessage.mimetype?.split('/')?.[1] || 'bin'
    }

    if (mediaMessage && typeKey) {
      messageType = typeKey
      try {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys')
        const stream = await downloadContentFromMessage(mediaMessage, typeKey)
        let buffer = Buffer.from([])
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk])
        }
        
        const randName = `${Math.random().toString(36).substring(2)}.${extension}`
        const { data, error } = await supabase.storage.from('media').upload(`chat/${randName}`, buffer, {
          contentType: mediaMessage.mimetype || 'application/octet-stream',
        })
        
        if (error) {
          mediaError = `Storage upload error: ${error.message}`
        } else if (data) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`chat/${randName}`)
          mediaUrl = publicUrl
          contentText = mediaMessage.caption || `[${typeKey}]`
        }
      } catch (err: any) {
        mediaError = `Download content error: ${err.message || String(err)}`
        logger.error('[baileys-worker] Failed to download/upload incoming Baileys media:', { err: err.message })
      }
    }
  }

  const { data: insertedMsg, error: insertMsgErr } = await supabase
    .from('messages')
    .insert({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      sender_type: senderType,
      content: contentText,
      message_type: messageType,
      media_url: mediaUrl,
      wa_message_id: messageId,
      metadata: { phone, raw_jid: rawJid, contact_name: contact.name || contactName, media_error: mediaError },
    })
    .select()
    .single()

  if (insertMsgErr) {
    if (insertMsgErr.code === '23505') return null
    throw insertMsgErr
  }

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      unread_count: fromMe ? conversation.unread_count || 0 : (conversation.unread_count || 0) + 1,
    })
    .eq('id', conversation.id)

  return {
    ...insertedMsg,
    conversation_id: conversation.id,
    contact_name: contact.name || contactName,
    conversation,
  }
}

async function upsertLead(tenantId: string, contactId: string, phone: string, name: string) {
  const { data: existing } = await supabase
    .from('leads')
    .select('id, phone')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (existing) {
    const leadPatch: { phone?: string; name?: string } = {}
    if (!existing.phone) leadPatch.phone = phone
    if (name && !isPlaceholderContactName(name)) leadPatch.name = name
    if (Object.keys(leadPatch).length > 0) {
      await supabase.from('leads').update(leadPatch).eq('id', existing.id)
    }
    return existing
  }

  const { data: newLead, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage: 'new',
      phone,
      name,
      ai_active: true,
    })
    .select()
    .single()

  if (error) {
    const { data: fallbackLead, error: fallbackErr } = await supabase
      .from('leads')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        stage: 'new',
        metadata: { phone, name, source: 'whatsapp_qr' },
      })
      .select()
      .single()
    if (fallbackErr) console.error('[Baileys-QR] upsertLead:', fallbackErr)
    return fallbackLead
  }

  return newLead
}

async function fetchActiveAgent(
  tenantId: string,
  conversationId: string
): Promise<ActiveAgentRecord | null> {
  const { data: conv } = await supabase
    .from('conversations')
    .select('metadata')
    .eq('id', conversationId)
    .maybeSingle()

  const selectedAgentId =
    (conv?.metadata as Record<string, string> | undefined)?.selected_agent_id ||
    (conv?.metadata as Record<string, string> | undefined)?.ai_agent_id

  if (selectedAgentId) {
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('id, name, role, tone, instructions, model, metadata, is_active')
      .eq('id', selectedAgentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (agent?.is_active) return agent as ActiveAgentRecord
  }

  const { data: activeAgents } = await supabase
    .from('ai_agents')
    .select('id, name, role, tone, instructions, model, metadata, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (!activeAgents?.length) return null
  return (activeAgents.find((a) => String(a.metadata?.phone_number || 'all') === 'all') ||
    activeAgents[0]) as ActiveAgentRecord
}

async function runAiAutoReply(
  tenantId: string,
  sessionId: string,
  sendJid: string,
  conversationId: string,
  contactId: string,
  inboundText: string,
  leadId?: string
): Promise<void> {
  try {
    const activeAgent = await fetchActiveAgent(tenantId, conversationId)
    if (!activeAgent) return

  const { data: historyMsgs } = await supabase
    .from('messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(14)

  const history = (historyMsgs || []).map((m) => ({
    role: (m.sender_type === 'user' || m.sender_type === 'customer'
      ? 'user'
      : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }))

      const pipelineInput: any = {
        tenantId,
        contactId,
        conversationId,
        message: inboundText,
        agent: activeAgent,
        history,
      };
      if (leadId) pipelineInput.leadId = leadId;
      const result = await AiReplyPipeline.process(pipelineInput);

  if (!result.replied || !result.replyText?.trim()) return

  const reply = result.replyText
  if (result.handoff) {
    logger.info('[BaileysWorker] Handoff completed — sending transition message if any', { conversationId })
  }

  let messageId: string | null = null

  try {
    const { getBaileysSession } = await import('../services/whatsapp-qr.service.js')
    const sock = await getBaileysSession(tenantId, sessionId)
    if (sock) {
      const sent = await sock.sendMessage(sendJid, { text: reply })
      messageId = sent?.key?.id || null
      logger.info('[BaileysWorker] Successfully sent AI reply message via local socket!')
    } else {
      logger.warn('[BaileysWorker] Could not get Baileys Session')
    }
  } catch (err: any) {
    logger.error('Failed to dispatch Baileys outbound AI response:', { err: err.message })
    return
  }

    const { data: aiMsg, error: outboundErr } = await supabase
      .from('messages')
      .insert({
        tenant_id: tenantId,
        conversation_id: conversationId,
        sender_type: 'ai',
        content: reply,
        message_type: 'text',
        wa_message_id: messageId || undefined,
      })
      .select()
      .single()

    if (outboundErr && outboundErr.code !== '23505') {
      console.error('[BaileysWorker] AI DB insert failed:', outboundErr)
      return
    }

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    if (aiMsg) {
      await broadcastNewMessage(tenantId, conversationId, {
        ...aiMsg,
        conversation_id: conversationId,
      })
    }
  } catch (err: any) {
    logger.error('Failed to dispatch Baileys outbound AI response:', { err: err.message })
  }
}

const worker = new Worker<BaileysJobData>(
  QUEUE_NAME,
  async (job: Job<BaileysJobData>) => {
    const { tenantId, sessionId, sendJid, rawJid, messageId, phone, pushName, text, fromMe, rawMessage } = job.data

    logger.info(`[BaileysWorker] Processing message job: ${job.id}`, { messageId, phone })

    try {
      const { data: qrSession } = await supabase
        .from('whatsapp_qr_sessions')
        .select('status')
        .eq('id', sessionId)
        .maybeSingle()
      const socketReady = qrSession?.status === 'connected'
      logger.info(`[Baileys] Socket ready: ${socketReady}`)

      const saved = await saveMessageToDB(
        tenantId,
        messageId,
        phone,
        rawJid,
        pushName,
        text,
        fromMe,
        rawMessage
      )

      if (!saved) {
        logger.info(`[BaileysWorker] Duplicate or empty message. Skipping.`, { messageId })
        return
      }

      const realtimePayload = {
        ...saved,
        phone,
        raw_jid: rawJid,
        name: saved.contact_name,
      }
      await broadcastNewMessage(tenantId, saved.conversation_id, realtimePayload)

      if (fromMe) return

      // Retrieve lead for flow trigger/resume processing
      const leadRecord = await upsertLead(
        tenantId,
        saved.conversation.contact_id,
        phone,
        saved.contact_name || pushName || 'WhatsApp User'
      )

      const { data: lead } = await supabase
        .from('leads')
        .select('id, current_flow_id, current_step_index, ai_active')
        .eq('tenant_id', tenantId)
        .eq('contact_id', saved.conversation.contact_id)
        .maybeSingle()

      // 1. Resume active flow if contact is mid-flow
      if (lead?.current_flow_id) {
        logger.info(`[BaileysWorker] Resuming flow ${lead.current_flow_id} at step ${lead.current_step_index}`)
        await FlowService.processFlow(
          supabase,
          tenantId,
          saved.conversation.contact_id,
          saved.conversation_id,
          text,
          lead.current_flow_id,
          (lead.current_step_index ?? 0) + 1
        )
        return
      }

      // 2. Match keyword trigger flow
      const keywordFlowId = await FlowService.matchKeywordFlow(supabase, tenantId, text)
      if (keywordFlowId) {
        logger.info(`[BaileysWorker] Keyword flow matched: ${keywordFlowId}`)
        await FlowService.processFlow(
          supabase,
          tenantId,
          saved.conversation.contact_id,
          saved.conversation_id,
          text,
          keywordFlowId,
          0
        )
        return
      }

      // 3. Welcome flow — first customer message only
      const welcomeFlowId = await FlowService.shouldTriggerWelcomeFlow(
        supabase,
        tenantId,
        saved.conversation_id
      )
      if (welcomeFlowId) {
        logger.info(`[BaileysWorker] Welcome flow (first message): ${welcomeFlowId}`)
        await FlowService.processFlow(
          supabase,
          tenantId,
          saved.conversation.contact_id,
          saved.conversation_id,
          text,
          welcomeFlowId,
          0
        )
        return
      }
      
      const aiEnabled = await isConversationAiEnabled(saved.conversation_id)
      if (!aiEnabled) return

      const leadId = lead?.id ?? leadRecord?.id
      if (!(await AiReplyPipeline.isAiAllowed(supabase, tenantId, leadId))) {
        logger.info('[BaileysWorker] AI disabled for lead or tenant settings', { leadId })
        return
      }

      await runAiAutoReply(
        tenantId,
        sessionId,
        sendJid,
        saved.conversation_id,
        saved.conversation.contact_id,
        text,
        leadId
      )
    } catch (err: any) {
      logger.error(`[BaileysWorker] Failed to process message ${job.id}`, { error: err.message })
      throw err
    }
  },
  {
    connection,
    concurrency: 5,
  }
)

worker.on('completed', (job) => {
  logger.info(`[BaileysWorker] Job completed: ${job.id}`)
})

worker.on('failed', (job, err) => {
  logger.error(`[BaileysWorker] Job failed: ${job?.id}`, { err: err.message })
})

logger.info(`[BaileysWorker] Background queue processor started successfully. Listening on "${QUEUE_NAME}"…`)
