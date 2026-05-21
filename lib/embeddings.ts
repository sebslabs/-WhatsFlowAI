import { config } from '@/lib/config'
import { logger } from '@/lib/logger'

/** Unified 1536-dim embeddings for ingest and retrieval (text-embedding-3-small). */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const hasOpenAI = config.openaiApiKey && config.openaiApiKey !== 'your_openai_api_key'
  const openrouterKey = config.openrouterApiKey
  const preferOpenRouter =
    !!openrouterKey && (!hasOpenAI || process.env.AI_PROVIDER === 'openrouter')

  if (!hasOpenAI && !openrouterKey) {
    logger.warn('[RAG] Embeddings API key not configured — RAG skipped')
    return null
  }

  const cleanInput = text.replace(/\n/g, ' ').trim()
  if (!cleanInput) return null

  if (preferOpenRouter && openrouterKey) {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://whatsflow.ai',
        'X-Title': 'WhatsFlow AI',
      },
      body: JSON.stringify({ input: cleanInput, model: 'openai/text-embedding-3-small' }),
    })
    if (response.ok) {
      const resData = await response.json()
      const embedding = resData?.data?.[0]?.embedding
      if (Array.isArray(embedding) && embedding.length > 0) return embedding
    }
  }

  const body = JSON.stringify({ input: cleanInput, model: 'text-embedding-3-small' })

  if (hasOpenAI) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body,
    })
    if (response.ok) {
      const resData = await response.json()
      const embedding = resData?.data?.[0]?.embedding
      if (Array.isArray(embedding) && embedding.length > 0) return embedding
    } else {
      logger.warn({ status: response.status }, '[embeddings] OpenAI failed, trying OpenRouter')
    }
  }

  if (openrouterKey) {
    const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterKey}`,
        'HTTP-Referer': 'https://whatsflow.ai',
        'X-Title': 'WhatsFlow AI',
      },
      body: JSON.stringify({ input: cleanInput, model: 'openai/text-embedding-3-small' }),
    })
    if (response.ok) {
      const resData = await response.json()
      const embedding = resData?.data?.[0]?.embedding
      if (Array.isArray(embedding) && embedding.length > 0) return embedding
    }
  }

  return null
}
