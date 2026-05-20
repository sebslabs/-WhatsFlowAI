import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET /api/settings — Fetches global configurations and active subscription context
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    let config: Record<string, any> = {}

    // 1. Retrieve tenant configuration blob from the settings table
    const { data, error: dbError } = await supabase
      .from('settings')
      .select('config')
      .eq('tenant_id', user.tenant_id)
      .maybeSingle()

    if (!dbError && data?.config) {
      config = data.config as Record<string, any>
    }

    // Always fetch latest profile data from profiles table (source of truth)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (profile) {
        config.full_name = profile.full_name || config.full_name || ''
        config.personal_email = profile.email || config.personal_email || ''
        config.avatar_url = profile.avatar_url || config.avatar_url || ''
      }
    } catch (profileErr) {
      logger.warn({ userId: user.id, error: profileErr }, 'Profile details fetch failed gracefully')
    }

    // 1.5 Robust First-Run Provisioning Fallback
    // If settings table was never initialized or keys are empty, pull dynamically from active profile/tenant schemas
    if (!config.business_name || !config.full_name || !config.personal_email) {
      try {
        const { data: tenant } = await supabase
          .from('tenants')
          .select('name, industry_ecosystem, whatsapp_number, support_email')
          .eq('id', user.tenant_id)
          .maybeSingle()

        if (tenant) {
          config.business_name = config.business_name || tenant.name || ''
          config.industry = config.industry || tenant.industry_ecosystem || 'dental'
          config.whatsapp_number = config.whatsapp_number || tenant.whatsapp_number || ''
          config.support_email = config.support_email || tenant.support_email || ''
        }

        // 1.8 Deep Tier: Extract directly from Auth User Metadata if physical tables contain empty values
        if (!config.business_name || !config.full_name || !config.whatsapp_number || !config.support_email) {
          const { data: { user: authUser } } = await supabase.auth.getUser()
          if (authUser?.user_metadata) {
            const meta = authUser.user_metadata
            config.full_name = config.full_name || meta.full_name || ''
            config.business_name = config.business_name || meta.organization_name || ''
            config.industry = config.industry || meta.industry_ecosystem || 'dental'
            config.whatsapp_number = config.whatsapp_number || meta.whatsapp_number || ''
            config.support_email = config.support_email || meta.support_email || ''
          }
        }
      } catch (fallbackErr) {
        logger.warn({ userId: user.id, error: fallbackErr }, 'Settings fallback fetch failed gracefully')
      }
    }

    // 2. Load and align real-time subscription metadata from billing system
    let subscription: Record<string, any> | null = null
    try {
      const { checkAndUpdateSubscription, PLAN_NAMES } = await import('@/lib/subscription')
      const sub = await checkAndUpdateSubscription(user.tenant_id)

      if (sub) {
        const now = new Date()
        let trialDaysRemaining: number | null = null
        if (sub.subscription_status === 'trial' && sub.trial_end_date) {
          const diff = new Date(sub.trial_end_date).getTime() - now.getTime()
          trialDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        }

        let graceDaysRemaining: number | null = null
        if (sub.subscription_status === 'grace_period' && sub.grace_period_end) {
          const diff = new Date(sub.grace_period_end).getTime() - now.getTime()
          graceDaysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        }

        const isYearly = sub.paddle_price_id
          ? sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL ||
            sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL ||
            sub.paddle_price_id === process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL
          : false

        let planPrice = '0.00'
        if (sub.plan_type === 'starter') planPrice = isYearly ? '39.00' : '49.00'
        else if (sub.plan_type === 'pro') planPrice = isYearly ? '79.00' : '99.00'
        else if (sub.plan_type === 'enterprise') planPrice = isYearly ? '159.00' : '199.00'

        subscription = {
          plan_type: sub.plan_type,
          plan_name: PLAN_NAMES[sub.plan_type] || 'Free Trial',
          subscription_status: sub.subscription_status,
          trial_start_date: sub.trial_start_date,
          trial_end_date: sub.trial_end_date,
          subscription_start_date: sub.subscription_start_date,
          subscription_end_date: sub.subscription_end_date,
          grace_period_end: sub.grace_period_end,
          ai_conversation_limit: sub.ai_conversation_limit,
          ai_conversation_used: sub.ai_conversation_used,
          payment_status: sub.payment_status,
          trial_days_remaining: trialDaysRemaining,
          grace_days_remaining: graceDaysRemaining,
          is_yearly: isYearly,
          price_monthly: planPrice
        }
      }
    } catch (subErr: any) {
      logger.warn({ userId: user.id, error: subErr.message }, 'Subscription telemetry failed gracefully')
    }

    // 3. Load payment history from public.payment_history table
    let paymentHistory: any[] = []
    try {
      const { data: payments } = await supabase
        .from('payment_history')
        .select('*')
        .order('created_at', { ascending: false })
      if (payments) {
        paymentHistory = payments
      }
    } catch (payHistErr: any) {
      logger.warn({ tenantId: user.tenant_id, error: payHistErr.message }, 'Failed to query payment history')
    }

    return NextResponse.json({
      ...config,
      tenant_id: user.tenant_id, // Expose securely to frontend for billing/support contexts
      active_subscription: subscription,
      payment_history: paymentHistory
    })
  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/settings failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// POST /api/settings — Updates or initializes tenant configuration protocols
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // Filter out read-only telemetry fields populated by the GET endpoint
    const { active_subscription, ...filteredConfig } = body

    const { data, error: dbError } = await supabase
      .from('settings')
      .upsert(
        {
          tenant_id: user.tenant_id, // Securely bind to verified tenant context
          config: filteredConfig,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'tenant_id' }
      )
      .select()
      .single()

    if (dbError) throw dbError

    // Synchronize specific configuration values back into primary relational schemas
    try {
      const tenantUpdate: any = {}
      if (filteredConfig.business_name) tenantUpdate.name = filteredConfig.business_name
      if (filteredConfig.industry) tenantUpdate.industry_ecosystem = filteredConfig.industry
      if (filteredConfig.whatsapp_number) tenantUpdate.whatsapp_number = filteredConfig.whatsapp_number
      if (filteredConfig.support_email) tenantUpdate.support_email = filteredConfig.support_email

      if (Object.keys(tenantUpdate).length > 0) {
        await supabase.from('tenants').update(tenantUpdate).eq('id', user.tenant_id)
      }

      const profileUpdate: any = {}
      if (filteredConfig.full_name) profileUpdate.full_name = filteredConfig.full_name
      if (filteredConfig.personal_email) profileUpdate.email = filteredConfig.personal_email
      if (filteredConfig.avatar_url !== undefined) profileUpdate.avatar_url = filteredConfig.avatar_url

      if (Object.keys(profileUpdate).length > 0) {
        await supabase.from('profiles').update(profileUpdate).eq('id', user.id)
      }
    } catch (syncErr) {
      logger.warn({ userId: user.id, error: syncErr }, 'Backwards settings synchronization skipped')
    }

    logger.info({ userId: user.id }, 'Settings updated successfully')
    return NextResponse.json(data.config)
  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/settings failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
