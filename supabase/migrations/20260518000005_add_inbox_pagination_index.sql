-- Migration: Add missing index on messages(conversation_id, created_at DESC) to optimize inbox pagination and RAG queries.
-- Date: 2026-05-18

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);
