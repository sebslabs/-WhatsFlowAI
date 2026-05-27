import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { resolveConversationIdsForLead } from '@/lib/inbox-resolve';

const INCOMING_SENDERS = new Set(['contact', 'lead', 'user', 'customer']);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  const leadId = params.id;

  try {
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_id, phone')
      .eq('id', leadId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead profile not registered or inaccessible.' }, { status: 404 });
    }

    const conversationIds = await resolveConversationIdsForLead(supabase, user.tenant_id, lead);

    if (conversationIds.length === 0) {
      return NextResponse.json({ messages: [], pagination: { page: 1, pageSize: 50, total: 0, hasMore: false } });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') ?? '50', 10) || 50));
    const offset = (page - 1) * pageSize;

    // PERFORMANCE FIX: Fetch the most recent messages first, then reverse for chronological UI
    const fullSelect = await supabase
      .from('messages')
      .select('id, sender_type, content, message_type, media_url, metadata, created_at', { count: 'estimated' })
      .in('conversation_id', conversationIds)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    let messages: Array<Record<string, unknown>> | null = null;
    let totalCount = 0;

    if (fullSelect.error) {
      logger.warn({ error: fullSelect.error }, 'Fallback: media message select failed, falling back to basic columns');

      const safeSelect = await supabase
        .from('messages')
        .select('id, sender_type, content, created_at', { count: 'estimated' })
        .in('conversation_id', conversationIds)
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (safeSelect.error) throw safeSelect.error;
      messages = (safeSelect.data ?? []) as Array<Record<string, unknown>>;
      totalCount = safeSelect.count ?? 0;
    } else {
      messages = (fullSelect.data ?? []) as Array<Record<string, unknown>>;
      totalCount = fullSelect.count ?? 0;
    }

    // Chronological order for chat UI (oldest at top)
    const chronological = [...messages].reverse();

    const formattedMessages = chronological.map((msg) => ({
      id: msg.id,
      side: INCOMING_SENDERS.has(String(msg.sender_type)) ? 'left' : 'right',
      content: msg.content,
      timestamp: msg.created_at,
      sender_type: msg.sender_type,
      message_type: msg.message_type || 'text',
      media_url: msg.media_url || null,
      metadata: msg.metadata || null,
    }));

    const primaryConversationId = conversationIds[0];

    return NextResponse.json({
      conversationId: primaryConversationId,
      messages: formattedMessages,
      pagination: {
        page,
        pageSize,
        total: totalCount ?? formattedMessages.length,
        hasMore: (totalCount ?? 0) > offset + formattedMessages.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ leadId, userId: user.id }, 'GET /api/leads/[id]/conversation failed', err);
    return NextResponse.json({ error: 'Failed to load chat logs.', details: message }, { status: 500 });
  }
}
