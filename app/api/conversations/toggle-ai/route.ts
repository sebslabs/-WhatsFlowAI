import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const { leadId, mode } = await request.json();

    if (!leadId || !['ai', 'manual'].includes(mode)) {
      return NextResponse.json({ error: 'Payload invalid. Required fields: leadId, mode ("ai" | "manual")' }, { status: 400 });
    }

    // 1. Resolve original lead context
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_id, phone, name')
      .eq('id', leadId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Target lead not registered or accessible.' }, { status: 404 });
    }

    let contactId = lead.contact_id;

    // 2. Auto-provision missing contacts
    if (!contactId && lead.phone) {
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', lead.phone)
        .eq('tenant_id', user.tenant_id)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
        await supabase.from('leads').update({ contact_id: contactId }).eq('id', leadId).eq('tenant_id', user.tenant_id);
      } else {
        const { data: newContact, error: contactErr } = await supabase
          .from('contacts')
          .insert({
            tenant_id: user.tenant_id,
            phone_number: lead.phone,
            name: lead.name,
          })
          .select('id')
          .single();
        
        if (contactErr) throw contactErr;
        contactId = newContact.id;
        await supabase.from('leads').update({ contact_id: contactId }).eq('id', leadId).eq('tenant_id', user.tenant_id);
      }
    }

    if (!contactId) {
      return NextResponse.json({ error: 'Autonomy state cannot be defined without registry phone credentials.' }, { status: 400 });
    }

    // 3. Locate target conversation record
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    // 4. Self-healing state engine to overcome DB constraints ('ai' vs 'bot')
    const executeMutation = async (chosenMode: string) => {
      const isAiEnabled = chosenMode !== 'manual';
      
      if (existingConv) {
        return await supabase
          .from('conversations')
          .update({ 
            mode: chosenMode,
            ai_enabled: isAiEnabled
          })
          .eq('id', existingConv.id)
          .eq('tenant_id', user.tenant_id); // Qualified qualify for strict RLS compliance
      } else {
        return await supabase
          .from('conversations')
          .insert({
            tenant_id: user.tenant_id,
            contact_id: contactId,
            status: 'open',
            mode: chosenMode,
            ai_enabled: isAiEnabled
          });
      }
    };

    // Step A: Try Primary Standard ('ai' | 'manual')
    let mutationResult = await executeMutation(mode);

    // Step B: Check for Constraint Violation (23514 is Postgres Check Violation error)
    if (mutationResult.error) {
      const errCode = mutationResult.error.code;
      const errMsg = mutationResult.error.message;

      if (errCode === '23514' || errMsg.includes('check constraint')) {
        // Primary standard failed check constraint. Fallback: replace 'ai' with 'bot'
        if (mode === 'ai') {
          logger.warn({ errCode, errMsg }, 'Postgres constraint violation on "mode". Activating legacy "bot" fallback strategy.');
          mutationResult = await executeMutation('bot');
        }
      }
    }

    // Verify final mutation integrity
    if (mutationResult.error) {
      throw mutationResult.error;
    }

    return NextResponse.json({ 
      success: true, 
      mode: mode // Return 'ai' or 'manual' to interface layer for uniform parsing
    });

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/conversations/toggle-ai exception handler', err);
    return NextResponse.json({ 
      error: 'Execution failed.', 
      details: err.message || 'Database rejection.', 
      code: err.code || 'UNKNOWN'
    }, { status: 500 });
  }
}
