/**
 * Enhanced AI Gateway — v2
 * Adds: conversation memory, sentiment detection, typing indicators,
 * multi-model fallback chain, RAG caching, escalation detection.
 */
import { createClient } from '@supabase/supabase-js';
import { getRateLimiter } from '@/lib/rate-limit';
import { config } from '@/lib/config';
import { logger } from '@/lib/logger';
import { checkPromptInjection, sanitizeAiResponse } from '@/lib/ai-guards';
import { retrieveRAGContext } from '@/lib/rag';
import { initiateHumanHandoff, containsHandoffIntent } from '@/lib/human-handoff';
import { resolveOpenRouterModel, shouldUseOpenRouterOnly } from '@/lib/openrouter-model';

/**
 * getRateLimiter() now uses the in-process LRU cache (lib/memory-cache.ts) —
 * no Redis credentials needed. The limiter is instantiated once and cached
 * module-level for zero allocation overhead on subsequent calls.
 */
const _limiter = getRateLimiter('ai-gateway', 60, 60); // 60 req/min per tenant:user

function getAiLimiter() {
  return _limiter;
}

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// ── Types ───────────────────────────────────────────────────────────────────

export interface AIGatewayRequest {
  message: string;
  systemPrompt: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  model?: string;
  tenantId: string;
  conversationId?: string;
  userId?: string;
  agentId?: string;
  enableTypingIndicator?: boolean;
  typingCallback?: () => Promise<void>;
  /** When set, RAG only uses these knowledge_base row IDs (plus expanded chunks). */
  knowledgeSourceIds?: string[] | null;
  /** When set, escalation/handoff intents pause AI on the lead. */
  handoffContext?: { contactId: string; leadId?: string };
}

export interface AIGatewayResponse {
  success: boolean;
  text: string;
  context?: string;
  provider: string;
  model: string;
  metrics?: { latencyMs: number };
  sentiment?: SentimentResult;
  suggestedReplies?: string[];
  escalationRequired?: boolean;
  error?: string;
  blockedByGuard?: boolean;
}

export interface SentimentResult {
  label: 'positive' | 'neutral' | 'negative' | 'escalated';
  score: number; // -1.0 to +1.0
  escalationRequired: boolean;
}

// ── Sentinel keywords for escalation ────────────────────────────────────────

const ESCALATION_KEYWORDS = [
  /\b(human|agent|representative|manager|supervisor)\b/i,
  /\b(angry|furious|disgusted|unacceptable|terrible|horrible)\b/i,
  /\b(refund|cancel|lawsuit|legal|scam|fraud|cheat)\b/i,
  /\b(complaint|complain|report|escalate)\b/i,
];

function detectEscalation(text: string): boolean {
  return ESCALATION_KEYWORDS.some(p => p.test(text));
}

// ── Sentiment heuristic (fast, no LLM call) ──────────────────────────────────

const POSITIVE_WORDS = ['thank','great','perfect','awesome','excellent','love','good','happy','helpful'];
const NEGATIVE_WORDS = ['bad','terrible','worst','hate','useless','broken','wrong','frustrat','upset','angry'];

function detectSentiment(text: string): SentimentResult {
  const lower = text.toLowerCase();
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length;
  const score = Math.max(-1, Math.min(1, (pos - neg) / Math.max(pos + neg, 1)));
  const escalationRequired = detectEscalation(text) || score < -0.4;
  let label: SentimentResult['label'] = 'neutral';
  if (escalationRequired) label = 'escalated';
  else if (score > 0.2) label = 'positive';
  else if (score < -0.2) label = 'negative';
    return { label, score, escalationRequired };
}

function enrichHistoryForLongThreads(
  history: { role: 'user' | 'assistant'; content: string }[]
): { role: 'user' | 'assistant'; content: string }[] {
  if (history.length <= 10) return history;

  const recent = history.slice(-8);
  const userTopics = history
    .filter((h) => h.role === 'user')
    .slice(0, 4)
    .map((h) => h.content.replace(/\s+/g, ' ').trim().slice(0, 100))
    .filter(Boolean);

  const summaryLine =
    userTopics.length > 0
      ? `[Conversation summary — ${history.length} prior turns. Earlier user topics: ${userTopics.join(' | ')}. Continue coherently from recent messages below.]`
      : `[Conversation summary — ${history.length} prior turns. Continue coherently from recent messages below.]`;

  return [{ role: 'assistant', content: summaryLine }, ...recent];
}

// ── Conversation context (memory) ────────────────────────────────────────────

async function loadConversationHistory(
  tenantId: string,
  conversationId: string,
  limit = 10
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const { data } = await supabase
    .from('messages')
    .select('sender_type, content')
    .eq('conversation_id', conversationId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data?.length) return [];
  return data
    .reverse()
    .map(m => ({
      role: m.sender_type === 'user' || m.sender_type === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }));
}

