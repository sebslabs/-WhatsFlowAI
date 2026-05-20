import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  const { data, error: dbErr } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .maybeSingle();

  if (dbErr) {
    logger.error({ userId: user.id }, 'GET /api/ai-settings failed', dbErr);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  // Auto-provision if missing
  if (!data) {
    const { data: created, error: insErr } = await supabase
      .from('ai_settings')
      .insert({ tenant_id: user.tenant_id })
      .select()
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json(created);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  // Strip read-only analytics fields from the update
  const { requests_today, requests_month, tokens_month, success_rate, monthly_spend_used_usd, ...updateable } = body;

  const { data, error: dbErr } = await supabase
    .from('ai_settings')
    .upsert({
      tenant_id: user.tenant_id,
      ...updateable,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (dbErr) {
    logger.error({ userId: user.id }, 'PATCH /api/ai-settings failed', dbErr);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
