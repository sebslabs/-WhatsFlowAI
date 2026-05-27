/**
 * WhatsFlow AI — WebhookWorker
 * Aligned to production schema and high-reliability safety standards.
 * Processes incoming WhatsApp messages and runs the complete AI safety guardrail pipeline.
 */

import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { AiReplyPipeline } from '../services/ai-reply.pipeline.js';

// ── Domain Imports ────────────────────────────────────────────────────────────
import { FlowService } from '../services/flow.service.js';
import { MessageRepository } from '../repositories/message.repository.js';
import { ConversationRepository } from '../repositories/conversation.repository.js';
import { sanitizeMessage } from '../utils/sanitize.js';
import { logger } from '../utils/logger.js';
import { broadcastNewMessage } from '../lib/realtime.js';
import type { WebhookJobData } from '../services/queue.service.js';
import { QUEUE_NAME } from '../services/queue.service.js';
import type { Lead } from '../types/db.types.js';

dotenv.config();

// ── Shared clients ────────────────────────────────────────────────────────────
const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const connection = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: (process.env.REDIS_URL ?? '').startsWith('rediss://') ? {} : undefined,
});

// ── Tenant Context Resolution ─────────────────────────────────────────────────
async function resolveTenantId(job: Job<WebhookJobData>): Promise<string | null> {
  if (job.data.tenantId) return job.data.tenantId;

  const phoneNumberId = job.data.phoneNumberId;
  if (!phoneNumberId) {
    logger.warn('[worker] No phoneNumberId in job — cannot resolve tenant');
    return null;
  }

  const { data, error } = await supabase
    .from('whatsapp_accounts')
    .select('tenant_id')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'connected')
    .maybeSingle();

  if (error) {
    logger.error('[worker] whatsapp_accounts lookup error:', { error: error.message });
    return null;
  }

  return data?.tenant_id ?? null;
}

// ── Webhook Idempotency ───────────────────────────────────────────────────────
async function logWebhookEvent(messageId: string, payload: unknown): Promise<boolean> {
  const { error } = await supabase.from('webhook_events').insert({
    external_event_id: messageId,
    status: 'pending',
    payload: payload as Record<string, unknown>,
  });

  if (error) {
    if (error.code === '23505') {
      logger.info(`[worker] Duplicate webhook event ${messageId} — skipping`);
      return false;
    }
    logger.error('[worker] webhook_events insert error:', { error: error.message });
  }

  return true;
}

async function markWebhookProcessed(messageId: string): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({ status: 'processed' })
    .eq('external_event_id', messageId);
}

async function markWebhookFailed(messageId: string, errorMsg: string): Promise<void> {
  await supabase
    .from('webhook_events')
    .update({ status: 'failed' })
    .eq('external_event_id', messageId);

  logger.error(`[worker] Webhook ${messageId} marked failed: ${errorMsg}`);
}

// ── Lead Management ───────────────────────────────────────────────────────────
async function getLeadByContact(tenantId: string, contactId: string): Promise<Lead | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('id, contact_id, stage, status, current_flow_id, current_step_index, ai_active')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (error) {
    logger.error('[worker] Lead lookup error:', { error: error.message });
    return null;
  }
  return data as Lead | null;
}

async function upsertLead(tenantId: string, contactId: string): Promise<Lead | null> {
  const existing = await getLeadByContact(tenantId, contactId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from('leads')
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      stage: 'New',
      status: 'active',
      lead_value: 0,
      current_flow_id: null,
      current_step_index: 0,
      ai_active: true, // Auto-enable AI on creation
    })
    .select()
    .single();

  if (error) {
    logger.error('[worker] Lead insert error:', { error: error.message });
    return null;
  }
  return data as Lead;
}

