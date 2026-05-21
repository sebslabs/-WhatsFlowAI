-- ==============================================================================
-- WHATSFLOW AI — ZERO-TRUST ENTERPRISE SECURITY HARDENING
-- File: 20260514010000_final_zero_trust_hardening.sql
-- Description: Final hardening migration deploying strict public.is_tenant_member() 
--              architectures, missing composite indexes, and secure storage policies.
-- Safe to re-run (uses DROP/CREATE IF NOT EXISTS guards)
-- ==============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. ISOLATION ORACLE DEFINITION (AS REQUIRED)
-- ──────────────────────────────────────────────────────────────────────────────

-- Drops legacy potentially leaky or slow function variants
DROP FUNCTION IF EXISTS public.auth_is_tenant_member(uuid);
DROP FUNCTION IF EXISTS public.auth_is_tenant_member(p_tenant_id uuid);
DROP FUNCTION IF EXISTS public.get_auth_tenant_id();

-- Production-Grade, Bulletproof Tenant Membership Oracle
CREATE OR REPLACE FUNCTION public.is_tenant_member(tid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT EXISTS (
  SELECT 1
  FROM public.tenant_members tm
  WHERE tm.tenant_id = tid
    AND tm.user_id = auth.uid()
)
OR EXISTS (
  -- Robust backwards-compatibility fallback for standard profile associations
  SELECT 1
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.organization_id = tid
);
$$;

COMMENT ON FUNCTION public.is_tenant_member(uuid) IS 
  'Cryptographic multi-tenant oracle enforcing zero-trust isolation checks.';

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. SECURITY SHIELD ACTIVATION (ROW LEVEL SECURITY)
-- ──────────────────────────────────────────────────────────────────────────────

-- Force activation of RLS across ALL core and feature tables
DO $$
DECLARE
    t text;
    tables_to_secure text[] := ARRAY[
        'tenants', 'profiles', 'tenant_members', 'api_keys', 'billing_subscriptions', 
        'contacts', 'conversations', 'messages', 'tags', 'contact_tags', 'notes', 
        'handoff_requests', 'tasks', 'whatsapp_accounts', 'whatsapp_templates', 
        'outbound_messages', 'webhook_events', 'webhook_latency_log', 'ai_agents', 
        'chatbot_flows', 'leads', 'knowledge_base', 'usage_logs', 'campaigns', 
        'campaign_logs', 'audit_logs', 'dead_letter_queue', 'queue_metrics_snapshots',
        'settings'
    ];
BEGIN
    FOREACH t IN ARRAY tables_to_secure
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        END IF;
    END LOOP;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. ZERO-TRUST TENANT POLICIES (FOR ALL DB MODIFICATIONS)
-- ──────────────────────────────────────────────────────────────────────────────

-- A. System Profile Policies
DROP POLICY IF EXISTS "Profiles self access" ON public.profiles;
CREATE POLICY "Profiles self access" ON public.profiles
FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- B. Tenant Profile / Membership Policies
DROP POLICY IF EXISTS "Tenants Isolation" ON public.tenants;
CREATE POLICY "Tenants Isolation" ON public.tenants
FOR ALL TO authenticated USING (public.is_tenant_member(id));

DROP POLICY IF EXISTS "Tenant Members Isolation" ON public.tenant_members;
CREATE POLICY "Tenant Members Isolation" ON public.tenant_members
FOR ALL TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id));

-- C. Unified Zero-Trust Iteration for Feature Tables
DO $$
DECLARE
    t text;
    tables_with_tenant_id text[] := ARRAY[
        'api_keys', 'billing_subscriptions', 'contacts', 'conversations', 'messages',
        'leads', 'tags', 'contact_tags', 'notes', 'handoff_requests', 'tasks',
        'whatsapp_accounts', 'whatsapp_templates', 'outbound_messages', 'webhook_events',
        'webhook_latency_log', 'ai_agents', 'chatbot_flows', 'knowledge_base', 'usage_logs',
        'campaigns', 'audit_logs', 'dead_letter_queue', 'settings'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_tenant_id
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            -- Clear prior variations to avoid collisions
            EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_isolation" ON public.%I;', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "%I isolation" ON public.%I;', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "%I_tenant_isolation_v2" ON public.%I;', t, t);
            
            -- Deploy hardened Zero-Trust Policy utilizing our optimized oracle
            EXECUTE format('
                CREATE POLICY "%I_tenant_isolation_v2" ON public.%I
                FOR ALL 
                TO authenticated 
                USING (public.is_tenant_member(tenant_id))
                WITH CHECK (public.is_tenant_member(tenant_id));
            ', t, t);
        END IF;
    END LOOP;
END;
$$;

-- D. Special Joint-Scope Policies (Tables dependent on foreign schemas)
DROP POLICY IF EXISTS "Campaign logs isolation" ON public.campaign_logs;
CREATE POLICY "Campaign logs isolation" ON public.campaign_logs
FOR ALL TO authenticated
USING (public.is_tenant_member(tenant_id))
WITH CHECK (public.is_tenant_member(tenant_id));

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. ENTERPRISE STORAGE PROTECTION BUCKETS
-- ──────────────────────────────────────────────────────────────────────────────

-- Hardens 'catalog-images' against cross-tenant reads and write injection.
-- Maps path formats: `{tenant_id}/filename.png`
DROP POLICY IF EXISTS "Catalog Images Tenant Isolation Read" ON storage.objects;
CREATE POLICY "Catalog Images Tenant Isolation Read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'catalog-images' AND public.is_tenant_member((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "Catalog Images Tenant Isolation Insert" ON storage.objects;
CREATE POLICY "Catalog Images Tenant Isolation Insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'catalog-images' AND public.is_tenant_member((storage.foldername(name))[1]::uuid));

DROP POLICY IF EXISTS "Catalog Images Tenant Isolation Delete" ON storage.objects;
CREATE POLICY "Catalog Images Tenant Isolation Delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'catalog-images' AND public.is_tenant_member((storage.foldername(name))[1]::uuid));

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. OPTIMIZATION INDEXES (PREVENT FULL SCAN TIMEOUTS)
-- ──────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_user ON public.tenant_members (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads (tenant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_tenant_id ON public.knowledge_base (tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON public.campaigns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_tenant_id ON public.chatbot_flows (tenant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_tenant_id ON public.whatsapp_templates (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_id ON public.ai_agents (tenant_id);
CREATE INDEX IF NOT EXISTS idx_handoff_requests_tenant_id ON public.handoff_requests (tenant_id);

COMMIT;
