import { createClient } from '@supabase/supabase-js'

// Using service role client to securely read/write subscription state bypassing RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export interface SubscriptionData {
  id: string
  tenant_id: string
  plan_type: 'free' | 'starter' | 'pro' | 'enterprise' | string
  subscription_status: 'trial' | 'active' | 'grace_period' | 'limit_reached' | 'expired' | 'suspended' | string
  trial_start_date: string | null
  trial_end_date: string | null
  subscription_start_date: string | null
  subscription_end_date: string | null
  grace_period_end: string | null
  ai_conversation_limit: number
  ai_conversation_used: number
  payment_status: string | null
  paddle_customer_id: string | null
  paddle_subscription_id: string | null
  paddle_price_id: string | null
  created_at: string
  updated_at: string
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 1500,       // Trial / Free plan
  starter: 1500,    // Starter Plan
  pro: 5000,        // Growth Plan (corresponds to 'pro' inside tenants table)
  enterprise: 15000 // Scale Plan (corresponds to 'enterprise' inside tenants table)
}

export const PLAN_NAMES: Record<string, string> = {
  free: 'Free Trial',
  starter: 'Starter Plan',
  pro: 'Growth Plan',
  enterprise: 'Scale Plan'
}

/**
 * Validates, enforces, and updates a tenant's subscription status.
 * This function evaluates:
 * 1. 7-Day Free Trial expiration.
 * 2. Monthly (3-day grace period) vs. Yearly (7-day grace period) expiration.
 * 3. AI conversation usage limits.
 *
 * If the status has changed, it writes the new state back to the database.
 */
