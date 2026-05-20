/**
 * WhatsFlow AI — AI Safety & Security Type Definitions
 * Designed for production multi-tenant environments.
 */

export interface ThreatClassification {
  safe: boolean;
  riskScore: number; // 0.0 to 1.0 (or 0 to 100)
  category: ThreatCategory;
  reason: string;
}

export type ThreatCategory =
  | 'none'
  | 'prompt_injection'
  | 'jailbreak'
  | 'system_prompt_probe'
  | 'harmful_content'
  | 'role_manipulation'
  | 'secrets_request'
  | 'unsafe_business_request'
  | 'data_exfiltration'
  | 'pii_leak'
  | 'other';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterCompletionOptions {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  responseFormat?: { type: 'json_object' } | undefined;
  tenantId: string;
  leadId?: string | undefined;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface OpenRouterResponse {
  text: string;
  model: string;
  usage: TokenUsage;
  cost: number; // calculated in USD
  latencyMs: number;
}

export interface BudgetStatus {
  allowed: boolean;
  reason?: 'token_limit_exceeded' | 'cost_limit_exceeded' | undefined;
  tokensUsedToday: number;
  tokenLimit: number;
  costUsedToday: number;
  costLimit: number;
}

export interface GuardrailResult {
  allowed: boolean;
  action: 'process' | 'block' | 'human_handoff';
  classification?: ThreatClassification | undefined;
  sanitizedContent?: string | undefined;
  reason?: string | undefined;
}

export interface AISecurityLog {
  tenantId: string;
  leadId: string;
  riskScore: number;
  category: ThreatCategory;
  blocked: boolean;
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  rawInputPreview: string;
  actionTaken: 'process' | 'block' | 'handoff';
  createdAt?: string | undefined;
}
