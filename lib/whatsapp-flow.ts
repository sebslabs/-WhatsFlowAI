import { SupabaseClient } from '@supabase/supabase-js';
import { getBaileysSession } from './whatsapp-qr';
import { getFlowQueue } from './flow-queue';
import { logger } from './logger';
import { config } from './config';
import { AIGateway } from '../services/ai-gateway';

export type FlowStepType =
  | 'message'
  | 'question'
  | 'buttons'
  | 'tag'
  | 'notify'
  | 'booking'
  | 'delay'
  | 'condition'
  | 'media'
  | 'payment'
  | 'ai_agent'
  | 'handover'
  | 'end';

export interface FlowStep {
  id: string;
  type: FlowStepType;
  message?: string;
  buttons?: { id: string; label: string }[];
  tagName?: string;
  handoverNote?: string;
  endMessage?: string;
  endLeadStage?: string;
  delayMinutes?: number;
}

export class WhatsAppFlowEngine {
  /**
   * Run or resume a chatbot flow for a connected Baileys session.
   */
  static async processFlow(
    supabase: SupabaseClient,
    tenantId: string,
    contactId: string,
    conversationId: string,
    message: string,
    flowId: string,
    stepIndex = 0,
    sock: any
  ): Promise<void> {
    try {
      // 1. Fetch flow definition
      const { data: flow, error } = await supabase
        .from('chatbot_flows')
        .select('id, definition, is_active')
        .eq('id', flowId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error || !flow || !flow.is_active) {
        logger.warn({ flowId, tenantId }, '[FlowEngine] Flow not found or inactive');
        await this.clearFlowState(supabase, tenantId, contactId);
        return;
      }

      const steps = flow.definition as FlowStep[];
      if (!steps || stepIndex >= steps.length) {
        // Flow finished
        await this.clearFlowState(supabase, tenantId, contactId);
        return;
      }

      const step = steps[stepIndex]!;
      logger.info({ flowId, stepIndex, type: step.type }, '[FlowEngine] Executing flow step');

      // 2. Fetch contact phone
      const { data: contact } = await supabase
        .from('contacts')
        .select('phone')
        .eq('id', contactId)
        .single();

      if (!contact?.phone) {
        logger.error({ contactId }, '[FlowEngine] Contact phone not resolved');
        return;
      }

      const formattedJid = `${contact.phone.replace(/\D/g, '')}@s.whatsapp.net`;

      // 3. Switch based on Node Type
      switch (step.type) {
        case 'message': {
          const text = step.message ?? '';
          if (text) {
            await sock.sendMessage(formattedJid, { text });
            await this.logFlowMessage(supabase, tenantId, conversationId, text, 'ai');
          }
          // Proceed to next step immediately
          await this.processFlow(supabase, tenantId, contactId, conversationId, message, flowId, stepIndex + 1, sock);
          break;
        }

        case 'question': {
          const text = step.message ?? '';
          if (text) {
            await sock.sendMessage(formattedJid, { text });
            await this.logFlowMessage(supabase, tenantId, conversationId, text, 'ai');
          }
          // Pause execution, save flow state, wait for user reply
          await this.saveFlowState(supabase, tenantId, contactId, flowId, stepIndex);
          break;
        }

        case 'buttons': {
          const text = step.message ?? '';
          const buttonLabels = (step.buttons ?? []).map((b) => b.label).join(' | ');
          const formattedText = `${text}\n\n${buttonLabels}`;
          
          await sock.sendMessage(formattedJid, { text: formattedText });
          await this.logFlowMessage(supabase, tenantId, conversationId, formattedText, 'ai');
          
          // Pause and save flow state
          await this.saveFlowState(supabase, tenantId, contactId, flowId, stepIndex);
          break;
        }

        case 'delay': {
          const delayMinutes = step.delayMinutes ?? 1;
          const delayMs = delayMinutes * 60 * 1000;
          await this.saveFlowState(supabase, tenantId, contactId, flowId, stepIndex);
          await getFlowQueue().add(
            'resume-flow',
            {
              tenantId,
              contactId,
              conversationId,
              flowId,
              stepIndex: stepIndex + 1,
            },
            { delay: delayMs }
          );
          break;
        }

        case 'tag': {
          if (step.tagName) {
            const { data: contactData } = await supabase
              .from('contacts')
              .select('tags')
              .eq('id', contactId)
              .maybeSingle();

            const existingTags = Array.isArray(contactData?.tags) ? contactData.tags : [];
            if (!existingTags.includes(step.tagName)) {
              await supabase
                .from('contacts')
                .update({ tags: [...existingTags, step.tagName] })
                .eq('id', contactId);
            }
          }
          await this.processFlow(supabase, tenantId, contactId, conversationId, message, flowId, stepIndex + 1, sock);
          break;
        }

        case 'ai_agent': {
          let selectedAgentId: string | null = null;
          const { data: conv } = await supabase
            .from('conversations')
            .select('metadata')
            .eq('id', conversationId)
            .maybeSingle();

          if (conv?.metadata) {
            const meta = conv.metadata as Record<string, string>;
            selectedAgentId = meta.selected_agent_id || meta.ai_agent_id || null;
          }

          let agent: any = null;
          if (selectedAgentId) {
            const { data } = await supabase
              .from('ai_agents')
              .select('*')
              .eq('id', selectedAgentId)
              .eq('tenant_id', tenantId)
              .maybeSingle();
            if (data?.is_active) agent = data;
          }

          if (!agent) {
            const { data } = await supabase
              .from('ai_agents')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1);
            if (data && data.length > 0) agent = data[0];
          }

          if (agent) {
            const systemPrompt =
              `You are an AI assistant named "${agent.name || 'Assistant'}".\n` +
              `Role: ${agent.role || 'Customer support'}\n` +
              `Tone: ${agent.tone || 'Professional'}\n` +
              `Instructions: ${agent.instructions || 'Be helpful, accurate, and concise.'}\n\n` +
              `Guidelines:\n` +
              `- Keep replies under 3 sentences unless the user asks for detail.\n` +
              `- Use the Knowledge Base context when provided; never invent prices, policies, or features.\n` +
              `- If you cannot help, offer to connect the customer with a human team member.\n` +
              `- Stay on-brand and conversational.\n\n` +
              `IMPORTANT: You are replying via WhatsApp. Do NOT use markdown formatting ` +
              `such as **bold**, ##headings, or bullet points with *. ` +
              `Use plain text only. For emphasis use CAPS sparingly. ` +
              `For lists use a dash (-) or the • character.`;

            const modelStr = (agent.metadata?.full_model as string) || agent.model || 'mistral-large-latest';

            const { data: historyMsgs } = await supabase
              .from('messages')
              .select('sender_type, content')
              .eq('conversation_id', conversationId)
              .order('created_at', { ascending: true })
              .limit(14);

            const history = (historyMsgs || []).map((m) => ({
              role: (m.sender_type === 'user' || m.sender_type === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
              content: m.content,
            }));

            const gatewayRes = await AIGateway.generateResponse({
              message,
              systemPrompt,
              history,
              model: modelStr,
              tenantId,
              conversationId,
              agentId: agent.id,
              userId: contactId,
            });

            const reply = gatewayRes.success && gatewayRes.text
              ? gatewayRes.text
              : 'How can I help you further?';

            await sock.sendMessage(formattedJid, { text: reply });
            await this.logFlowMessage(supabase, tenantId, conversationId, reply, 'ai');
          } else {
            logger.warn({ tenantId }, '[FlowEngine] No active AI agent found for ai_agent step');
          }

          await this.processFlow(supabase, tenantId, contactId, conversationId, message, flowId, stepIndex + 1, sock);
          break;
        }

        case 'handover': {
          await supabase
            .from('conversations')
            .update({ mode: 'manual' })
            .eq('id', conversationId);

          if (step.handoverNote) {
            const note = `[HANDOVER] ${step.handoverNote}`;
            await sock.sendMessage(formattedJid, { text: note });
            await this.logFlowMessage(supabase, tenantId, conversationId, note, 'system');
          }
          await this.clearFlowState(supabase, tenantId, contactId);
          break;
        }

        case 'end': {
          if (step.endMessage) {
            await sock.sendMessage(formattedJid, { text: step.endMessage });
            await this.logFlowMessage(supabase, tenantId, conversationId, step.endMessage, 'ai');
          }
          if (step.endLeadStage) {
            await supabase
              .from('leads')
              .update({ stage: step.endLeadStage, updated_at: new Date().toISOString() })
              .eq('contact_id', contactId);
          }
          await this.clearFlowState(supabase, tenantId, contactId);
          break;
        }

        default:
          // Skip unhandled step types safely
          await this.processFlow(supabase, tenantId, contactId, conversationId, message, flowId, stepIndex + 1, sock);
      }
    } catch (err: any) {
      logger.error({ err: err.message, flowId }, '[FlowEngine] processFlow failed safely');
    }
  }

