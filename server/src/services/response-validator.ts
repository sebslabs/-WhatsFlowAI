import { sanitizeAiResponse } from '../utils/ai-guards.js';
import { OpenRouterClient } from './openrouter.client.js';
import { logger } from '../utils/logger.js';
import type { ThreatClassification } from '../types/ai-security.types.js';

export class ResponseValidator {
  // PII Patterns
  private static CREDIT_CARD_REGEX = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/;
  private static SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/;
  private static JWT_KEY_REGEX = /\beyJhbGciOi[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/;

  /**
   * Scans and sanitizes outgoing AI responses before sending to WhatsApp
   */
  public static async validateResponse(
    tenantId: string,
    leadId: string,
    rawResponse: string,
    systemPrompt: string
  ): Promise<{ valid: boolean; sanitizedText: string; reason?: string }> {
    // 1. Clean response using local blocklists
    let sanitizedText = sanitizeAiResponse(rawResponse);

    // 2. Perform fast local regex scans for PII leaks
    if (this.CREDIT_CARD_REGEX.test(sanitizedText)) {
      logger.warn('[ResponseValidator] Credit Card leak detected in AI response — masking', { tenantId, leadId });
      sanitizedText = sanitizedText.replace(this.CREDIT_CARD_REGEX, '[REDACTED CARD]');
    }

    if (this.SSN_REGEX.test(sanitizedText)) {
      logger.warn('[ResponseValidator] SSN leak detected in AI response — masking', { tenantId, leadId });
      sanitizedText = sanitizedText.replace(this.SSN_REGEX, '[REDACTED ID]');
    }

    if (this.JWT_KEY_REGEX.test(sanitizedText)) {
      logger.warn('[ResponseValidator] JWT/API Key leak detected in AI response — blocking', { tenantId, leadId });
      return {
        valid: false,
        sanitizedText: 'Let me connect you with a representative to finalize that detail.',
        reason: 'Sensitive API token or credential leaked in response',
      };
    }

    // 3. System Prompt leak check (e.g. if the assistant repeats parts of its instruction verbatim)
    const normalizedPrompt = systemPrompt.toLowerCase();
    const normalizedResponse = sanitizedText.toLowerCase();

    // If the assistant outputs large segments of the system instructions
    if (normalizedResponse.includes('you are an ai assistant named') || 
        normalizedResponse.includes('instructions: be helpful and concise') ||
        (normalizedResponse.length > 50 && normalizedPrompt.includes(normalizedResponse))) {
      logger.warn('[ResponseValidator] System prompt extraction detected in response', { tenantId, leadId });
      return {
        valid: false,
        sanitizedText: 'I apologize for the confusion. How else can I help you today?',
        reason: 'System prompt leakage detected',
      };
    }

    // 4. Optional Layer 3: Advanced semantic verification using a cheap OpenRouter model
    // This catches severe hallucinations, such as the AI claiming to be a human or agreeing to unauthorized discounts.
    try {
      const isUnsafeSemantic = await this.semanticHallucinationCheck(tenantId, leadId, sanitizedText);
      if (isUnsafeSemantic) {
        logger.warn('[ResponseValidator] Semantic safety check failed — blocking response', { tenantId, leadId });
        return {
          valid: false,
          sanitizedText: 'Let me grab a team member to clarify those pricing details for you.',
          reason: 'Severe semantic anomaly or hallucination detected (e.g. unauthorized promises)',
        };
      }
    } catch (err: any) {
      logger.warn('[ResponseValidator] Semantic safety check bypassed due to exception', { error: err.message });
    }

    return {
      valid: true,
      sanitizedText,
    };
  }

  /**
   * Queries OpenRouter to check if the AI is hallucinating illegal/unauthorized business commitments
   */
  private static async semanticHallucinationCheck(
    tenantId: string,
    leadId: string,
    response: string
  ): Promise<boolean> {
    const prompt = `Evaluate if the following AI assistant message violates company policy.
Rules to check:
1. Does the AI claim to be a human or suggest they are in a physical office?
2. Does the AI promise explicit discounts larger than 90% or say services are "completely free" without authorization?
3. Does the AI use highly unprofessional profanities?

Assistant Message: "${response}"

Output strictly either 'safe' or 'unsafe'. Do not output any other text.`;

    try {
      const check = await OpenRouterClient.generateResponse({
        model: 'google/gemini-flash-1.5',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 10,
        temperature: 0.0,
        tenantId,
        leadId,
      });

      return check.text.trim().toLowerCase().includes('unsafe');
    } catch {
      return false; // Fail open for the hallucination check to keep response latency low
    }
  }
}
