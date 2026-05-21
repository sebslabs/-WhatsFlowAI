import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { Redis } from '@upstash/redis'
import { config } from '@/lib/config'
import { generateEmbedding } from '@/lib/embeddings'
import { logger } from '@/lib/logger'

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey)

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    _redis = new Redis({ url, token })
    return _redis
  } catch {
    return null
  }
}

const SIMILARITY_THRESHOLD = 0.32

export async function retrieveRAGContext(
  message: string,
  tenantId: string,
  allowedSourceIds?: string[] | null,
  agentId?: string
): Promise<string> {
  const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key'
  const openrouterKey = process.env.OPENROUTER_API_KEY
  if (!hasOpenAI && !openrouterKey) {
    logger.warn('[RAG] Embeddings API key not configured — RAG skipped')
    return ''
  }

  const embedding = await generateEmbedding(message)
  if (!embedding) {
    logger.warn({ tenantId }, '[RAG] Embedding generation failed')
    return ''
  }

  const cacheKey = `rag:${tenantId}:${allowedSourceIds?.length ? allowedSourceIds.join(',') : 'all'}:${crypto.createHash('md5').update(message).digest('hex')}`
  const redis = getRedis()
  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey)
      if (cached) return cached
    } catch {
      /* ignore */
    }
  }

  try {
    const { data, error } = await supabase.rpc('match_kb', {
      query_embedding: embedding,
      match_threshold: 0.15,
      match_count: 12,
      p_tenant_id: tenantId,
    })

    if (error) {
      logger.error({ error: error.message, tenantId }, '[RAG] match_kb failed')
      return ''
    }

    let candidates = data || []

    if (allowedSourceIds?.length) {
      const allowed = new Set(allowedSourceIds)
      candidates = candidates.filter((c: { id: string }) => allowed.has(c.id))
    }

    const filtered = candidates.filter((c: { similarity: number }) => c.similarity >= SIMILARITY_THRESHOLD)
    logger.info(`[RAG] Chunks retrieved: ${filtered.length} for agentId ${agentId || 'unknown'}`)

    if (!filtered.length) {
      return ''
    }

    const ctx = filtered
      .map((c: { content: string }) => c.content.replace(/<[^>]*>/g, '').trim())
      .join('\n---\n')
      .slice(0, 4000)

    if (redis && ctx) {
      try {
        await redis.set(cacheKey, ctx, { ex: 3600 })
      } catch {
        /* ignore */
      }
    }

    return ctx
  } catch (err) {
    logger.error({ err, tenantId }, '[RAG] retrieval exception')
    return ''
  }
}
