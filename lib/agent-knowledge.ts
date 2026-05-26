import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateEmbedding } from '@/lib/embeddings'
import { logger } from '@/lib/logger'

export type AgentKbSource = {
  id: string
  type: string
  label?: string
  text?: string
  context?: string
  assetId?: string
  faqs?: { id: string; question: string; answer: string }[]
}

function baseTitle(title: string): string {
  return title.replace(/\s*\(Part \d+\)\s*$/i, '').trim()
}

/** Expand linked asset IDs to all chunks from the same document. */
export async function expandKnowledgeIds(tenantId: string, rootIds: string[]): Promise<string[]> {
  if (!rootIds.length) return []

  const admin = getSupabaseAdmin()
  const expanded = new Set<string>(rootIds)

  interface KnowledgeBaseRow {
    id: string
    title: string | null
    metadata: Record<string, unknown> | null
  }

  const { data: roots } = await admin
    .from('knowledge_base')
    .select('id, title, metadata')
    .eq('tenant_id', tenantId)
    .in('id', rootIds) as { data: KnowledgeBaseRow[] | null }

  for (const root of (roots ?? []) as KnowledgeBaseRow[]) {
    expanded.add(root.id)
    const docId = (root.metadata as Record<string, unknown>)?.document_id as string | undefined
    if (docId) {
      const { data: byDoc } = await admin
        .from('knowledge_base')
        .select('id')
        .eq('tenant_id', tenantId)
        .filter('metadata->>document_id', 'eq', docId)
      byDoc?.forEach((r) => expanded.add(r.id))
    }

    const stem = baseTitle(root.title || '')
    if (stem) {
      const { data: byTitle } = await admin
        .from('knowledge_base')
        .select('id, title')
        .eq('tenant_id', tenantId)
        .ilike('title', `${stem}%`)
      byTitle?.forEach((r) => expanded.add(r.id))
    }
  }

  return [...expanded]
}

/** IDs this agent may use for RAG; null = search entire tenant knowledge base. */
export async function resolveAllowedKnowledgeIds(
  tenantId: string,
  agentId: string,
  kbSources: AgentKbSource[] | undefined
): Promise<string[] | null> {
  if (!kbSources?.length) return null

  const linkedIds = kbSources
    .filter((s) => s.type === 'existing_asset' && s.assetId)
    .map((s) => s.assetId as string)

  const expanded = new Set(await expandKnowledgeIds(tenantId, linkedIds))

  const admin = getSupabaseAdmin()
  const { data: agentRows } = await admin
    .from('knowledge_base')
    .select('id')
    .eq('tenant_id', tenantId)
    .filter('metadata->>agent_id', 'eq', agentId)

  agentRows?.forEach((r) => expanded.add(r.id))

  if (expanded.size === 0) return null
  return [...expanded]
}

async function upsertAgentChunk(
  tenantId: string,
  agentId: string,
  sourceId: string,
  title: string,
  content: string,
  sourceType: string
): Promise<void> {
  const admin = getSupabaseAdmin()
  const embedding = await generateEmbedding(content)

  const { data: existing } = await admin
    .from('knowledge_base')
    .select('id')
    .eq('tenant_id', tenantId)
    .filter('metadata->>agent_id', 'eq', agentId)
    .filter('metadata->>agent_kb_source_id', 'eq', sourceId)
    .maybeSingle()

  const payload = {
    tenant_id: tenantId,
    title,
    content,
    source_type: sourceType,
    embedding,
    updated_at: new Date().toISOString(),
    metadata: {
      agent_id: agentId,
      agent_kb_source_id: sourceId,
      document_id: existing?.id ?? undefined,
    },
  }

  if (existing?.id) {
    await admin.from('knowledge_base').update(payload).eq('id', existing.id)
    if (!payload.metadata.document_id) {
      await admin
        .from('knowledge_base')
        .update({ metadata: { ...payload.metadata, document_id: existing.id } })
        .eq('id', existing.id)
    }
  } else {
    const { data: inserted } = await admin.from('knowledge_base').insert(payload).select('id').single()
    if (inserted?.id) {
      await admin
        .from('knowledge_base')
        .update({ metadata: { ...payload.metadata, document_id: inserted.id } })
        .eq('id', inserted.id)
    }
  }
}

/** Persist inline agent knowledge (plain text, business context, FAQs) into knowledge_base. */
export async function syncAgentKnowledgeSources(
  tenantId: string,
  agentId: string,
  kbSources: AgentKbSource[] | undefined
): Promise<void> {
  if (!kbSources?.length) return

  for (const source of kbSources) {
    try {
      if (source.type === 'plain_text' && source.text?.trim()) {
        await upsertAgentChunk(
          tenantId,
          agentId,
          source.id,
          source.label?.trim() || 'Agent Plain Text',
          source.text.trim(),
          'text'
        )
      } else if (source.type === 'business_context' && source.context?.trim()) {
        await upsertAgentChunk(
          tenantId,
          agentId,
          source.id,
          source.label?.trim() || 'Business Context',
          source.context.trim(),
          'text'
        )
      } else if (source.type === 'faq' && source.faqs?.length) {
        for (const faq of source.faqs) {
          if (!faq.question?.trim() || !faq.answer?.trim()) continue
          await upsertAgentChunk(
            tenantId,
            agentId,
            `${source.id}:${faq.id}`,
            faq.question.trim(),
            `Q: ${faq.question.trim()}\nA: ${faq.answer.trim()}`,
            'faq'
          )
        }
      }
    } catch (err) {
      logger.error({ agentId, sourceId: source.id, err }, '[agent-knowledge] Failed to sync source')
    }
  }
}
