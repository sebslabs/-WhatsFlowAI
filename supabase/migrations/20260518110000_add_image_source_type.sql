-- ==============================================================================
-- WhatsFlow AI Database Migration: Add 'image' Source Type to Knowledge Base
-- File: 20260518110000_add_image_source_type.sql
-- Description: Updates the check constraint on knowledge_base to allow 'image'.
-- ==============================================================================

BEGIN;

-- 1. Drop the old check constraint safely
ALTER TABLE public.knowledge_base 
  DROP CONSTRAINT IF EXISTS knowledge_base_source_type_check;

-- 2. Add the updated check constraint including 'image'
ALTER TABLE public.knowledge_base
  ADD CONSTRAINT knowledge_base_source_type_check 
  CHECK (source_type IN ('text', 'url', 'pdf', 'faq', 'image'));

COMMIT;
