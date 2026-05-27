import { NextRequest, NextResponse } from 'next/server';
import { AIGateway } from '@/services/ai-gateway';
import { logger } from '@/lib/logger';
import { handleApiError } from '@/lib/errors';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { resolveAllowedKnowledgeIds } from '@/lib/agent-knowledge';
import type { AgentKbSource } from '@/lib/agent-knowledge';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify internal communication authentication token
    const internalKey = req.headers.get('x-internal-key');
    const systemInternalKey = process.env.INTERNAL_API_KEY;

    if (!systemInternalKey) {
      logger.error('[Internal AI Route] INTERNAL_API_KEY is not configured in environment.');
      return NextResponse.json({ error: 'Internal server config error' }, { status: 500 });
    }

    if (!internalKey || internalKey !== systemInternalKey) {
      logger.warn('[Internal AI Route] Blocked unauthorized internal AI request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request payload — read as text first to surface parse errors clearly
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      logger.error({ rawBody: rawBody?.slice(0, 200) }, '[Internal AI Route] Invalid JSON body received from Fly.io backend');
      return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 });
    }

    const {
      message,
      systemPrompt,
      history,
      model,
      tenantId,
      userId,
      agentId,
      conversationId,
      knowledgeSourceIds,
      handoffContext,
    } = body;

    if (!message || !systemPrompt || !tenantId) {
      return NextResponse.json({ error: 'message, systemPrompt, and tenantId are required' }, { status: 400 });
    }

    let resolvedSourceIds = knowledgeSourceIds as string[] | null | undefined;
    if (agentId && resolvedSourceIds === undefined) {
      const admin = getSupabaseAdmin();
      const { data: agent } = await admin
        .from('ai_agents')
        .select('metadata')
        .eq('id', agentId)
        .eq('tenant_id', tenantId)
        .maybeSingle() as { data: { metadata: Record<string, unknown> | null } | null; error: any };
      if (agent) {
        resolvedSourceIds = await resolveAllowedKnowledgeIds(
          tenantId,
          agentId,
          (agent.metadata?.kbSources ?? []) as AgentKbSource[]
        );
      }
    }

    const response = await AIGateway.generateResponse({
      message,
      systemPrompt,
      history,
      model,
      tenantId,
      userId,
      agentId,
      conversationId,
      knowledgeSourceIds: resolvedSourceIds,
      handoffContext,
    });

    return NextResponse.json(response);
  } catch (err: any) {
    logger.error({ err: err?.message, stack: err?.stack }, '[Internal AI Route] Unhandled exception');
    return handleApiError(err, 'Failed to process AI request');
  }
}
