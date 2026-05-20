-- Supabase Migration: Add 'mistral' to ai_provider ENUM
-- Safe DDL execution to extend AI routing capabilities

-- 1. Add 'mistral' to existing ENUM
DO $$
BEGIN
  ALTER TYPE public.ai_provider ADD VALUE 'mistral';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Verify or add composite safety check constraint (if any exist)
-- (Optional descriptive label for audit trace)
COMMENT ON TYPE public.ai_provider IS 'Supported LLM core providers for automated workflows';
