import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import type {
  OpenRouterMessage,
  OpenRouterCompletionOptions,
  OpenRouterResponse,
  TokenUsage,
} from '../types/ai-security.types.js';

dotenv.config();

// ── Model Pricing Estimates per 1,000,000 Tokens (USD) ────────────────────────
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'meta-llama/llama-guard-3-8b': { input: 0.20, output: 0.20 },
  'google/gemini-flash-1.5': { input: 0.075, output: 0.30 },
  'mistralai/mistral-small': { input: 0.20, output: 0.60 },
  'openai/gpt-4o-mini': { input: 0.15, output: 0.60 },
  // Fallback defaults
  'default': { input: 0.20, output: 0.60 },
};

function calculateCost(model: string, usage: TokenUsage): number {
  const price = MODEL_PRICING[model] || MODEL_PRICING['default'] || { input: 0.20, output: 0.60 };
  const inputCost = (usage.promptTokens / 1_000_000) * price.input;
  const outputCost = (usage.completionTokens / 1_000_000) * price.output;
  return Number((inputCost + outputCost).toFixed(6));
}

// ── Fallback Chain Configuration ──────────────────────────────────────────────
const FALLBACK_CHAIN = [
  'google/gemini-flash-1.5',
  'openai/gpt-4o-mini',
  'mistralai/mistral-small',
];

export class OpenRouterClient {
  private static apiKey = process.env.OPENROUTER_API_KEY || '';
  private static endpoint = 'https://openrouter.ai/api/v1/chat/completions';

  /**
   * Helper to perform a single fetch attempt with custom timeout
   */
  private static async attemptRequest(
    options: OpenRouterCompletionOptions,
    modelOverride?: string,
    timeoutMs = 12000
  ): Promise<OpenRouterResponse> {
    const activeModel = modelOverride || options.model;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://whatsflow.ai',
      'X-Title': 'WhatsFlow AI Enterprise Safety',
    };

    const body = {
      model: activeModel,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 800,
      temperature: options.temperature ?? 0.1,
      response_format: options.responseFormat,
    };

    const startTime = Date.now();

    try {
      if (!this.apiKey) {
        throw new Error('OPENROUTER_API_KEY is not defined in the environment variables.');
      }

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();
      const latencyMs = Date.now() - startTime;

      const choice = responseData?.choices?.[0];
      const text = choice?.message?.content || '';
      const responseModel = responseData?.model || activeModel;

      const usage: TokenUsage = {
        promptTokens: responseData?.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(options.messages).length / 4),
        completionTokens: responseData?.usage?.completion_tokens ?? Math.ceil(text.length / 4),
        totalTokens: responseData?.usage?.total_tokens ?? 0,
      };
      
      usage.totalTokens = usage.promptTokens + usage.completionTokens;

      const cost = calculateCost(responseModel, usage);

      return {
        text,
        model: responseModel,
        usage,
        cost,
        latencyMs,
      };
    } catch (err: any) {
      clearTimeout(id);
      if (err.name === 'AbortError') {
        throw new Error(`Request to model ${activeModel} timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
  }

  /**
   * Main completion method with automatic retries and model fallbacks
   */
  public static async generateResponse(
    options: OpenRouterCompletionOptions
  ): Promise<OpenRouterResponse> {
    const maxRetries = 2;
    const initialModel = options.model;
    const candidates = [initialModel, ...FALLBACK_CHAIN.filter((m) => m !== initialModel)];

    for (const model of candidates) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          logger.info(`[OpenRouter] Attempting completion`, {
            model,
            tenantId: options.tenantId,
            attempt,
          });

          // Dynamic timeout: reduce duration for secondary attempts/fallbacks to stay responsive
          const timeout = model === initialModel ? 15000 : 8000;
          const result = await this.attemptRequest(options, model, timeout);
          
          logger.info(`[OpenRouter] Completion succeeded`, {
            model: result.model,
            latency: result.latencyMs,
            cost: result.cost,
            tenantId: options.tenantId,
          });
          
          return result;
        } catch (err: any) {
          logger.warn(`[OpenRouter] Attempt ${attempt} failed with model ${model}`, {
            error: err.message,
            tenantId: options.tenantId,
          });

          if (attempt === maxRetries) {
            logger.warn(`[OpenRouter] Model ${model} exhausted. Switching to fallback option…`);
          } else {
            // Exponential backoff before retry (e.g. 500ms, 1000ms)
            await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          }
        }
      }
    }

    throw new Error('All preferred and fallback OpenRouter model endpoints failed.');
  }
}
