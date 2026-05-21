import type { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { enqueueScrapeJob } from '../services/scrape.queue.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Zod schemas for request validation
const scrapeRequestSchema = z.object({
  url: z.string().url('Please enter a valid website URL address.').refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    { message: 'URL must use HTTP or HTTPS protocol.' }
  ),
  label: z.string().max(80, 'Label cannot exceed 80 characters.').optional(),
});

export class ScrapeController {
  /**
   * POST /api/scrape
   * Triggers a new website scraping background job
   */
  public static async triggerScrape(req: Request, res: Response): Promise<void> {
    const tenantId = (req as any).user?.tenantId || (req as any).user?.tenant_id || req.body.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context resolution failed. Unauthorized.' });
      return;
    }

    try {
      const parsed = scrapeRequestSchema.parse(req.body);
      const { url, label } = parsed;

      logger.info('[ScrapeController] Triggering scrape job', { tenantId, url });

      // 1. Create or resolve the scraped_source record in 'pending' status
      const { data: existingSource } = await supabase
        .from('scraped_sources')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('url', url)
        .maybeSingle();

      let sourceId = existingSource?.id;

      if (!sourceId) {
        const { data: newSource, error: insertErr } = await supabase
          .from('scraped_sources')
          .insert({
            tenant_id: tenantId,
            url,
            label: label || 'New URL Ingestion',
            status: 'pending',
          })
          .select('id')
          .single();

        if (insertErr) {
          throw insertErr;
        }
        sourceId = newSource?.id;
      } else {
        // Reset status to pending for re-scraping
        await supabase
          .from('scraped_sources')
          .update({ status: 'pending', updated_at: new Date().toISOString() })
          .eq('id', sourceId);
      }

      // 2. Insert job transaction in public.scrape_jobs
      const { data: newJob, error: jobErr } = await supabase
        .from('scrape_jobs')
        .insert({
          tenant_id: tenantId,
          source_id: sourceId,
          status: 'queued',
          progress: 0,
        })
        .select('id')
        .single();

      if (jobErr) {
        throw jobErr;
      }

      const jobId = newJob?.id;

      // 3. Enqueue job into BullMQ
      await enqueueScrapeJob(tenantId, url, label);

      res.status(202).json({
        message: 'Website scraping job successfully queued.',
        jobId,
        sourceId,
        status: 'queued',
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.errors[0]?.message || 'Invalid input data.' });
        return;
      }
      logger.error('[ScrapeController] Exception triggering website scrape', { error: err.message });
      res.status(500).json({ error: 'Internal server error occurred while starting scraping.' });
    }
  }

  /**
   * GET /api/scrape/status/:id
   * Returns progress, status, and error logs of a scrape job
   */
  public static async getJobStatus(req: Request, res: Response): Promise<void> {
    const tenantId = (req as any).user?.tenantId || (req as any).user?.tenant_id || req.query.tenantId;
    const jobId = req.params.id;

    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context resolution failed. Unauthorized.' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scrape_jobs')
        .select(`
          id,
          status,
          progress,
          error_message,
          created_at,
          updated_at,
          scraped_sources (
            id,
            url,
            label,
            last_scraped_at,
            metadata
          )
        `)
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        res.status(404).json({ error: 'Scraping job not found.' });
        return;
      }

      res.status(200).json(data);
    } catch (err: any) {
      logger.error('[ScrapeController] Exception fetching job status', { jobId, error: err.message });
      res.status(500).json({ error: 'Failed to retrieve scraping job status.' });
    }
  }

  /**
   * GET /api/scrape/history
   * Retrieves previous scraped websites and metadata indexes for this tenant
   */
  public static async getScrapeHistory(req: Request, res: Response): Promise<void> {
    const tenantId = (req as any).user?.tenantId || (req as any).user?.tenant_id || req.query.tenantId;

    if (!tenantId) {
      res.status(401).json({ error: 'Tenant context resolution failed. Unauthorized.' });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scraped_sources')
        .select(`
          id,
          url,
          label,
          status,
          last_scraped_at,
          created_at,
          scrape_jobs (
            id,
            status,
            progress,
            error_message
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.status(200).json(data);
    } catch (err: any) {
      logger.error('[ScrapeController] Exception fetching scraping logs history', { error: err.message });
      res.status(500).json({ error: 'Failed to retrieve website scraping history.' });
    }
  }
}
