import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';

dotenv.config();

export class EmbeddingService {
  private static get apiKey() {
    return process.env.OPENAI_API_KEY || '';
  }

  /**
   * Generates a 1536-dimensional vector embedding for the target text.
   * Cascades to OpenRouter if OpenAI key is missing or dummy placeholder.
   */
  public static async generateEmbedding(text: string): Promise<number[]> {
    const key = this.apiKey;
    const hasOpenAI = key && key !== 'your_openai_api_key';
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!hasOpenAI && !openrouterKey) {
      logger.warn('[RAG] Embeddings API key not configured — RAG skipped');
      return [];
    }

    const cleanInput = text.replace(/\n/g, ' ').trim();
    if (!cleanInput) return [];

    let attempt = 1;
    const maxAttempts = 3;

    while (attempt <= maxAttempts) {
      try {
        if (hasOpenAI) {
          const response = await fetch('https://api.openai.com/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
              input: cleanInput,
              model: 'text-embedding-3-small',
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            const embedding = resData?.data?.[0]?.embedding;
            if (embedding && Array.isArray(embedding)) {
              return embedding;
            }
          } else {
            const errorText = await response.text();
            logger.warn(`[EmbeddingService] OpenAI Embedding API failed (status ${response.status}): ${errorText}. Trying OpenRouter...`);
          }
        }

        if (openrouterKey) {
          const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openrouterKey}`,
              'HTTP-Referer': 'https://whatsflow.ai',
              'X-Title': 'WhatsFlow AI',
            },
            body: JSON.stringify({
              input: cleanInput,
              model: 'openai/text-embedding-3-small',
            }),
          });

          if (response.ok) {
            const resData = await response.json();
            const embedding = resData?.data?.[0]?.embedding;
            if (embedding && Array.isArray(embedding)) {
              return embedding;
            }
          } else {
            const errorText = await response.text();
            logger.error(`[EmbeddingService] OpenRouter Embedding API failed (status ${response.status}): ${errorText}`);
          }
        }

        throw new Error('Failed to generate embedding from all configured providers');
      } catch (err: any) {
        logger.error(`[EmbeddingService] Attempt ${attempt} failed to generate vector`, {
          error: err.message,
        });

        if (attempt === maxAttempts) {
          throw err;
        }

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        attempt++;
      }
    }

    return [];
  }
}
