import { createClient } from '@supabase/supabase-js';

// Supabase admin client to read/write endorsely_referral_id securely bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Endorsely Organization ID Configuration
export const ENDORSELY_ORGANIZATION_ID = 
  process.env.ENDORSELY_ORGANIZATION_ID || "2476bf4b-2e5b-44b4-81e0-c169636d66f8";

export interface EndorselyTrackPayload {
  referralId: string;
  email: string;
  customerId: string;
  customerName: string;
  plan: 'starter' | 'growth' | 'scale' | string;
  billingCycle: 'monthly' | 'annual' | string;
  amount: number; // in USD (e.g., 49, 948, etc.)
}

export interface EndorselyApiResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Maps a Paddle Price ID to the official pricing details for Endorsely tracking.
 */
export function getPlanDetailsFromPriceId(priceId: string): {
  plan: 'starter' | 'growth' | 'scale';
  billingCycle: 'monthly' | 'annual';
  amount: number;
} {
  const priceStarterMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY || 'pri_01kry9prvj4ckwwqzh6y6x18td';
  const priceStarterAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL || 'pri_01kry9prvj4ckwwqzh6y6x18td_annual';
  const priceGrowthMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY || 'pri_01kry9xm1m9k635gk2ebebk0d4';
  const priceGrowthAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL || 'pri_01kry9xm1m9k635gk2ebebk0d4_annual';
  const priceScaleMonthly = process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_MONTHLY || 'pri_01krya2rd80y5ry5hvkh7d2dw7';
  const priceScaleAnnual = process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL || 'pri_01krya2rd80y5ry5hvkh7d2dw7_annual';

  const lowerPriceId = (priceId || '').toLowerCase();

  if (priceId === priceStarterMonthly) {
    return { plan: 'starter', billingCycle: 'monthly', amount: 49 };
  } else if (priceId === priceStarterAnnual) {
    return { plan: 'starter', billingCycle: 'annual', amount: 468 };
  } else if (priceId === priceGrowthMonthly) {
    return { plan: 'growth', billingCycle: 'monthly', amount: 99 };
  } else if (priceId === priceGrowthAnnual) {
    return { plan: 'growth', billingCycle: 'annual', amount: 948 };
  } else if (priceId === priceScaleMonthly) {
    return { plan: 'scale', billingCycle: 'monthly', amount: 199 };
  } else if (priceId === priceScaleAnnual) {
    return { plan: 'scale', billingCycle: 'annual', amount: 1908 };
  }

  // Smart regex or string fallback patterns
  const isAnnual = lowerPriceId.includes('annual') || lowerPriceId.includes('yearly') || lowerPriceId.includes('ann');

  if (lowerPriceId.includes('starter')) {
    return { plan: 'starter', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 468 : 49 };
  } else if (lowerPriceId.includes('growth') || lowerPriceId.includes('pro')) {
    return { plan: 'growth', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 948 : 99 };
  } else if (lowerPriceId.includes('scale') || lowerPriceId.includes('enterprise')) {
    return { plan: 'scale', billingCycle: isAnnual ? 'annual' : 'monthly', amount: isAnnual ? 1908 : 199 };
  }

  // Final fail-safe default values
  return { plan: 'starter', billingCycle: 'monthly', amount: 49 };
}

/**
 * Submits a validated conversion event securely to the Endorsely API endpoint.
 */
export async function trackReferralConversion(payload: EndorselyTrackPayload): Promise<EndorselyApiResponse> {
  const { referralId, email, customerId, customerName, amount, plan, billingCycle } = payload;
  
  if (!referralId || referralId.trim() === '') {
    console.warn('⚠️ [Endorsely Service] Skipped: No referralId present in payload.');
    return { success: false, error: 'Missing referral ID' };
  }

  const apiKey = process.env.ENDORSELY_API_KEY || "923b4da221c9fae2897a73476d78bbe0a65b2321283fd0ad60b246d6f97a8022";
  
  if (!apiKey) {
    console.error('❌ [Endorsely Service] Error: ENDORSELY_API_KEY is not defined in environment variables.');
    return { success: false, error: 'Missing Endorsely API key' };
  }

  // Convert USD amount to cents for Endorsely API
  const amountInCents = Math.round(amount * 100);

  const endorselyBody = {
    referralId,
    organizationId: ENDORSELY_ORGANIZATION_ID,
    email,
    customerId,
    name: customerName || email.split('@')[0],
    amount: amountInCents
  };

  console.log(`📡 [Endorsely Service] Sending conversion tracking event...`, {
    customerId,
    email,
    plan,
    billingCycle,
    amountPaid: amount,
    amountInCents,
    referralId
  });

  try {
    const response = await fetch('https://app.endorsely.com/api/public/refer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(endorselyBody)
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(`❌ [Endorsely Service] API error response [Status: ${response.status}]:`, responseText);
      return { 
        success: false, 
        error: `API error (status ${response.status})`, 
        message: responseText 
      };
    }

    console.log(`✅ [Endorsely Service] Conversion successfully registered! Response:`, responseText);
    return { success: true, message: responseText };

  } catch (err: any) {
    console.error('❌ [Endorsely Service] Network/transport request crashed:', err.message || err);
    return { success: false, error: err.message || 'Unknown network error' };
  }
}

/**
 * Persists the endorsely_referral_id in the database for the given tenant.
 */
export async function saveReferralIdToDatabase(tenantId: string, referralId: string): Promise<boolean> {
  if (!tenantId || !referralId) return false;

  try {
    const { error } = await supabaseAdmin
      .from('billing_subscriptions')
      .update({
        endorsely_referral_id: referralId,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (error) {
      console.error(`❌ [Endorsely Service] Database write failure [Tenant: ${tenantId}]:`, error.message);
      return false;
    }

    console.log(`💾 [Endorsely Service] Persisted referral relationship in DB [Tenant: ${tenantId}, Referral: ${referralId}]`);
    return true;
  } catch (err: any) {
    console.error(`❌ [Endorsely Service] Database persistence crashed:`, err.message || err);
    return false;
  }
}

/**
 * Retrieves the stored endorsely_referral_id from the database for the given tenant.
 */
export async function getReferralIdFromDatabase(tenantId: string): Promise<string | null> {
  if (!tenantId) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('billing_subscriptions')
      .select('endorsely_referral_id')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      console.error(`❌ [Endorsely Service] Database read failure [Tenant: ${tenantId}]:`, error.message);
      return null;
    }

    return data?.endorsely_referral_id || null;
  } catch (err: any) {
    console.error(`❌ [Endorsely Service] Database read crashed:`, err.message || err);
    return null;
  }
}