export async function checkAndUpdateSubscription(tenantId: string): Promise<SubscriptionData> {
  const { data: sub, error } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !sub) {
    // If no subscription exists, auto-provision a default free trial
    const trialDays = 7
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + trialDays)

    const { data: newSub, error: provisionError } = await supabaseAdmin
      .from('billing_subscriptions')
      .upsert({
        tenant_id: tenantId,
        plan_type: 'free',
        subscription_status: 'trial',
        trial_start_date: new Date().toISOString(),
        trial_end_date: trialEnd.toISOString(),
        ai_conversation_limit: PLAN_LIMITS.free,
        ai_conversation_used: 0,
        payment_status: 'unpaid',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      })
      .select()
      .single()

    if (provisionError) {
      throw new Error(`Failed to auto-provision subscription for tenant: ${provisionError.message}`)
    }
    return newSub as SubscriptionData
  }

  const now = new Date()
  let updatedStatus = sub.subscription_status
  let updatedGracePeriodEnd = sub.grace_period_end

  // Helper to determine the billing cycle/type from price id or plan type
  const isYearly = sub.paddle_price_id
    ? sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL ||
      sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL ||
      sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL ||
      sub.paddle_price_id.toLowerCase().includes('annual') ||
      sub.paddle_price_id.toLowerCase().includes('yearly')
    : false; // default to monthly unless explicitly yearly

  // 1. Free Trial Expiration Logic
  if (sub.subscription_status === 'trial') {
    const trialEnd = sub.trial_end_date ? new Date(sub.trial_end_date) : null
    if (trialEnd && now > trialEnd) {
      updatedStatus = 'expired'
    }
  }

  // 2. Active Subscription Expiration & Grace Period Logic
  else if (sub.subscription_status === 'active' || sub.subscription_status === 'grace_period') {
    const subEnd = sub.subscription_end_date ? new Date(sub.subscription_end_date) : null
    if (subEnd && now > subEnd) {
      // If expired, check if we need to set or evaluate the grace period
      if (!updatedGracePeriodEnd) {
        // Monthly gets a 3-day grace period, Yearly gets 7-day grace period
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
      // Revert from grace_period if subscription was renewed
      updatedStatus = 'active'
      updatedGracePeriodEnd = null
    }
  }

  // 3. AI Usage Limit Check
  if (
    (updatedStatus === 'active' || updatedStatus === 'trial' || updatedStatus === 'grace_period') &&
    sub.ai_conversation_used >= sub.ai_conversation_limit
  ) {
    updatedStatus = 'limit_reached'
  } else if (
    updatedStatus === 'limit_reached' &&
    sub.ai_conversation_used < sub.ai_conversation_limit
  ) {
    // Revert status if usage was reset or plan was upgraded
    if (sub.subscription_status === 'limit_reached') {
      updatedStatus = sub.paddle_subscription_id ? 'active' : 'trial'
    }
  }

  // If status or grace period changed, update the database
  if (
    updatedStatus !== sub.subscription_status ||
    updatedGracePeriodEnd !== sub.grace_period_end
  ) {
    const { data: savedSub, error: updateError } = await supabaseAdmin
      .from('billing_subscriptions')
      .update({
        subscription_status: updatedStatus,
        grace_period_end: updatedGracePeriodEnd,
        updated_at: now.toISOString()
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (!updateError && savedSub) {
      // Keep primary tenant plan status in sync
      let tenantPlanSlug = 'free'
      if (savedSub.plan_type === 'starter') tenantPlanSlug = 'starter'
      else if (savedSub.plan_type === 'pro') tenantPlanSlug = 'pro'
      else if (savedSub.plan_type === 'enterprise') tenantPlanSlug = 'enterprise'

      await supabaseAdmin
        .from('tenants')
        .update({
          plan: tenantPlanSlug,
          is_active: !['expired', 'suspended'].includes(updatedStatus),
          updated_at: now.toISOString()
        })
        .eq('id', tenantId)

      return savedSub as SubscriptionData
    }
  }

  return sub as SubscriptionData
}

/**
 * Checks whether AI actions should be blocked or permitted.
 * Blocks AI if:
 * 1. Plan/Trial is expired.
 * 2. Grace period has passed (status is suspended).
 * 3. AI limit has been reached.
 */
export async function validateAIAccess(tenantId: string): Promise<{
  allowed: boolean
  reason?: 'expired' | 'grace_period_ended' | 'limit_reached' | 'suspended' | 'not_found'
  warning?: 'grace_period' | 'usage_warning'
  used: number
  limit: number
  planName: string
  trialDaysLeft?: number
}> {
  const sub = await checkAndUpdateSubscription(tenantId)

  const used = sub.ai_conversation_used
  const limit = sub.ai_conversation_limit
  const planName = PLAN_NAMES[sub.plan_type] || 'Free Trial'

  let trialDaysLeft: number | undefined
  if (sub.subscription_status === 'trial' && sub.trial_end_date) {
    const diff = new Date(sub.trial_end_date).getTime() - new Date().getTime()
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  // Enforce blockers
  if (sub.subscription_status === 'expired') {
    return { allowed: false, reason: 'expired', used, limit, planName, trialDaysLeft }
  }
  if (sub.subscription_status === 'suspended') {
    return { allowed: false, reason: 'suspended', used, limit, planName, trialDaysLeft }
  }
  if (sub.subscription_status === 'limit_reached' || used >= limit) {
    return { allowed: false, reason: 'limit_reached', used, limit, planName, trialDaysLeft }
  }

  // Warnings
  let warning: 'grace_period' | 'usage_warning' | undefined
  if (sub.subscription_status === 'grace_period') {
    warning = 'grace_period'
  } else if (used / limit >= 0.8) {
    warning = 'usage_warning'
  }

  return {
    allowed: true,
    warning,
    used,
    limit,
    planName,
    trialDaysLeft
  }
}

/**
 * Safely increments AI usage count by 1.
 * Triggers status refresh to ensure it transitions to 'limit_reached' immediately if limit is hit.
 */
export async function incrementAIUsage(tenantId: string): Promise<void> {
  const { data: sub, error } = await supabaseAdmin
    .from('billing_subscriptions')
    .select('ai_conversation_used, ai_conversation_limit')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error || !sub) return

  const nextUsed = (sub.ai_conversation_used || 0) + 1
  const limit = sub.ai_conversation_limit || 1500
  const isLimitReached = nextUsed >= limit

  await supabaseAdmin
    .from('billing_subscriptions')
    .update({
      ai_conversation_used: nextUsed,
      subscription_status: isLimitReached ? 'limit_reached' : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', tenantId)
}