async function saveConversationContext(
  tenantId: string,
  conversationId: string,
  sentiment: SentimentResult
): Promise<void> {
  try {
    await supabase.from('conversation_contexts').upsert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      sentiment: sentiment.label,
      sentiment_score: sentiment.score,
      escalated: sentiment.escalationRequired,
      escalated_at: sentiment.escalationRequired ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,conversation_id' });
  } catch { /* non-blocking */ }
}

// ── Provider executors ───────────────────────────────────────────────────────

type Messages = { role: 'system' | 'user' | 'assistant'; content: string }[];

async function callOpenRouter(msgs: Messages, model: string): Promise<string> {
  if (!config.openrouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const orModel = resolveOpenRouterModel(model);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openrouterApiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://whatsflow.ai',
      'X-Title': 'WhatsFlow AI',
    },
    body: JSON.stringify({ model: orModel, messages: msgs, max_tokens: 600, temperature: 0.4 }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    logger.error({ status: res.status, body: bodyText.slice(0, 500), model: orModel }, '[AIGateway] OpenRouter error');
    throw new Error(`OpenRouter ${res.status}: ${bodyText.slice(0, 200)}`);
  }

  const data = JSON.parse(bodyText) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text) throw new Error('OpenRouter returned empty content');
  return text;
}

async function callMistral(msgs: Messages, model: string): Promise<string> {
  if (!config.mistralApiKey) throw new Error('No Mistral key');
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.mistralApiKey}` },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`Mistral ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

async function callGroq(msgs: Messages, model: string): Promise<string> {
  if (!config.groqApiKey) throw new Error('No Groq key');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.groqApiKey}` },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

async function callOpenAI(msgs: Messages, model: string): Promise<string> {
  if (!config.openaiApiKey) throw new Error('No OpenAI key');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.openaiApiKey}` },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 600 }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  return (await res.json()).choices?.[0]?.message?.content ?? '';
}

async function callGemini(msgs: Messages, model: string): Promise<string> {
  if (!config.geminiApiKey) throw new Error('No Gemini key');
  const ctx = msgs.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: ctx }] }] }) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return (await res.json()).candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── Multi-model fallback chain ────────────────────────────────────────────────

const OPENROUTER_FALLBACK_MODELS = [
  'google/gemini-2.0-flash-001',
  'openai/gpt-4o-mini',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-small',
];

async function generateWithFallback(
  msgs: Messages,
  preferredModel: string
): Promise<{ text: string; provider: string; model: string }> {
  if (shouldUseOpenRouterOnly()) {
    const primary = resolveOpenRouterModel(preferredModel);
    const modelsToTry = [primary, ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== primary)];

    for (const orModel of modelsToTry) {
      try {
        const text = await callOpenRouter(msgs, orModel);
        if (text) return { text, provider: 'openrouter', model: orModel };
      } catch (err) {
        logger.warn({ error: (err as Error).message, orModel }, '[AIGateway] OpenRouter model failed');
      }
    }
    throw new Error('All OpenRouter models failed — check OPENROUTER_API_KEY and account credits');
  }

  const n = preferredModel.toLowerCase();
  const preferred: (msgs: Messages) => Promise<string> =
    n.includes('mistral') ? (m) => callMistral(m, 'mistral-large-latest') :
    n.includes('gpt') ? (m) => callOpenAI(m, 'gpt-4o-mini') :
    n.includes('gemini') ? (m) => callGemini(m, 'gemini-1.5-flash') :
    n.includes('groq') || n.includes('llama') ? (m) => callGroq(m, 'llama-3.3-70b-versatile') :
    (m) => callOpenRouter(m, preferredModel);

  const fallbacks: Array<(msgs: Messages) => Promise<string>> = [
    preferred,
    (m) => callOpenRouter(m, 'openai/gpt-4o-mini'),
    (m) => callMistral(m, 'mistral-large-latest'),
    (m) => callOpenAI(m, 'gpt-4o-mini'),
    (m) => callGemini(m, 'gemini-1.5-flash'),
    (m) => callGroq(m, 'llama-3.3-70b-versatile'),
  ];

  for (const fn of fallbacks) {
    try {
      const text = await fn(msgs);
      if (text) return { text, provider: fn.name || 'unknown', model: preferredModel };
    } catch (err) {
      logger.warn({ error: (err as Error).message }, '[AIGateway] Provider failed, trying next');
    }
  }

  throw new Error('All AI providers failed');
}

// ── Main gateway ─────────────────────────────────────────────────────────────

