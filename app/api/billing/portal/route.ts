import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { paddle } from '@/lib/paddle';

export async function GET(request: NextRequest) {
  // Guard: Verify authentication context
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    // 1. Retrieve the physical Paddle subscription ID linked to this tenant
    const { data, error: dbError } = await supabase
      .from('billing_subscriptions')
      .select('paddle_subscription_id, status')
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (dbError) throw dbError;

    if (!data || !data.paddle_subscription_id) {
      return NextResponse.json(
        { error: 'No active billing subscription discovered for this organization.' },
        { status: 404 }
      );
    }

    // 2. Fetch specific subscription object from Paddle backend SDK
    const subscription = await paddle.subscriptions.get(data.paddle_subscription_id);

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription registry sync failed on vendor gateway side.' },
        { status: 404 }
      );
    }

    // 3. Dispatch management links for client invocation
    // Paddle provides deep urls for modifying card, general updates, or cancellation.
    return NextResponse.json({
      updateUrl: subscription.managementUrls?.updatePaymentMethod || null,
      cancelUrl: subscription.managementUrls?.cancel || null,
      status: subscription.status,
      nextInvoice: (subscription as any).nextBillingPeriod?.startsAt || null,
    });

  } catch (err: any) {
    console.error(`❌ Portal Session Generation Failure [Tenant: ${user.tenant_id}]:`, err.message);
    return NextResponse.json(
      { error: 'Communication breakdown with vendor core API.', details: err.message },
      { status: 500 }
    );
  }
}
