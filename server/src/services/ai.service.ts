import dotenv from 'dotenv';
import { EmbeddingService } from './embedding.service.js';

dotenv.config();

const NEXTJS_API_URL = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://127.0.0.1:3000'}/api/internal/ai`;
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export interface GatewayMeta {
  escalationRequired?: boolean;
  contextUsed?: boolean;
}

let _lastGatewayMeta: GatewayMeta | null = null;

/**
 * Helper to call the secure consolidated Next.js AIGateway private bridge route.
 */
async function callInternalAI(payload: {
  message: string;
  systemPrompt: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  model?: string;
  tenantId: string;
  userId?: string;
  agentId?: string;
  handoffContext?: { contactId: string; leadId?: string };
  conversationId?: string;
}): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    if (!INTERNAL_API_KEY) {
      throw new Error('INTERNAL_API_KEY is not configured in backend environment');
    }

    const response = await fetch(NEXTJS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Internal AI API bridge returned status ${response.status}: ${errText}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    _lastGatewayMeta = {
      escalationRequired: Boolean(data.escalationRequired),
      contextUsed: Boolean(data.context),
    };
    return {
      success: Boolean(data.success),
      text: String(data.text ?? ''),
      ...(data.error ? { error: String(data.error) } : {}),
    };
  } catch (error: any) {
    console.error('[AIService] Consolidated bridge request failed:', error.message);
    return {
      success: false,
      text: 'Our AI assistant is temporarily offline. A team member will be in touch shortly.',
      error: error.message
    };
  }
}

export class AIService {
  static consumeLastGatewayMeta(): GatewayMeta | null {
    const meta = _lastGatewayMeta;
    _lastGatewayMeta = null;
    return meta;
  }

  /**
   * Get response from OpenAI (Delegates to centralized gateway)
   */
  static async getOpenAIResponse(prompt: string, context: string = '', tenantId = '00000000-0000-0000-0000-000000000000') {
    const res = await callInternalAI({
      message: prompt,
      systemPrompt: context,
      model: 'openai/gpt-4o',
      tenantId
    });
    return res.text;
  }

  /**
   * Get response from Gemini (Delegates to centralized gateway)
   */
  static async getGeminiResponse(prompt: string, context: string = '', tenantId = '00000000-0000-0000-0000-000000000000') {
    const res = await callInternalAI({
      message: prompt,
      systemPrompt: context,
      model: 'google/gemini-flash-1.5',
      tenantId
    });
    return res.text;
  }

  /**
   * Get response from Groq (Delegates to centralized gateway)
   */
  static async getGroqResponse(
    prompt: string,
    context: string = '',
    model: string = 'llama-3.3-70b-versatile',
    tenantId = '00000000-0000-0000-0000-000000000000'
  ) {
    const res = await callInternalAI({
      message: prompt,
      systemPrompt: context,
      model: 'groq/llama-3.3-70b-versatile',
      tenantId
    });
    return res.text;
  }

  /**
   * Get response from Mistral AI (Delegates to centralized gateway)
   */
  static async getMistralResponse(
    prompt: string,
    context: string = '',
    model: string = 'mistral-large-latest',
    tenantId = '00000000-0000-0000-0000-000000000000'
  ) {
    const res = await callInternalAI({
      message: prompt,
      systemPrompt: context,
      model: 'mistral/' + model,
      tenantId
    });
    return res.text;
  }

  /**
   * Get response from OpenRouter (Delegates to centralized gateway)
   */
  static async getOpenRouterResponse(
    prompt: string,
    context: string = '',
    model: string = 'google/gemini-flash-1.5',
    tenantId = '00000000-0000-0000-0000-000000000000'
  ) {
    const res = await callInternalAI({
      message: prompt,
      systemPrompt: context,
      model: 'openrouter/' + model,
      tenantId
    });
    return res.text;
  }

  /**
   * Get a response from an AI agent persona (Delegates to centralized gateway)
   */
  static async getAgentResponse(
    message:      string,
    systemPrompt: string,
    history:      { role: 'user' | 'assistant'; content: string }[] = [],
    modelStr:     string = 'mistral-large-latest',
    tenantId:     string = '00000000-0000-0000-0000-000000000000',
    agentId?:     string,
    handoffContext?: { contactId: string; leadId?: string },
    conversationId?: string
  ): Promise<string> {
    const useOr = !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.length > 10);
    const routedModel = useOr && !modelStr.startsWith('openrouter/')
      ? `openrouter/${modelStr}`
      : modelStr;

    const res = await callInternalAI({
      message,
      systemPrompt,
      history,
      model: routedModel,
      tenantId,
      ...(agentId ? { agentId } : {}),
      ...(handoffContext ? { handoffContext } : {}),
      ...(conversationId ? { conversationId } : {}),
    });
    return res.text;
  }

  /**
   * Evaluate lead stage (Delegates to centralized gateway)
   */
  static async evaluateLeadStage(
    history: { role: 'user' | 'assistant'; content: string }[],
    currentStage: string,
    tenantId: string = '00000000-0000-0000-0000-000000000000'
  ): Promise<string | null> {
    try {
      const validStages = ['New', 'Contacted', 'Qualifying', 'Qualified', 'Proposal', 'Booked', 'Lost'];
      
      const systemPrompt = `You are a CRM AI. Analyze this conversation history between our business assistant and a potential lead (user) to determine the most accurate lead stage.
      
Available pipeline stages:
- "New": Just reached out.
- "Contacted": The lead has replied to our initial message.
- "Qualifying": The assistant is learning requirements or the lead is asking about prices, services, availability.
- "Qualified": Lead exhibits high intent and matches core product/service parameters.
- "Proposal": An explicit proposal, quote, price estimate, or booking appointment link has been provided.
- "Booked": User confirmed they have scheduled the meeting, placed order, or paid.
- "Lost": Lead said they are not interested or opted out.

Current Stage: "${currentStage}"

Instructions:
1. Choose the BEST stage from the list: ${validStages.join(', ')}.
2. Output ONLY the exact word of the selected stage. Do not write a sentence.
3. If no change in intent occurred, output "${currentStage}".`;

      const res = await callInternalAI({
        message: JSON.stringify(history),
        systemPrompt,
        model: 'meta-llama/llama-3.1-8b-instruct',
        tenantId
      });

      if (!res.success) return null;

      const parsed = res.text.replace(/["'`.!]/g, '').trim();
      const matched = validStages.find(s => s.toLowerCase() === parsed.toLowerCase());
      
      if (matched && matched.toLowerCase() !== currentStage.toLowerCase()) {
        console.log(`[AIService] Auto-stage changed for lead: "${currentStage}" -> "${matched}"`);
        return matched;
      }
      
      return null;
    } catch (err: any) {
      console.warn('[AIService] evaluateLeadStage failed safely:', err.message);
      return null;
    }
  }

  /**
   * Generate embeddings for RAG
   */
  static async generateEmbeddings(text: string): Promise<number[]> {
    try {
      return await EmbeddingService.generateEmbedding(text);
    } catch (error: any) {
      console.error('[AIService] Embedding Error:', error.message);
      return [];
    }
  }
}
