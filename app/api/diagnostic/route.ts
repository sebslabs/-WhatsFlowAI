import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { config } from '@/lib/config';
import { requireAdminApi } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const { user, error: authError } = await requireAdminApi(request);
  if (authError || !user) {
    return authError || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const logs: string[] = [];

  try {
    logs.push("Executing catalog purge of all match_kb overloads...");
    
    // Dynamic drop block using regprocedure to wipe all matching function names cleanly
    const purgeSql = `
      DO $$
      DECLARE
          r RECORD;
      BEGIN
          FOR r IN 
              SELECT oid::regprocedure AS proc_name
              FROM pg_proc
              WHERE proname = 'match_kb'
          LOOP
              RAISE NOTICE 'Dropping function %', r.proc_name;
              EXECUTE 'DROP FUNCTION ' || r.proc_name;
          END LOOP;
      END $$;
    `;

    const { error: purgeError } = await supabase.rpc('exec_sql', { sql: purgeSql });
    if (purgeError) {
      logs.push(`❌ Dynamic purge failed: ${purgeError.message}`);
      return NextResponse.json({ success: false, logs });
    }
    logs.push("✅ Catalog successfully cleared!");

    logs.push("Recreating exactly ONE public.match_kb function using double precision[] (float array) signature...");
    
    const createSql = `
      CREATE OR REPLACE FUNCTION public.match_kb (
        query_embedding double precision[],
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
      LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions AS $$
      BEGIN
        RETURN QUERY
        SELECT
          kb.id,
          kb.content,
          kb.metadata,
          1 - (kb.embedding <=> query_embedding::vector) AS similarity
        FROM public.knowledge_base kb
        WHERE kb.tenant_id = p_tenant_id
          AND 1 - (kb.embedding <=> query_embedding::vector) > match_threshold
        ORDER BY kb.embedding <=> query_embedding::vector
        LIMIT match_count;
      END;
      $$;
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createSql });
    if (createError) {
      logs.push(`❌ Failed to create match_kb: ${createError.message}`);
      return NextResponse.json({ success: false, logs });
    }
    logs.push("✅ Successfully created public.match_kb(double precision[], float, int, uuid) function!");

    // Force PostgREST to reload its schema cache
    logs.push("Triggering PostgREST schema cache reload...");
    await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" });
    logs.push("✅ PostgREST schema cache reload notify sent!");

    // Run test query RAG lookup
    const { data: agents } = await supabase.from('ai_agents').select('tenant_id, name').limit(1);
    if (!agents || agents.length === 0) {
      return NextResponse.json({ success: true, logs, error: "No AI agents found to test." });
    }

    const tenantId = agents[0].tenant_id;
    const testQuery = request.nextUrl.searchParams.get('q') || "Give about your company";

    const hasOpenRouter = !!config.openrouterApiKey;
    let embedding: number[] | null = null;

    if (hasOpenRouter) {
      const embedRes = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.openrouterApiKey}`,
        },
        body: JSON.stringify({ input: testQuery.replace(/\n/g, ' '), model: 'openai/text-embedding-3-small' }),
      });
      if (embedRes.ok) {
        const embedData = await embedRes.json();
        embedding = embedData?.data?.[0]?.embedding;
      }
    }

    if (!embedding) {
      return NextResponse.json({ success: true, logs, error: "Failed to generate query embedding during test." });
    }

    logs.push("Executing live RPC call to test matching...");
    
    const { data: candidates, error: testError } = await supabase.rpc('match_kb', {
      query_embedding: embedding,
      match_threshold: 0.1,
      match_count: 5,
      p_tenant_id: tenantId,
    });

    return NextResponse.json({
      success: true,
      logs,
      testQuery: {
        query: testQuery,
        tenantId,
        embeddingLength: embedding.length,
      },
      matchKbQueryResult: {
        error: testError || null,
        candidatesCount: candidates?.length || 0,
        candidates: candidates || []
      }
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, logs, error: err.message }, { status: 500 });
  }
}
