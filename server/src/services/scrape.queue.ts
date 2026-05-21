import { Queue } from 'bullmq';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import type { ScrapeJobData } from '../types/scrape.types.js';

export const SCRAPE_QUEUE_NAME = 'website_scrape_jobs';

// ── Queue Initialisation ──────────────────────────────────────────────────────
const connection = getRedisClient();

export const scrapeQueue = new Queue<ScrapeJobData>(SCRAPE_QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3, // Retry up to 3 times on transient browser crashes
    backoff: {
      type: 'exponential',
      delay: 5000, // Wait 5s before first retry, then 10s, 20s
    },
    removeOnComplete: { age: 3600 }, // Keep completed records for 1 hour to debug
    removeOnFail: { age: 86400 * 7 }, // Keep failures for 7 days
    timeout: 300000, // Hard limit of 5 minutes per scraping job
  },
});

/**
 * Enqueues a new background website scraping and RAG embedding job
 */
export async function enqueueScrapeJob(
  tenantId: string,
  url: string,
  label?: string
): Promise<string> {
  const jobId = `scrape-${tenantId}-${Date.now()}`;
  
  logger.info(`[ScrapeQueue] Enqueuing scraping task`, { tenantId, url, jobId });

  await scrapeQueue.add(
    'process_scrape',
    { jobId, tenantId, url, label },
    { jobId }
  );

  return jobId;
}
