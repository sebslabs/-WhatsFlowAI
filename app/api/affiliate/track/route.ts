import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackReferralConversion, saveReferralIdToDatabase } from '@/services/endorsely';

// Secure service role client for db association
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { referralId, email, customerId, customerName, plan, billingCycle, amount } = body;

    // Validate inputs
    if (!referralId) {
      return NextResponse.json({ error: 'Missing referralId parameter.' }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: 'Missing email parameter.' }, { status: 400 });
    }
    if (!plan || !billingCycle || amount === undefined) {
      return NextResponse.json({ error: 'Missing plan, billingCycle or amount parameters.' }, { status: 400 });
    }

    console.log(`📥 [API Affiliate Track] Received conversion request:`, {
      referralId,
      email,
      customerId,
      customerName,
      plan,
      billingCycle,
      amount
    });

    // 1. Attempt to resolve the tenant ID for this user/email to save attribution state in the database
    let tenantId: string | null = null;
    try {
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('organization_id')
        .eq('email', email)
        .maybeSingle();

      if (!profileErr && profile?.organization_id) {
        tenantId = profile.organization_id;
      }
    } catch (err: any) {
      console.warn(`⚠️ [API Affiliate Track] Could not resolve tenant ID via email:`, err.message);
    }

    // 2. Persist the referral relationship in the DB for future subscription actions (renewals, up/downgrades)
    if (tenantId) {
      await saveReferralIdToDatabase(tenantId, referralId);
    } else {
      console.warn(`⚠️ [API Affiliate Track] Could not link referral ID to a database tenant profile (profile not discovered).`);
    }

    // 3. Send conversion data to Endorsely API
    const endorselyResult = await trackReferralConversion({
      referralId,
      email,
      customerId: customerId || tenantId || 'anonymous_cust',
      customerName: customerName || email.split('@')[0],
      plan,
      billingCycle,
      amount
    });

    if (!endorselyResult.success) {
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to record referral tracking on partner platform.', 
        details: endorselyResult.error 
      }, { status: 502 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Checkout conversion registered and attribution saved successfully.',
      linkedTenant: tenantId !== null
    }, { status: 200 });

  } catch (error: any) {
    console.error(`❌ [API Affiliate Track] Unexpected internal failure:`, error.message || error);
    return NextResponse.json({ 
      error: 'Strategic tracking handler experienced a runtime breakdown.', 
      details: error.message 
    }, { status: 500 });
  }
}
