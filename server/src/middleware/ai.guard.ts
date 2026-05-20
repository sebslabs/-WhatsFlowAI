/**
 * AI Hardening Middleware
 *
 * Protects the AI pipeline from:
 *  - Token budget exhaustion (per-tenant daily cap)
 *  - Prompt injection attacks
 *  - Excessive conversation history (memory limits)
 *  - API rate limit cascades
 *  - Runaway costs
 *
 * Usage (in webhook.worker.ts before getAgentResponse):
 *   const safe = await AIGuard.check(tenantId, message, history)
 *   if (!safe.allowed) { ... skip AI ... }
 *   const safeMessage = safe.sanitizedMessage
 */

import { createClient } from '@supabase/supabase-js'
import { logger } from '../utils/logger.js'

// ── Config ────────────────────────────────────────────────────────────────────

const TOKEN_BUDGET_DAILY    = parseInt(process.env.AI_DAILY_TOKEN_BUDGET   ?? '10000', 10)
const MAX_HISTORY_MESSAGES  = parseInt(process.env.AI_MAX_HISTORY          ?? '10',    10)
const MAX_MESSAGE_LENGTH    = parseInt(process.env.AI_MAX_MESSAGE_LENGTH   ?? '2000',  10)

// ── Prompt Injection Patterns ─────────────────────────────────────────────────
// Detect common jailbreak/injection attempts
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+(a\s+)?DAN/i,
  /act\s+as\s+(if\s+you\s+are\s+)?a/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /###\s*Instruction/i,
  /disregard\s+(your|all)\s+(previous|prior)/i,
  /pretend\s+(you|that\s+you)\s+(are|have)/i,
]

// ── Token Estimation ──────────────────────────────────────────────────────────
// Rough estimate: 1 token ≈ 4 characters (good enough for budgeting)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// ── Guard Result ──────────────────────────────────────────────────────────────

export interface AIGuardResult {
  allowed:          boolean
  reason?:          string
  sanitizedMessage: string
  truncatedHistory: { role: 'user' | 'assistant'; content: string }[]
}