// ── Active Agent Picker ────────────────────────────────────────────────────────
async function fetchActiveAgent(tenantId: string, phone = '', conversationId?: string) {
  if (conversationId) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('metadata')
      .eq('id', conversationId)
      .maybeSingle();
    
    const selectedAgentId = (conv?.metadata as any)?.selected_agent_id || (conv?.metadata as any)?.ai_agent_id;
    if (selectedAgentId) {
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select('id, name, role, tone, model, instructions, temperature, is_active, metadata')
        .eq('id', selectedAgentId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      
      if (!agentError && agent && agent.is_active) {
        return agent;
      }
    }
  }

  const { data: activeAgents, error } = await supabase
    .from('ai_agents')
    .select('id, name, role, tone, model, instructions, temperature, is_active, metadata')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('[worker] ai_agents lookup error:', { error: error.message });
    return null;
  }

  if (!activeAgents || activeAgents.length === 0) return null;

  const numericPhone = phone.replace(/[^\d]/g, '');
  let activeAgent = activeAgents.find(a => {
    const targetPhone = String(a.metadata?.phone_number || 'all').replace(/[^\d]/g, '');
    return targetPhone === numericPhone;
  });

  if (!activeAgent) {
    activeAgent = activeAgents.find(a => {
      const targetPhone = String(a.metadata?.phone_number || 'all');
      return targetPhone === 'all';
    });
  }

  return activeAgent;
}

