import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const messageId = params.id;
  const loggerContext = { messageId };

  try {
    const supabase = createClient();
    
    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY FIX (HIGH #5): Use tenant_members.tenant_id — not profiles.organization_id.
    // organization_id can diverge from the canonical tenant, causing IDOR or failed deletes.
    const { data: member, error: memberError } = await supabase
      .from('tenant_members')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (memberError || !member?.tenant_id) {
      return NextResponse.json({ error: 'Tenant context mismatch' }, { status: 403 });
    }

    // 3. Execute tenant-scoped deletion
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('tenant_id', member.tenant_id);

    if (deleteError) {
      logger.error({ ...loggerContext, error: deleteError }, 'Failed to delete message from Supabase');
      throw deleteError;
    }

    logger.info({ ...loggerContext, userId: user.id }, 'Message deleted successfully');
    return NextResponse.json({ success: true });

  } catch (err: any) {
    logger.error({ ...loggerContext, error: err.message }, 'DELETE /api/conversations/messages/[id] failed');
    return NextResponse.json(
      { error: 'Failed to delete message.', details: err.message },
      { status: 500 }
    );
  }
}
