import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import { ScraperService } from '../services/scraper.service.js';
import { Chunker } from '../utils/chunker.ts';
import { EmbeddingService } from '../services/embedding.service.js';
import { OpenRouterClient } from '../services/openrouter.client.js';
import { emitToTenant } from '../lib/realtime.js';
import type { ScrapeJobData, ScrapeJobStatus, AIFaqResponse } from '../types/scrape.types.js';
import { SCRAPE_QUEUE_NAME } from '../services/scrape.queue.js';

dotenv.config();

// ── Shared Supabase Service Role client ────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const connection = getRedisClient();

/**
 * Updates real-time job state in Supabase and broadcasts events to connected clients
 */
async function updateJobState(
  jobId: string,
  tenantId: string,
  status: ScrapeJobStatus,
  progress: number,
  errorMsg?: string
): Promise<void> {
  logger.info(`[ScrapeWorker] Updating job status`, { jobId, tenantId, status, progress });

  // 1. Persist state to Supabase scrape_jobs table
  const { error } = await supabase
    .from('scrape_jobs')
    .update({
      status,
      progress,
      error_message: errorMsg || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    logger.error('[ScrapeWorker] Failed to update scrape_jobs table record', { error: error.message });
  }

  // 2. Dispatch real-time Socket.IO event to all active dashboard scopes
  emitToTenant(tenantId, 'scrape_status_update', {
    jobId,
    status,
    progress,
    error: errorMsg,
  });
}

/**
 * Calls OpenRouter Google Gemini Flash to generate FAQs, summaries and service data from content
 */
async function generateAiFaqFromContent(
  tenantId: string,
  markdownText: string
): Promise<AIFaqResponse> {
  const systemPrompt = `Analyze the website markdown content and extract a clean JSON object containing:
1. "faqs": An array of maximum 8 structured Frequently Asked Questions. Each item must have exactly "question" and "answer" properties.
2. "businessSummary": A 2-sentence clean corporate summary explaining what the business does.
3. "servicesSummary": A 2-sentence description of the main products/services this company offers.

Respond STRICTLY with valid JSON. Do not output markdown code blocks (e.g. \`\`\`json) or any wrapping text. Just raw JSON.`;

  const contentTruncated = markdownText.slice(0, 8000); // Guard rails to prevent context overflow

  try {
    const response = await OpenRouterClient.generateResponse({
      model: 'google/gemini-flash-1.5',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Markdown content:\n${contentTruncated}` },
      ],
      responseFormat: { type: 'json_object' },
      tenantId,
      temperature: 0.1,
    });

    const parsedData = JSON.parse(response.text.trim());
    
    return {
      faqs: parsedData.faqs || [],
      businessSummary: parsedData.businessSummary || '',
      servicesSummary: parsedData.servicesSummary || '',
    };
  } catch (err: any) {
    logger.warn('[ScrapeWorker] OpenRouter FAQ extraction failed or returned invalid JSON. Using empty fallback.', {
      error: err.message,
    });
    return { faqs: [], businessSummary: '', servicesSummary: '' };
  }
}

/**
 * Main BullMQ job processor routine
 */
async function processScrapeJob(job: Job<ScrapeJobData>): Promise<void> {
  const { jobId, tenantId, url, label } = job.data;

  logger.info(`[ScrapeWorker] Initialising worker execution for job`, { jobId, url });

  // Initialize status record to scraping
  await updateJobState(jobId, tenantId, 'scraping', 10);

  try {
    // 1. Scraping and Cleaning HTML content
    const scrapedData = await ScraperService.scrapeUrl(url);
    await updateJobState(jobId, tenantId, 'processing', 40);

    // 2. Query Gemini-Flash via OpenRouter to generate FAQs & Business summaries
    const aiExtracted = await generateAiFaqFromContent(tenantId, scrapedData.cleanMarkdown);
    
    // Merge ai extracted faqs with original regex matches
    const allFaqs = [...scrapedData.faqs, ...aiExtracted.faqs].slice(0, 15);

    // 3. Update scraped source status and store extracted business summaries
    const { data: sourceRow, error: sourceErr } = await supabase
      .from('scraped_sources')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('url', url)
      .maybeSingle();

    let sourceId = sourceRow?.id;

    const sourcePayload = {
      tenant_id: tenantId,
      url,
      label: label || scrapedData.title,
      status: 'completed',
      last_scraped_at: new Date().toISOString(),
      metadata: {
        title: scrapedData.title,
        metaDescription: scrapedData.metaDescription,
        emails: scrapedData.emails,
        phones: scrapedData.phones,
        socialLinks: scrapedData.socialLinks,
        businessSummary: aiExtracted.businessSummary,
        servicesSummary: aiExtracted.servicesSummary,
        faqs: allFaqs,
      },
    };

    if (sourceId) {
      await supabase.from('scraped_sources').update(sourcePayload).eq('id', sourceId);
    } else {
      const { data: newSource } = await supabase
        .from('scraped_sources')
        .insert(sourcePayload)
        .select('id')
        .single();
      sourceId = newSource?.id;
    }

    // Connect job record to the source relation
    await supabase.from('scrape_jobs').update({ source_id: sourceId }).eq('id', jobId);

    // 4. Split clean markdown content into 500-1000 token segments
    await updateJobState(jobId, tenantId, 'embedding', 70);
    const chunks = Chunker.splitText(scrapedData.cleanMarkdown, 800, 300, 100);

    if (chunks.length === 0) {
      throw new Error('Website content yielded no extractable structural text segments.');
    }

    // 5. Generate OpenAI embeddings and populate knowledge_base
    let completedChunks = 0;
    const totalChunks = chunks.length;

    for (const chunk of chunks) {
      // Generate standard 1536 OpenAI vector
      const embedding = await EmbeddingService.generateEmbedding(chunk);
      
      if (embedding && embedding.length === 1536) {
        // Insert into the master knowledge_base table so it integrates automatically into the bot's RAG pipeline
        await supabase.from('knowledge_base').insert({
          tenant_id: tenantId,
          content: chunk,
          embedding,
          title: `${scrapedData.title} (Part ${completedChunks + 1})`,
          source_type: 'url',
          source_url: url,
          metadata: {
            jobId,
            sourceId,
            chunkIndex: completedChunks,
            totalChunks,
            scrapedAt: new Date().toISOString(),
          },
        });
      }

      completedChunks++;
      // Dynamically increment progress bar (from 70% to 95%) as vectors are calculated
      const chunkProgress = 70 + Math.floor((completedChunks / totalChunks) * 25);
      await updateJobState(jobId, tenantId, 'embedding', chunkProgress);
    }

    // 6. Complete Job
    await updateJobState(jobId, tenantId, 'completed', 100);
    logger.info(`[ScrapeWorker] Successfully completed scraping & RAG ingestion job`, { jobId });

  } catch (err: any) {
    const errorMsg = err.message || 'Unknown scrap pipeline crash';
    logger.error(`[ScrapeWorker] Job execution failed`, { jobId, error: errorMsg });

    // Mark job and source as failed
    await updateJobState(jobId, tenantId, 'failed', 100, errorMsg);
    
    await supabase
      .from('scraped_sources')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('url', url);
  }
}

// ── Background Worker Daemon ───────────────────────────────────────────────────
const worker = new Worker<ScrapeJobData>(SCRAPE_QUEUE_NAME, processScrapeJob, {
  connection,
  concurrency: 2, // Restrict to 2 concurrent scrapes to avoid CPU/memory overload by browser instances
  limiter: {
    max: 10,
    duration: 60000, // Hard limit of 10 scraping jobs per minute
  },
});

worker.on('completed', (job) => {
  logger.info(`[ScrapeWorker] Job completed successfully`, { id: job.id });
});

worker.on('failed', (job, err) => {
  logger.error(`[ScrapeWorker] Job failed permanently after maximum retries`, {
    id: job?.id,
    error: err.message,
  });
});

worker.on('error', (err) => {
  logger.error('[ScrapeWorker] Worker loop encountered exception', { error: err.message });
});

process.on('SIGTERM', async () => {
  await worker.close();
  logger.info('[ScrapeWorker] Scraper worker shut down gracefully.');
  process.exit(0);
});

logger.info('[ScrapeWorker] WhatsFlow AI website scraper worker online');
