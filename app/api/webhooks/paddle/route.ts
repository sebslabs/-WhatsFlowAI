import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paddle } from '@/lib/paddle';

// Using a service role client to bypass Row-Level Security (RLS) for secure backend synchronization.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  const signature = req.headers.get('paddle-signature') || '';
  const rawBody = await req.text();

  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    console.error('❌ Webhook Secret missing in environment variables.');
    return NextResponse.json({ error: 'Configuration mismatch' }, { status: 500 });
  }

  try {
    // 1. Verify webhooks and deserialize the payload safely.
    const event = await paddle.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET,
      signature
    );

    if (!event) {
      console.error('❌ Paddle event unmarshal returned null.');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    console.log(`🔔 Webhook Event Verified: ${event.eventType}`);

    // Extract custom data which holds our mapping (e.g. tenant_id)
    // Note: Event structure uses camelCase in @paddle/paddle-node-sdk
    const subscriptionData = event.data as any;
    const customData = subscriptionData.customData || {};
    const tenantId = customData.tenant_id;

    if (!tenantId) {
      console.warn('⚠️ Skiped sync: No tenant_id mapped in customData.');
      return NextResponse.json({ message: 'Unhandled context (missing tenant_id)' }, { status: 200 });
    }

    // 2. Map price items to internal subscription plan IDs
    let planSlug = 'free';
    const priceId = subscriptionData.items?.[0]?.price?.id || '';
    const metadata = subscriptionData.items?.[0]?.price?.customData || {};
    
    // If your price description, names or customData contains the plan type, extract it here.
    // Fallback logic to string matching in case specific price map environment variables aren't set.
    if (priceId.toLowerCase().includes('starter') || String(metadata.plan || '').includes('starter')) {
      planSlug = 'starter';
    } else if (priceId.toLowerCase().includes('growth') || String(metadata.plan || '').includes('pro') || String(metadata.plan || '').includes('growth')) {
      planSlug = 'pro';
    } else if (priceId.toLowerCase().includes('scale') || String(metadata.plan || '').includes('enterprise')) {
      planSlug = 'enterprise';
    } else {
      // If none match, try to lookup from your predefined Price IDs (set up in environment)
      if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY || priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL) {
        planSlug = 'starter';
      } else if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY || priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL) {
        planSlug = 'pro';
      } else if (priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_MONTHLY || priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL) {
        planSlug = 'enterprise';
      }
    }

    const isYearly = priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL ||
      priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL ||
      priceId === process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL;

    switch (event.eventType) {
      case 'subscription.created':
      case 'subscription.updated':
      case 'subscription.activated':
      case 'subscription.past_due':
      case 'subscription.paused':
      case 'subscription.canceled': {
        // Map Paddle status to internal subscription status
        // Paddle statuses: active, trialing, past_due, paused, canceled
        let internalStatus = 'active';
        let paymentStatus = 'paid';

        if (subscriptionData.status === 'trialing') {
          internalStatus = 'trial';
          paymentStatus = 'unpaid';
        } else if (subscriptionData.status === 'past_due' || subscriptionData.status === 'paused') {
          internalStatus = 'grace_period';
          paymentStatus = 'failed';
        } else if (subscriptionData.status === 'canceled') {
          internalStatus = 'expired';
          paymentStatus = 'failed';
        }

        const periodStart = subscriptionData.currentPeriodStart || subscriptionData.firstBillingPeriod?.startsAt;
        const periodEnd = subscriptionData.currentPeriodEnd || subscriptionData.nextBillingPeriod?.startsAt;

        // Map plan limit
        let limit = 1500;
        if (planSlug === 'starter') limit = 1500;
        else if (planSlug === 'pro') limit = 5000;
        else if (planSlug === 'enterprise') limit = 15000;

        // 3. Keep physical tables synchronized
        const { error: dbError } = await supabaseAdmin
          .from('billing_subscriptions')
          .upsert({
            tenant_id: tenantId,
            paddle_customer_id: subscriptionData.customerId,
            paddle_subscription_id: subscriptionData.id,
            paddle_price_id: priceId,
            plan_type: planSlug,
            subscription_status: internalStatus,
            subscription_start_date: periodStart ? new Date(periodStart).toISOString() : null,
            subscription_end_date: periodEnd ? new Date(periodEnd).toISOString() : null,
            ai_conversation_limit: limit,
            payment_status: paymentStatus,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'tenant_id'
          });

        if (dbError) {
          console.error('❌ Database persistence error for subscription upsert:', dbError);
          throw dbError;
        }

        // 4. Cascade the plan update back to the Tenant entity itself
        const isActive = ['active', 'trialing', 'past_due'].includes(subscriptionData.status);
        const { error: tenantError } = await supabaseAdmin
          .from('tenants')
          .update({
            plan: planSlug,
            is_active: isActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', tenantId);

        if (tenantError) {
          console.error('❌ Database persistence error updating tenant plan:', tenantError);
          throw tenantError;
        }

        // 5. Populate payment history if there is any financial invoice payload
        try {
          if (subscriptionData.lastPayment || subscriptionData.price) {
            const amount = subscriptionData.lastPayment?.amount || '0.00';
            await supabaseAdmin.from('payment_history').insert({
              tenant_id: tenantId,
              amount: parseFloat(amount) || 0,
              currency: subscriptionData.currencyCode || 'USD',
              payment_status: paymentStatus,
              payment_method: subscriptionData.paymentMethod || 'card',
              transaction_id: subscriptionData.id,
              billing_period_start: periodStart ? new Date(periodStart).toISOString() : null,
              billing_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
            });
          }
        } catch (payHistErr: any) {
          console.error('⚠️ Could not log payment history entry:', payHistErr.message);
        }

        // 6. Endorsely Affiliate Tracking integration for renewals, upgrades, and downgrades
        try {
          if (paymentStatus === 'paid') {
            const amountPaid = parseFloat(subscriptionData.lastPayment?.amount || '0.00');
            
            // Only trigger if a positive payment was made (prevents tracking free trial creations)
            if (amountPaid > 0) {
              const customDataReferral = customData.endorsely_referral_id || '';

              // Retrieve the stored referral ID to maintain original referral relationship
              const { data: currentSub } = await supabaseAdmin
                .from('billing_subscriptions')
                .select('endorsely_referral_id')
                .eq('tenant_id', tenantId)
                .maybeSingle();

              let referralId = currentSub?.endorsely_referral_id || customDataReferral;

              // If we have customDataReferral but it wasn't saved in the DB yet, save it now!
              if (customDataReferral && !currentSub?.endorsely_referral_id) {
                await supabaseAdmin
                  .from('billing_subscriptions')
                  .update({ 
                    endorsely_referral_id: customDataReferral,
                    updated_at: new Date().toISOString()
                  })
                  .eq('tenant_id', tenantId);
                referralId = customDataReferral;
              }

              // If a stored or fallback referral ID exists, trigger the conversion event
              if (referralId) {
                // Resolve customer details from profiles
                const { data: member } = await supabaseAdmin
                  .from('tenant_members')
                  .select('profiles(email, full_name)')
                  .eq('tenant_id', tenantId)
                  .eq('role', 'admin')
                  .maybeSingle();

                const profile = member?.profiles as any;
                const email = profile?.email || '';
                const name = profile?.full_name || '';

                const { trackReferralConversion } = require('@/services/endorsely');
                await trackReferralConversion({
                  referralId,
                  email,
                  customerId: subscriptionData.customerId || tenantId,
                  customerName: name || email.split('@')[0],
                  plan: planSlug,
                  billingCycle: isYearly ? 'annual' : 'monthly',
                  amount: amountPaid
                });
                
                console.log(`Referral attribution verified. Conversion event dispatched to Endorsely for tenant ${tenantId}.`);
              }
            }
          }
        } catch (endorselyErr: any) {
          console.error('⚠️ [Webhook Endorsely] Error processing tracking event:', endorselyErr.message);
        }

        console.log(`✅ Synchronized subscription context for tenant ${tenantId}: ${planSlug} (${subscriptionData.status})`);
        break;
      }
      default:
        console.log(`ℹ️ Unhandled Paddle Webhook Trigger: ${event.eventType}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error('❌ Webhook Handling Pipeline Crashed:', error.message || error);
    return NextResponse.json({ error: 'Internal handler failure', details: error.message }, { status: 500 });
  }
}
