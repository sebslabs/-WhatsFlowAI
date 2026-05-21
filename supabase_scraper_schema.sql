-- ==============================================================================
-- WhatsFlow AI Database Schema: Website Scraper & Ingestion System
-- File: supabase_scraper_schema.sql
-- Description: Creates scraped_sources and scrape_jobs tables with RLS and indexing.
-- ==============================================================================

BEGIN;

-- ── 1. Create Scraped Sources Table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraped_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'processing', 'completed', 'failed')),
  last_scraped_at TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}'::jsonb, -- Holds emails, phones, social links, FAQs, and business summaries
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, url)
);

-- ── 2. Create Scrape Jobs Table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scrape_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES public.scraped_sources(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'scraping', 'processing', 'embedding', 'completed', 'failed')),
  progress        INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Enable Row Level Security (RLS) ──────────────────────────────────────────
ALTER TABLE public.scraped_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_jobs ENABLE ROW LEVEL SECURITY;

-- ── 4. Apply Tenant Isolation Policies ─────────────────────────────────────────
DROP POLICY IF EXISTS "Tenant isolation on scraped_sources" ON public.scraped_sources;
CREATE POLICY "Tenant isolation on scraped_sources" ON public.scraped_sources
  FOR ALL USING (auth_is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "Tenant isolation on scrape_jobs" ON public.scrape_jobs;
CREATE POLICY "Tenant isolation on scrape_jobs" ON public.scrape_jobs
  FOR ALL USING (auth_is_tenant_member(tenant_id));

-- ── 5. Create Performance Optimised Indexes ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scraped_sources_tenant ON public.scraped_sources (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scraped_sources_lookup ON public.scraped_sources (tenant_id, url);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_tenant ON public.scrape_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_scrape_jobs_status ON public.scrape_jobs (status);

-- ── 6. Setup Auto Update Triggers ──────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_scraped_sources_upd ON public.scraped_sources;
CREATE TRIGGER trg_scraped_sources_upd 
  BEFORE UPDATE ON public.scraped_sources 
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_scrape_jobs_upd ON public.scrape_jobs;
CREATE TRIGGER trg_scrape_jobs_upd 
  BEFORE UPDATE ON public.scrape_jobs 
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

COMMIT;