export class AIGateway {
  static async generateResponse(req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const start = Date.now();
    const {
      message, systemPrompt, history = [], model = 'mistral-large-latest',
      tenantId, conversationId, userId = 'system', typingCallback,
      knowledgeSourceIds, handoffContext, agentId,
    } = req;

    logger.info(`[AIGateway] Generating reply for conversationId ${conversationId || 'unknown'}`);

    // ── 1. Injection guard ──────────────────────────────────────────────────
    const guard = checkPromptInjection(message);
    if (guard.isInjection) {
      logger.warn({ tenantId, userId, patterns: guard.matchedLabels }, '[AIGateway] Injection blocked');
      return {
        success: false,
        text: 'Your message could not be processed. Please rephrase and try again.',
        provider: 'AIGuard', model: 'static',
        blockedByGuard: true,
        metrics: { latencyMs: Date.now() - start },
      };
    }

    // ── 2. Rate limit ────────────────────────────────────────────────────────
    const limiter = getAiLimiter();
    if (limiter) {
      try {
        const { success } = await limiter.limit(`${tenantId}:${userId}`);
        if (!success) {
          return {
            success: false,
            text: 'Too many AI requests. Please wait a moment.',
            provider: 'RateLimiter', model: 'static',
            metrics: { latencyMs: Date.now() - start },
            error: 'Rate limit exceeded',
          };
        }
      } catch {
        logger.warn('[AIGateway] Rate limiter unavailable — continuing without rate limit');
      }
    }

    // ── 3. Sentiment detection & early handoff ───────────────────────────────
    const sentiment = detectSentiment(message);

    if (handoffContext && (sentiment.escalationRequired || containsHandoffIntent(message))) {
      const reason = containsHandoffIntent(message)
        ? 'Customer requested human assistance'
        : 'Escalation keywords or negative sentiment detected';
      await initiateHumanHandoff(
        tenantId,
        handoffContext.contactId,
        reason,
        handoffContext.leadId
      );
      return {
        success: true,
        text: 'I understand this is important. A team member will follow up with you shortly. Thank you for your patience.',
        provider: 'Handoff', model: 'static',
        metrics: { latencyMs: Date.now() - start },
        sentiment,
        escalationRequired: true,
      };
    }

    // ── 4. Typing indicator callback ─────────────────────────────────────────
    if (typingCallback) {
      try { await typingCallback(); } catch { /* non-blocking */ }
    }

    // ── 5. Load conversation history (memory) ───────────────────────────────
    let contextHistory = history;
    if (conversationId && !history.length) {
      contextHistory = await loadConversationHistory(tenantId, conversationId, 14);
    }
    contextHistory = enrichHistoryForLongThreads(contextHistory);

    // ── 6. RAG retrieval ─────────────────────────────────────────────────────
    let ragCtx = '';
    try {
      const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key';
      const openrouterKey = process.env.OPENROUTER_API_KEY;
      if (!hasOpenAI && !openrouterKey) {
        logger.warn('[RAG] Embeddings API key not configured — RAG skipped');
      } else {
        ragCtx = await retrieveRAGContext(message, tenantId, knowledgeSourceIds, agentId);
      }
    } catch {
      /* skip */
    }

    const cleanSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You are replying via WhatsApp. Do NOT use markdown formatting such as **bold**, ##headings, or bullet points with *. Use plain text only. For emphasis use CAPS sparingly. For lists use a dash (-) or the • character.`;

    const augmentedPrompt = ragCtx
      ? `${cleanSystemPrompt}\n\nUse the following Knowledge Base excerpts to answer accurately. If the answer is not in the excerpts, say you do not have that information and offer to connect them with a human.\n\n[Knowledge Base Context]:\n${ragCtx}`
      : cleanSystemPrompt;

    // ── 7. Build messages array ──────────────────────────────────────────────
    const msgs: Messages = [
      { role: 'system', content: augmentedPrompt },
      ...contextHistory,
      { role: 'user', content: message },
    ];

    // ── 8. Generate with multi-model fallback ────────────────────────────────
    try {
      const { text, provider, model: usedModel } = await generateWithFallback(msgs, model);
      const sanitized = sanitizeAiResponse(text);
      const latencyMs = Date.now() - start;

      // ── 9. Save context / sentiment to DB ─────────────────────────────────
      if (conversationId) {
        saveConversationContext(tenantId, conversationId, sentiment).catch(() => {});
      }

      logger.info({ tenantId, provider, latencyMs }, '[AIGateway] Response generated');

      return {
        success: true,
        text: sanitized,
        context: ragCtx || undefined,
        provider,
        model: usedModel,
        metrics: { latencyMs },
        sentiment,
        escalationRequired: sentiment.escalationRequired,
      };

    } catch (err: any) {
      logger.error({ tenantId, error: err.message }, '[AIGateway] All providers failed');
      return {
        success: false,
        text: 'Our AI assistant is temporarily unavailable. A team member will reply shortly.',
        provider: 'Error-Fallback', model: 'none',
        metrics: { latencyMs: Date.now() - start },
        sentiment,
        escalationRequired: true,
        error: err.message,
      };
    }
  }
}