  /**
   * Find matching keyword trigger flow
   */
  static async matchKeywordFlow(supabase: SupabaseClient, tenantId: string, message: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('chatbot_flows')
        .select('id, definition')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('definition', 'is', null);

      if (!data) return null;

      const lower = message.toLowerCase().trim();
      for (const flow of data) {
        const def = flow.definition as any[];
        const trigger = def?.[0];
        if (trigger?.triggerType === 'keyword' && trigger?.triggerKeyword) {
          if (lower.includes(trigger.triggerKeyword.toLowerCase().trim())) {
            return flow.id;
          }
        }
      }
    } catch (err) {
      logger.error('[FlowEngine] matchKeywordFlow failed', undefined, err);
    }
    return null;
  }

  /**
   * Find welcome / first message trigger flow
   */
  static async findWelcomeFlow(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
    try {
      const { data } = await supabase
        .from('chatbot_flows')
        .select('id, definition')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .not('definition', 'is', null);

      if (!data) return null;

      for (const flow of data) {
        const def = flow.definition as any[];
        const trigger = def?.[0];
        if (trigger?.triggerType === 'first_message') {
          return flow.id;
        }
      }
    } catch (err) {
      logger.error('[FlowEngine] findWelcomeFlow failed', undefined, err);
    }
    return null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private static async logFlowMessage(
    supabase: SupabaseClient,
    tenantId: string,
    conversationId: string,
    content: string,
    senderType: 'ai' | 'system'
  ) {
    await supabase.from('messages').insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      sender_type: senderType,
      content,
      message_type: 'text',
      delivery_status: 'delivered'
    });

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  private static async saveFlowState(
    supabase: SupabaseClient,
    tenantId: string,
    contactId: string,
    flowId: string,
    stepIndex: number
  ) {
    await supabase
      .from('leads')
      .update({
        current_flow_id: flowId,
        current_step_index: stepIndex,
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId);
  }

  private static async clearFlowState(supabase: SupabaseClient, tenantId: string, contactId: string) {
    await supabase
      .from('leads')
      .update({
        current_flow_id: null,
        current_step_index: 0,
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId);
  }

  /**
   * Automatically evaluate conversation context to transition lead stages
   */
  static async evaluateAutoPipelineStage(
    supabase: SupabaseClient,
    tenantId: string,
    contactId: string,
    conversationId: string
  ): Promise<void> {
    try {
      // 1. Check if tenant has AI Auto Pipeline enabled in settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('config')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const config = settingsData?.config as Record<string, any> | null;
      if (!config?.ai_auto_pipeline) return;

      // 2. Fetch the lead
      const { data: lead } = await supabase
        .from('leads')
        .select('id, stage')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .maybeSingle();

      if (!lead) return;

      // 3. Fetch recent conversation history
      const { data: historyMsgs } = await supabase
        .from('messages')
        .select('sender_type, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(15);

      if (!historyMsgs || historyMsgs.length === 0) return;

      const formattedHistory = historyMsgs.map((m) => ({
        role: (m.sender_type === 'customer' || m.sender_type === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

      // 4. Call OpenRouter to evaluate the new stage
      const openrouterKey = config.openrouterApiKey;
      
      // 4. Call AIGateway to evaluate the new stage
      const systemPrompt = `You are a CRM stage evaluator. Look at conversation and select the next lead stage.\n` +
        `Current Stage: "${lead.stage}"\n` +
        `Stages: ["New", "Contacted", "Qualifying", "Qualified", "Proposal", "Booked", "Lost"]\n` +
        `Output ONLY the stage name. Do not output anything else.`;

      const aiGatewayRes = await AIGateway.generateResponse({
        message: JSON.stringify(formattedHistory),
        systemPrompt: systemPrompt,
        model: 'meta-llama/llama-3.1-8b-instruct',
        tenantId: tenantId,
        userId: contactId
      });

      if (aiGatewayRes.success) {
        const rawReply = aiGatewayRes.text.trim();
        const cleanReply = rawReply.replace(/[^a-zA-Z]/g, '');

        const validStages = ['New', 'Contacted', 'Qualifying', 'Qualified', 'Proposal', 'Booked', 'Lost'];
        const matched = validStages.find(s => s.toLowerCase() === cleanReply.toLowerCase());

        if (matched && matched !== lead.stage) {
          await supabase
            .from('leads')
            .update({ stage: matched, updated_at: new Date().toISOString() })
            .eq('id', lead.id);
          console.log(`[FlowEngine] Lead ${lead.id} stage auto-updated to "${matched}"`);
        }
      }
    } catch (err: any) {
      console.warn('[FlowEngine] evaluateAutoPipelineStage failed safely:', err.message);
    }
  }
}
