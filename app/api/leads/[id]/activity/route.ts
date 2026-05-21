import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  const leadId = params.id;

  try {
    // 1. Load root context
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, created_at, stage, contact_id, phone')
      .eq('id', leadId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead trace missing.' }, { status: 404 });
    }

    const events = [];

    // Start with fundamental creation anchor
    events.push({
      id: 'evt-created',
      title: 'Lead created',
      timestamp: lead.created_at,
      dotColor: 'bg-green-500',
      priority: 1
    });

    // 2. Discover physical messages for derived event checkpoints
    let conversationId = null;

    if (lead.contact_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', lead.contact_id)
        .eq('tenant_id', user.tenant_id)
        .maybeSingle();
      if (conv) conversationId = conv.id;
    }

    if (!conversationId && lead.phone) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', lead.phone)
        .eq('tenant_id', user.tenant_id)
        .maybeSingle();
      if (contact) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('tenant_id', user.tenant_id)
          .maybeSingle();
        if (conv) conversationId = conv.id;
      }
    }

    if (conversationId) {
      const { data: messages } = await supabase
        .from('messages')
        .select('id, sender_type, content, created_at')
        .eq('conversation_id', conversationId)
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: true });

      if (messages && messages.length > 0) {
        // Anchor A: AI sent greeting (First message where sender_type = bot/ai)
        const greetingMsg = messages.find(m => ['bot', 'ai', 'system'].includes(m.sender_type));
        if (greetingMsg) {
          events.push({
            id: 'evt-greeting',
            title: 'AI sent greeting',
            timestamp: greetingMsg.created_at,
            dotColor: 'bg-[#16A34A]',
            priority: 2
          });
        }

        // Anchor B: Stage Transitions (Simulated based on current stage mapping or audit log backups)
        // If lead stage is beyond Qualifying, inject qualified event
        const qualifiedStages = ['qualified', 'proposal', 'booked'];
        if (qualifiedStages.includes((lead.stage || '').toLowerCase())) {
          // We can map it back to the first message from the lead after greeting, or roughly shortly after
          const leadReply = messages.find(m => ['contact', 'lead', 'user'].includes(m.sender_type));
          events.push({
            id: 'evt-qualified',
            title: 'Lead qualified',
            timestamp: leadReply ? leadReply.created_at : new Date(new Date(lead.created_at).getTime() + 300000).toISOString(),
            dotColor: 'bg-[#16A34A]',
            priority: 3
          });
        }

        // Anchor C: Booking Link Transmitted
        // Check if any message contains keywords "book", "calendly", "http"
        const bookingMsg = messages.find(m => {
          const c = (m.content || '').toLowerCase();
          return c.includes('http') || c.includes('book') || c.includes('schedule') || c.includes('link');
        });

        if (bookingMsg) {
          events.push({
            id: 'evt-booking-link',
            title: 'Booking link sent',
            timestamp: bookingMsg.created_at,
            dotColor: 'bg-blue-500',
            priority: 4
          });
        }

        // Anchor D: Appointment Booked
        if (lead.stage?.toLowerCase() === 'booked') {
          events.push({
            id: 'evt-booked',
            title: 'Appointment booked',
            timestamp: messages[messages.length - 1].created_at, // Last message checkpoint
            dotColor: 'bg-[#16A34A]',
            icon: 'check',
            priority: 5
          });
        }
      }
    }

    // Fallback mock safety: if zero interactions occurred yet, we only have the created event
    // Sort events by their natural priority or timestamp
    events.sort((a, b) => a.priority - b.priority);

    return NextResponse.json(events);

  } catch (err: any) {
    logger.error({ leadId, userId: user.id }, 'GET /api/leads/[id]/activity failed', err);
    return NextResponse.json({ error: 'Activity trace retrieval crashed.' }, { status: 500 });
  }
}