// ── Job Processor Pipeline ─────────────────────────────────────────────────────
async function processWebhookJob(job: Job<WebhookJobData>): Promise<void> {
  const { messageId, from, text, rawPayload } = job.data;

  logger.info(`[worker] Received incoming WhatsApp webhook job`, { job: job.id, messageId });

  const isNew = await logWebhookEvent(messageId, rawPayload);
  if (!isNew) return; // Deduplicated

  try {
    // ── 1. Resolve Tenant Context ─────────────────────────────────────────────
    const tenantId = await resolveTenantId(job);
    if (!tenantId) {
      await markWebhookFailed(messageId, 'Tenant could not be resolved from phone_number_id');
      return;
    }

    const safeText = sanitizeMessage(text);
    const safePhone = from.replace(/[^\d+]/g, '').slice(0, 20);

    if (!safePhone) {
      await markWebhookFailed(messageId, `Invalid sender phone: ${from}`);
      return;
    }

    // ── 2. Create CRM Structures ─────────────────────────────────────────────
    const convRepo = new ConversationRepository(supabase);
    const contact = await convRepo.upsertContact(tenantId, safePhone);
    const conversation = await convRepo.upsertConversation(tenantId, contact.id);

    // Save the incoming user message
    const msgRepo = new MessageRepository(supabase);
    const inboundMsg = await msgRepo.insert({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      sender_type: 'user',
      content: safeText,
      message_type: 'text',
      wa_message_id: messageId,
    });

    if (inboundMsg) {
      broadcastNewMessage(tenantId, conversation.id, inboundMsg as unknown as Record<string, unknown>);
    }

    await convRepo.touchLastMessage(conversation.id);

    // Ensure lead is configured in CRM pipeline
    const lead = await upsertLead(tenantId, contact.id);
    const leadId = lead?.id || 'unknown';

    // ── 3. Check for Active Flow Routines ──────────────────────────────────────
    if (lead?.current_flow_id) {
      logger.info(`[worker] Contact mid-automation: resuming flow step`, { flowId: lead.current_flow_id });
      await FlowService.processFlow(
        supabase,
        tenantId,
        contact.id,
        conversation.id,
        safeText,
        lead.current_flow_id,
        (lead.current_step_index ?? 0) + 1
      );
      await markWebhookProcessed(messageId);
      return;
    }

    // Match Keywords Flow
    const keywordFlowId = await FlowService.matchKeywordFlow(supabase, tenantId, safeText);
    if (keywordFlowId) {
      logger.info(`[worker] Triggering keyword flow`, { flowId: keywordFlowId });
      await FlowService.processFlow(supabase, tenantId, contact.id, conversation.id, safeText, keywordFlowId, 0);
      await markWebhookProcessed(messageId);
      return;
    }

    const welcomeFlowId = await FlowService.shouldTriggerWelcomeFlow(
      supabase,
      tenantId,
      conversation.id
    );
    if (welcomeFlowId) {
      logger.info(`[worker] Triggering welcome flow (first message)`, { flowId: welcomeFlowId });
      await FlowService.processFlow(supabase, tenantId, contact.id, conversation.id, safeText, welcomeFlowId, 0);
      await markWebhookProcessed(messageId);
      return;
    }

    // ── 4. Verify AI Auto-Response Toggle State ──────────────────────────────
    let isAiActive = (lead as any).ai_active;
    if (lead && !isAiActive) {
      logger.info('[worker] AI auto-reply disabled for lead: human has taken over.', { leadId });
      await markWebhookProcessed(messageId);
      return;
    }

    const { data: aiCfg } = await supabase
      .from('ai_settings')
      .select('auto_response_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (aiCfg?.auto_response_enabled === false) {
      logger.info('[worker] AI auto-response disabled in settings for tenant', { tenantId });
      await markWebhookProcessed(messageId);
      return;
    }

    // Fetch Target AI Persona
    const activeAgent = await fetchActiveAgent(tenantId, safePhone, conversation.id);
    if (!activeAgent) {
      logger.info('[worker] No active AI agent found for tenant workspace', { tenantId });
      await markWebhookProcessed(messageId);
      return;
    }

    const { data: historyMsgs } = await supabase
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(14);

    const history = (historyMsgs ?? [])
      .reverse()
      .map((m) => ({
        role: (m.sender_type === 'user' || m.sender_type === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    const pipelineResult = await AiReplyPipeline.process({
      tenantId,
      contactId: contact.id,
      conversationId: conversation.id,
      leadId,
      message: safeText,
      agent: activeAgent,
      history,
    });

    if (!pipelineResult.replied || !pipelineResult.replyText?.trim()) {
      await markWebhookProcessed(messageId);
      return;
    }

    const finalReply = pipelineResult.replyText;

    const aiMsg = await msgRepo.insert({
      tenant_id: tenantId,
      conversation_id: conversation.id,
      sender_type: 'ai',
      content: finalReply,
      message_type: 'text',
      parent_message_id: inboundMsg?.id ?? undefined,
      is_ai_generated: true,
      ai_model: pipelineResult.model,
    } as any);

    await convRepo.touchLastMessage(conversation.id);

    const { enqueueOutbound } = await import('../services/queue.enterprise.js');
    await enqueueOutbound({
      tenantId,
      conversationId: conversation.id,
      phoneNumber: safePhone,
      content: finalReply,
      messageType: 'text',
      idempotencyKey: `ai-reply-${messageId}`,
      waAccountId: tenantId,
    });

    if (aiMsg) {
      broadcastNewMessage(tenantId, conversation.id, {
        ...aiMsg,
        preview: finalReply.slice(0, 80),
      });
    }

    await markWebhookProcessed(messageId);
  } catch (err: any) {
    const errMsg = err.message || String(err);
    logger.error(`[worker] Failed to process webhook message job`, { error: errMsg });
    await markWebhookFailed(messageId, errMsg);
    throw err;
  }
}

// ── BullMQ Worker Config ─────────────────────────────────────────────────────────
const worker = new Worker<WebhookJobData>(QUEUE_NAME, processWebhookJob, {
  connection,
  concurrency: 5,
  limiter: {
    max: 50,
    duration: 1000,
  },
  // OPTIMIZATION: Reduce idle Redis polling.
  // stalledInterval: how often to check for stalled jobs (default 30s → 60s saves ~50% background commands).
  // lockDuration / lockRenewTime: keep lock long enough to not stall on slow AI calls.
  // drainDelay: ms to sleep when the queue is empty (reduces BLPOP/poll frequency).
  stalledInterval: 60_000,
  lockDuration:    60_000,
  lockRenewTime:   30_000,
  drainDelay:      10,
});

worker.on('completed', (job) => {
  logger.info(`[worker] Job ${job.id} processed successfully`);
});

worker.on('failed', (job, err) => {
  logger.error(`[worker] Job ${job?.id} failed after maximum retry attempts`, {
    error: err.message,
    attempts: job?.attemptsMade,
  });
});

worker.on('error', (err) => {
  logger.error('[worker] Dynamic worker exception occurred', { error: err.message });
});

process.on('SIGTERM', async () => {
  await worker.close();
  logger.info('[worker] WhatsApp background worker shut down gracefully.');
  process.exit(0);
});

logger.info('[worker] WhatsFlow AI automated safety worker running smoothly');
