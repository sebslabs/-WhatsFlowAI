-- ==============================================================================
-- WhatsFlow AI Database Migration: Knowledge Base Schema Alignment
-- File: 20260518000001_knowledge_base_alignment.sql
-- Description: Adds missing UI-tracking columns to knowledge_base table.
-- ==============================================================================

BEGIN;

-- 1. Safely add missing columns to knowledge_base table
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Populate fallback title for any existing orphaned rows
UPDATE public.knowledge_base
SET title = 'Imported Resource ' || substring(id::text, 1, 6)
WHERE title IS NULL;

-- 3. Set non-null constraint on title to prevent garbage data
ALTER TABLE public.knowledge_base
  ALTER COLUMN title SET NOT NULL;

-- 4. Create performance indexing for keyword filters on title and source type
CREATE INDEX IF NOT EXISTS idx_kb_tenant_title ON public.knowledge_base (tenant_id, title);
CREATE INDEX IF NOT EXISTS idx_kb_source_type ON public.knowledge_base (source_type);

COMMIT;