// ── Main Guard ────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class AIGuard {
  /**
   * Run all AI safety checks before sending to any AI provider.
   */
  static async check(
    tenantId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<AIGuardResult> {
    // 1. Length limit
    const truncatedMsg = message.slice(0, MAX_MESSAGE_LENGTH)

    // 2. Prompt injection detection
    const injectionDetected = INJECTION_PATTERNS.some((p) => p.test(truncatedMsg))
    if (injectionDetected) {
      logger.warn('[AIGuard] Prompt injection attempt detected', {
        tenantId,
        preview: truncatedMsg.slice(0, 100),
      })
      return {
        allowed: false,
        reason: 'prompt_injection',
        sanitizedMessage: truncatedMsg,
        truncatedHistory: [],
      }
    }

    // 2.5 SaaS Subscription and AI Usage Management Enforcement
    try {
      const { data: sub, error: subError } = await supabase
        .from('billing_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (!subError && sub) {
        const now = new Date()
        let updatedStatus = sub.subscription_status
        let updatedGracePeriodEnd = sub.grace_period_end

        // Determine if yearly (e.g. from price id or yearly plan indicator)
        const isYearly = sub.paddle_price_id
          ? sub.paddle_price_id.toLowerCase().includes('annual') || sub.paddle_price_id.toLowerCase().includes('yearly')
          : false

        // A. Free Trial Expiration Logic
        if (sub.subscription_status === 'trial') {
          const trialEnd = sub.trial_end_date ? new Date(sub.trial_end_date) : null
          if (trialEnd && now > trialEnd) {
            updatedStatus = 'expired'
          }
        }
        // B. Active Subscription Expiration & Grace Period Logic
        else if (sub.subscription_status === 'active' || sub.subscription_status === 'grace_period') {
          const subEnd = sub.subscription_end_date ? new Date(sub.subscription_end_date) : null
          if (subEnd && now > subEnd) {
            if (!updatedGracePeriodEnd) {
              const graceDays = isYearly ? 7 : 3
              const graceEnd = new Date(subEnd)
              graceEnd.setDate(graceEnd.getDate() + graceDays)
              updatedGracePeriodEnd = graceEnd.toISOString()
              updatedStatus = 'grace_period'
            } else {
              const graceEnd = new Date(updatedGracePeriodEnd)
              if (now > graceEnd) {
                updatedStatus = 'suspended'
              } else {
                updatedStatus = 'grace_period'
              }
            }
          } else {
            updatedStatus = 'active'
            updatedGracePeriodEnd = null
          }
        }

        // C. AI conversation usage limit expired logic
        const used = sub.ai_conversation_used || 0
        const limit = sub.ai_conversation_limit || 1500
        if (
          (updatedStatus === 'active' || updatedStatus === 'trial' || updatedStatus === 'grace_period') &&
          used >= limit
        ) {
          updatedStatus = 'limit_reached'
        } else if (updatedStatus === 'limit_reached' && used < limit) {
          updatedStatus = sub.paddle_subscription_id ? 'active' : 'trial'
        }

        // If changes detected, synchronize state
        if (updatedStatus !== sub.subscription_status || updatedGracePeriodEnd !== sub.grace_period_end) {
          await supabase
            .from('billing_subscriptions')
            .update({
              subscription_status: updatedStatus,
              grace_period_end: updatedGracePeriodEnd,
              updated_at: now.toISOString()
            })
            .eq('tenant_id', tenantId)

          // Keep primary tenant active status in sync
          await supabase
            .from('tenants')
            .update({
              is_active: !['expired', 'suspended'].includes(updatedStatus),
              updated_at: now.toISOString()
            })
            .eq('id', tenantId)
        }

        // Block if status is expired, suspended, or limit_reached
        if (['expired', 'suspended', 'limit_reached'].includes(updatedStatus) || used >= limit) {
          logger.warn('[AIGuard] AI access blocked due to subscription status', {
            tenantId,
            status: updatedStatus,
            used,
            limit
          })
          return {
            allowed: false,
            reason: `subscription_${updatedStatus}`,
            sanitizedMessage: truncatedMsg,
            truncatedHistory: [],
          }
        }
      }
    } catch (guardErr: any) {
      logger.error('[AIGuard] Failed to execute subscription validation guard checks', guardErr)
    }


    // 3. Daily token budget check
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const { data: usageRows } = await supabase
      .from('usage_logs')
      .select('quantity')
      .eq('tenant_id', tenantId)
      .eq('resource_type', 'ai_tokens')
      .gte('created_at', todayStart.toISOString())

    const usedToday = (usageRows ?? []).reduce((sum, r) => sum + (r.quantity ?? 0), 0)
    const estimatedCost = estimateTokens(truncatedMsg) + history.slice(-MAX_HISTORY_MESSAGES)
      .reduce((s, h) => s + estimateTokens(h.content), 0)

    if (usedToday + estimatedCost > TOKEN_BUDGET_DAILY) {
      logger.warn('[AIGuard] Token budget exceeded', { tenantId, usedToday, TOKEN_BUDGET_DAILY })
      return {
        allowed: false,
        reason: 'token_budget_exceeded',
        sanitizedMessage: truncatedMsg,
        truncatedHistory: [],
      }
    }

    // 4. Truncate conversation history to prevent context bloat
    const truncatedHistory = history
      .slice(-MAX_HISTORY_MESSAGES)
      .map((h) => ({
        role: h.role,
        content: h.content.slice(0, 1000), // Cap each message too
      }))

    // 5. Log token usage estimate
    await supabase.from('usage_logs').insert({
      tenant_id:     tenantId,
      resource_type: 'ai_tokens',
      quantity:      estimatedCost,
      metadata:      { source: 'ai_guard', estimated: true },
    })

    return {
      allowed: true,
      sanitizedMessage: truncatedMsg,
      truncatedHistory,
    }
  }
}
