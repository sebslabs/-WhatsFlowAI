import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const { leadId, agentId } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Payload invalid. Required field: leadId' }, { status: 400 });
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
      return NextResponse.json({ error: 'Conversation state cannot be defined without registry phone credentials.' }, { status: 400 });
    }

    // 3. Locate target conversation record
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id, metadata')
      .eq('contact_id', contactId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    // 4. Update or Insert conversation with the selected agent ID
    const mergedMetadata = {
      ...(existingConv?.metadata || {}),
      selected_agent_id: agentId || null,
    };

    let mutationResult;
    if (existingConv) {
      mutationResult = await supabase
        .from('conversations')
        .update({ 
          metadata: mergedMetadata
        })
        .eq('id', existingConv.id)
        .eq('tenant_id', user.tenant_id);
    } else {
      mutationResult = await supabase
        .from('conversations')
        .insert({
          tenant_id: user.tenant_id,
          contact_id: contactId,
          status: 'open',
          metadata: mergedMetadata
        });
    }

    if (mutationResult.error) {
      throw mutationResult.error;
    }

    return NextResponse.json({ 
      success: true, 
      agentId: agentId || null,
      metadata: mergedMetadata
    });

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/conversations/select-agent exception handler', err);
    return NextResponse.json({ 
      error: 'Execution failed.', 
      details: err.message || 'Database rejection.', 
      code: err.code || 'UNKNOWN'
    }, { status: 500 });
  }
}
