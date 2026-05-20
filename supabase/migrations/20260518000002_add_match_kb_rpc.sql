-- File: 20260518000002_add_match_kb_rpc.sql
-- Description: Adds a lightning-fast semantic pgvector similarity search function for RAG knowledge base.

CREATE OR REPLACE FUNCTION public.match_kb (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_base kb
  WHERE kb.tenant_id = p_tenant_id
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
