/**
 * Unified AI reply pipeline — Meta WhatsApp, Baileys QR, and shared backend paths.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { AIService } from './ai.service.js';
import { AIGuardService } from './ai-guard.service.js';
import { HumanHandoffService } from './human-handoff.service.js';
import { ResponseValidator } from './response-validator.js';
import { TokenBudgetService } from './token-budget.service.js';
import { AISecurityLogService } from './ai-security-log.service.js';
import { logger } from '../utils/logger.js';

export interface ActiveAgentRecord {
  id: string;
  name?: string | null;
  role?: string | null;
  tone?: string | null;
  instructions?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AiReplyPipelineInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  leadId?: string;
  message: string;
  agent: ActiveAgentRecord;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface AiReplyPipelineResult {
  replied: boolean;
  handoff: boolean;
  replyText?: string;
  model?: string;
  totalTokens?: number;
  blockReason?: string;
}

function buildAgentSystemPrompt(agent: ActiveAgentRecord): string {
  return (
    `You are an AI assistant named "${agent.name ?? 'Assistant'}".\n` +
    `Role: ${agent.role ?? 'Customer support'}\n` +
    `Tone: ${agent.tone ?? 'Professional'}\n` +
    `Instructions: ${agent.instructions ?? 'Be helpful, accurate, and concise.'}\n\n` +
    `Guidelines:\n` +
    `- Keep replies under 3 sentences unless the user asks for detail.\n` +
    `- Use the Knowledge Base context when provided; never invent prices, policies, or features.\n` +
    `- If you cannot help, offer to connect the customer with a human team member.\n` +
    `- Stay on-brand and conversational.\n\n` +
    `IMPORTANT: You are replying via WhatsApp. Do NOT use markdown formatting ` +
    `such as **bold**, ##headings, or bullet points with *. ` +
    `Use plain text only. For emphasis use CAPS sparingly. ` +
    `For lists use a dash (-) or the • character.`
  );
}

export class AiReplyPipeline {
  static async process(input: AiReplyPipelineInput): Promise<AiReplyPipelineResult> {
    const { tenantId, contactId, conversationId, leadId, message, agent, history } = input;
    const safeLeadId = leadId ?? 'unknown';

    const budget = await TokenBudgetService.checkBudget(tenantId);
    if (!budget.allowed) {
      logger.warn('[AiReplyPipeline] Token budget exceeded — skipping AI reply', { tenantId, reason: budget.reason });
      return {
        replied: false,
        handoff: true,
        ...(budget.reason ? { blockReason: budget.reason } : {}),
      };
    }

    if (HumanHandoffService.containsHandoffIntent(message)) {
      await HumanHandoffService.initiateHandoff(
        tenantId,
        contactId,
        'Customer explicitly requested human assistance',
        leadId
      );
      return {
        replied: true,
        handoff: true,
        replyText:
          'I understand — I am connecting you with a team member who will assist you shortly. Thank you for your patience.',
      };
    }

    const threatClass = await AIGuardService.classifyMessage(tenantId, message, safeLeadId);
    if (!threatClass.safe) {
      await AISecurityLogService.logIncident({
        tenantId,
        leadId: safeLeadId,
        riskScore: threatClass.riskScore,
        category: threatClass.category,
        blocked: true,
        modelUsed: agent.model || 'meta-llama/llama-guard-3-8b',
        inputTokens: Math.ceil(message.length / 4),
        outputTokens: 0,
        cost: 0,
        rawInputPreview: message,
        actionTaken: 'block',
      });
      await HumanHandoffService.initiateHandoff(
        tenantId,
        contactId,
        `Security policy: ${threatClass.reason}`,
        leadId
      );
      return {
        replied: false,
        handoff: true,
        blockReason: threatClass.reason,
      };
    }

    const systemPrompt = buildAgentSystemPrompt(agent);
    const modelStr =
      (agent.metadata?.full_model as string) || agent.model || 'mistral-large-latest';

    const rawReply = await AIService.getAgentResponse(
      message,
      systemPrompt,
      history,
      modelStr,
      tenantId,
      agent.id,
      { contactId, ...(leadId ? { leadId } : {}) },
      conversationId
    );

    const gatewayMeta = AIService.consumeLastGatewayMeta();
    if (gatewayMeta?.escalationRequired) {
      await HumanHandoffService.initiateHandoff(
        tenantId,
        contactId,
        'Escalation keywords or negative sentiment detected in AI gateway',
        leadId
      );
      return {
        replied: true,
        handoff: true,
        replyText:
          rawReply?.trim() ||
          'I want to make sure you get the right help. A team member will follow up with you shortly.',
        model: modelStr,
      };
    }

    if (!rawReply?.trim()) {
      return { replied: false, handoff: false, blockReason: 'empty_model_response' };
    }

    const validation = await ResponseValidator.validateResponse(
      tenantId,
      safeLeadId,
      rawReply,
      systemPrompt
    );

    if (!validation.valid) {
      await HumanHandoffService.initiateHandoff(
        tenantId,
        contactId,
        `Response validation failed: ${validation.reason}`,
        leadId
      );
      return {
        replied: true,
        handoff: true,
        replyText: validation.sanitizedText.slice(0, 1000),
        model: modelStr,
        ...(validation.reason ? { blockReason: validation.reason } : {}),
      };
    }

    const finalReply = validation.sanitizedText.slice(0, 1000);
    const totalTokens = Math.ceil((message.length + finalReply.length) / 4);

    await TokenBudgetService.incrementUsage(tenantId, totalTokens, 0);

    if (leadId && history.length >= 1) {
      void AiReplyPipeline.maybeUpdateLeadStage(tenantId, leadId, history, message, finalReply);
    }

    return {
      replied: true,
      handoff: false,
      replyText: finalReply,
      model: modelStr,
      totalTokens,
    };
  }

  private static async maybeUpdateLeadStage(
    tenantId: string,
    leadId: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    latestUser: string,
    latestAssistant: string
  ): Promise<void> {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: lead } = await supabase
        .from('leads')
        .select('stage')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const currentStage = lead?.stage ?? 'New';
      const fullHistory = [
        ...history,
        { role: 'user' as const, content: latestUser },
        { role: 'assistant' as const, content: latestAssistant },
      ];

      const newStage = await AIService.evaluateLeadStage(fullHistory, currentStage, tenantId);
      if (newStage) {
        await supabase
          .from('leads')
          .update({ stage: newStage, updated_at: new Date().toISOString() })
          .eq('id', leadId)
          .eq('tenant_id', tenantId);
        logger.info('[AiReplyPipeline] Lead stage updated', { leadId, from: currentStage, to: newStage });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[AiReplyPipeline] Lead stage evaluation skipped', { leadId, error: msg });
    }
  }

  /** Check tenant + lead AI toggles before invoking the pipeline. */
  static async isAiAllowed(
    db: SupabaseClient,
    tenantId: string,
    leadId?: string | null
  ): Promise<boolean> {
    if (leadId) {
      const { data: lead } = await db
        .from('leads')
        .select('ai_active')
        .eq('id', leadId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (lead && lead.ai_active === false) return false;
    }

    const { data: aiCfg } = await db
      .from('ai_settings')
      .select('auto_response_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    return aiCfg?.auto_response_enabled !== false;
  }
}
