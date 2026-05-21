import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { initActiveSessions } from '@/lib/whatsapp-qr';
import { normalizePhoneVariants } from '@/lib/inbox-resolve';

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  // Background self-heal: ensure active QR sessions are loaded when inbox is requested
  initActiveSessions().catch(err => logger.error('QR self-heal fail', err));

  try {
    // 1. Retrieve all leads registered to this tenant
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select(`
        id,
        name,
        phone,
        stage,
        created_at,
        contact_id
      `)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false });

    if (leadsError) throw leadsError;

    if (!leads || leads.length === 0) {
      return NextResponse.json([]);
    }

    const contactIds = leads.map(l => l.contact_id).filter(Boolean);

    // 2. Fetch conversations by contact_id and by lead phone (heals missing contact_id links)
    let conversations: Array<{
      id: string;
      contact_id: string;
      mode: string;
      last_message_at: string | null;
      unread_count: number | null;
    }> = [];

    if (contactIds.length > 0) {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, contact_id, mode, last_message_at, unread_count, metadata')
        .eq('tenant_id', user.tenant_id)
        .in('contact_id', contactIds);

      if (convs) conversations = convs as any;
    }

    const convByContact = new Map(conversations.map((c) => [c.contact_id, c]));

    for (const lead of leads) {
      if (lead.contact_id && convByContact.has(lead.contact_id)) continue;
      if (!lead.phone) continue;

      for (const variant of normalizePhoneVariants(lead.phone)) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('id')
          .eq('tenant_id', user.tenant_id)
          .eq('phone_number', variant)
          .maybeSingle();

        if (!contact) continue;

        const { data: conv } = await supabase
          .from('conversations')
          .select('id, contact_id, mode, last_message_at, unread_count, metadata')
          .eq('tenant_id', user.tenant_id)
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (conv && !conversations.some((c) => c.id === conv.id)) {
          conversations.push(conv as any);
          convByContact.set(conv.contact_id, conv as any);
        }

        if (!lead.contact_id) {
          await supabase
            .from('leads')
            .update({ contact_id: contact.id })
            .eq('id', lead.id)
            .eq('tenant_id', user.tenant_id);
          lead.contact_id = contact.id;
        }
        break;
      }
    }

    // 3. Fetch the very latest message for each active conversation to display as a preview snippet
    const convIds = conversations.map(c => c.id);
    let latestMessagesMap: Record<string, any> = {};

    if (convIds.length > 0) {
      // For simplicity and speed, fetch the single latest message for each
      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, content, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false });
      
      if (msgs) {
        msgs.forEach((m: any) => {
          if (!latestMessagesMap[m.conversation_id]) {
            latestMessagesMap[m.conversation_id] = m;
          }
        });
      }
    }

    // 4. Construct the unified Inbox Feed mapping Leads directly to Inbox Threads
    const formattedFeed = leads.map((lead: any) => {
      // Resolve matching conversation for the lead's contact registry
      const conversation = lead.contact_id
        ? conversations.find((c) => c.contact_id === lead.contact_id)
        : undefined;
      const latestMsg = conversation ? latestMessagesMap[conversation.id] : null;

      return {
        id: lead.id, // Use Lead ID as primary list selection anchor
        conversationId: conversation?.id || null,
        leadName: lead.name || 'New Contact',
        phone: lead.phone,
        stage: lead.stage || 'New',
        lastMessage: latestMsg ? latestMsg.content : 'Click to start messaging...',
        lastMessageTime: latestMsg ? latestMsg.created_at : lead.created_at,
        aiActive: conversation ? conversation.mode !== 'manual' : true, // Default to active AI
        unreadCount: conversation ? conversation.unread_count || 0 : 0,
        metadata: conversation ? (conversation as any).metadata || {} : {},
      };
    });

    // Sort final feed by descending message activity / registration date
    formattedFeed.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    return NextResponse.json(formattedFeed);

  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/conversations failed', err);
    return NextResponse.json({ error: 'Unified Inbox compilation failure.', details: err.message }, { status: 500 });
  }
}
