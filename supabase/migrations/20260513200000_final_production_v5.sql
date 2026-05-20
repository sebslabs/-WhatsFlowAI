-- ==============================================================================
-- WHATSFLOW AI — FINAL ENTERPRISE PRODUCTION SCHEMA V5
-- File: 20260513200000_final_production_v5.sql
-- Description: Complete, authoritative, zero-downtime, multi-tenant SaaS schema.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pg_cron requires superuser setup, IF NOT EXISTS will safely no-op if unavailable
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==============================================================================
-- 2. ENUMS
-- ==============================================================================
DO $$ BEGIN CREATE TYPE public.sender_type AS ENUM ('user', 'ai', 'system', 'agent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.conversation_status AS ENUM ('open', 'resolved', 'snoozed', 'spam'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'unpaid'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.tenant_plan AS ENUM ('free', 'starter', 'pro', 'enterprise'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.webhook_status AS ENUM ('pending', 'processing', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.queue_job_status AS ENUM ('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ai_provider AS ENUM ('openai', 'gemini', 'groq', 'openrouter', 'anthropic'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'running', 'completed', 'paused', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.handoff_status AS ENUM ('pending', 'accepted', 'rejected', 'resolved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.audit_action_type AS ENUM ('create', 'read', 'update', 'delete', 'login', 'export'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.outbound_status AS ENUM ('queued', 'sending', 'sent', 'delivered', 'read', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.knowledge_source_type AS ENUM ('text', 'pdf', 'url', 'faq'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==============================================================================
-- 3. FUNCTIONS (Pre-requisites for tables & security)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS uuid AS $$
BEGIN
    RETURN (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')::uuid;
EXCEPTION
    WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auth_is_tenant_member(check_tenant_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN (
        check_tenant_id = public.get_auth_tenant_id() OR
        EXISTS (
            SELECT 1 FROM public.tenant_members
            WHERE tenant_id = check_tenant_id
            AND user_id = auth.uid()
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ==============================================================================
-- 4. CORE TABLES (Auth / Tenancy)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE,
    plan public.tenant_plan DEFAULT 'free',
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL UNIQUE,
    full_name text,
    avatar_url text,
    phone text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.api_keys (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    key_hash text NOT NULL UNIQUE,
    key_prefix text NOT NULL,
    scopes jsonb NOT NULL DEFAULT '["api"]',
    expires_at timestamptz,
    last_used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    stripe_customer_id text,
    stripe_subscription_id text,
    status public.subscription_status NOT NULL DEFAULT 'trialing',
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 5. CRM TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    phone_number text NOT NULL,
    name text,
    avatar_url text,
    email text,
    opt_in_status boolean DEFAULT true,
    tags jsonb DEFAULT '[]', 
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, phone_number)
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status public.conversation_status NOT NULL DEFAULT 'open',
    mode text NOT NULL DEFAULT 'bot' CHECK (mode IN ('bot', 'manual')),
    ai_enabled boolean NOT NULL DEFAULT true,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    unread_count integer NOT NULL DEFAULT 0,
    last_message_at timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, contact_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_type public.sender_type NOT NULL,
    content text NOT NULL,
    message_type text NOT NULL DEFAULT 'text',
    wa_message_id text UNIQUE,
    delivery_status public.message_status NOT NULL DEFAULT 'pending',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.contact_tags (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE IF NOT EXISTS public.notes (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.handoff_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    status public.handoff_status NOT NULL DEFAULT 'pending',
    reason text,
    requested_by_ai boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts(id) ON DELETE CASCADE,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    description text,
    due_date timestamptz,
    status public.ticket_status NOT NULL DEFAULT 'open',
    priority public.ticket_priority NOT NULL DEFAULT 'medium',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 6. WHATSAPP TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
    phone_number_id text NOT NULL UNIQUE,
    business_account_id text NOT NULL,
    encrypted_access_token text NOT NULL,
    webhook_verified boolean DEFAULT false,
    status text DEFAULT 'disconnected',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    language text NOT NULL DEFAULT 'en_US',
    category text NOT NULL,
    components jsonb NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    rejected_reason text,
    wa_template_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name, language)
);

CREATE TABLE IF NOT EXISTS public.outbound_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    idempotency_key text NOT NULL UNIQUE,
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
    phone_number text NOT NULL,
    content text,
    message_type text NOT NULL,
    status public.outbound_status NOT NULL DEFAULT 'queued',
    attempts integer DEFAULT 0,
    wa_message_id text UNIQUE,
    last_error text,
    queued_at timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    external_event_id text NOT NULL,
    status public.webhook_status NOT NULL DEFAULT 'pending',
    payload jsonb NOT NULL DEFAULT '{}',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_latency_log (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_type text NOT NULL,
    processing_time_ms integer NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 7. AI & AUTOMATION TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_agents (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    model public.ai_provider DEFAULT 'gemini',
    instructions text NOT NULL,
    temperature numeric DEFAULT 0.7,
    is_active boolean DEFAULT true,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chatbot_flows (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    trigger_type text NOT NULL CHECK (trigger_type IN ('keyword', 'catch_all', 'api', 'manual')),
    trigger_keyword text,
    definition jsonb NOT NULL DEFAULT '[]',
    is_active boolean DEFAULT true,
    priority integer DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE UNIQUE,
    current_flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE SET NULL,
    current_step_index integer DEFAULT 0,
    stage text DEFAULT 'new',
    score integer DEFAULT 0,
    source text,
    assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NOT NULL,
    source_type public.knowledge_source_type NOT NULL DEFAULT 'text',
    source_url text,
    embedding vector(1536),
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider public.ai_provider NOT NULL,
    model text NOT NULL,
    prompt_tokens integer NOT NULL DEFAULT 0,
    completion_tokens integer NOT NULL DEFAULT 0,
    total_tokens integer NOT NULL DEFAULT 0,
    estimated_cost_usd numeric(10,6) DEFAULT 0.0,
    request_type text NOT NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 8. CAMPAIGNS TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    template_id uuid NOT NULL REFERENCES public.whatsapp_templates(id) ON DELETE RESTRICT,
    audience_filter jsonb NOT NULL DEFAULT '{}',
    status public.campaign_status NOT NULL DEFAULT 'draft',
    scheduled_at timestamptz,
    completed_at timestamptz,
    total_recipients integer DEFAULT 0,
    successful_sends integer DEFAULT 0,
    failed_sends integer DEFAULT 0,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    status public.outbound_status NOT NULL DEFAULT 'queued',
    error_message text,
    wa_message_id text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 9. QUEUE / SYSTEM TABLES
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    action public.audit_action_type NOT NULL,
    resource text NOT NULL,
    resource_id text,
    changes jsonb NOT NULL DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dead_letter_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_queue text NOT NULL,
    payload jsonb NOT NULL,
    error_message text,
    error_stack text,
    retry_count integer DEFAULT 0,
    failed_at timestamptz NOT NULL DEFAULT now(),
    replayed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.queue_metrics_snapshots (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_name text NOT NULL,
    active_jobs integer DEFAULT 0,
    waiting_jobs integer DEFAULT 0,
    failed_jobs integer DEFAULT 0,
    delayed_jobs integer DEFAULT 0,
    throughput numeric(10,2) DEFAULT 0.0,
    snapshot_time timestamptz NOT NULL DEFAULT now()
);

-- ==============================================================================
-- 10. INDEXES (Performance)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created ON public.messages (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id ON public.messages (wa_message_id) WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_status ON public.messages (delivery_status);
CREATE INDEX IF NOT EXISTS idx_messages_content_gin ON public.messages USING GIN(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_messages_created_brin ON public.messages USING brin(created_at);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_status ON public.conversations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_message ON public.conversations (tenant_id, last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON public.conversations (assigned_to);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_phone ON public.contacts (tenant_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_name ON public.contacts USING GIN(to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_outbound_idempotency ON public.outbound_messages (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_outbound_status ON public.outbound_messages (status);
CREATE INDEX IF NOT EXISTS idx_outbound_tenant_queued ON public.outbound_messages (tenant_id, queued_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_created ON public.webhook_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_external_id ON public.webhook_events (external_event_id);

CREATE INDEX IF NOT EXISTS idx_leads_tenant_stage ON public.leads (tenant_id, stage);

CREATE INDEX IF NOT EXISTS idx_kb_embedding_hnsw ON public.knowledge_base USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_kb_tenant ON public.knowledge_base (tenant_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);

-- ==============================================================================
-- 11. TRIGGERS
-- ==============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = tables.table_name AND column_name = 'updated_at')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trg_update_%I_updated_at ON public.%I;
            CREATE TRIGGER trg_update_%I_updated_at
            BEFORE UPDATE ON public.%I
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_unread_and_touch()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.sender_type = 'user' THEN
        UPDATE public.conversations
        SET 
            unread_count = unread_count + 1,
            last_message_at = NEW.created_at,
            updated_at = now()
        WHERE id = NEW.conversation_id;
    ELSE
        UPDATE public.conversations
        SET 
            last_message_at = NEW.created_at,
            updated_at = now()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_on_new_message ON public.messages;
CREATE TRIGGER trg_on_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.increment_unread_and_touch();

-- ==============================================================================
-- 12. RLS POLICIES (Strict Tenant Isolation)
-- ==============================================================================

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END;
$$;

CREATE POLICY "Tenants Isolation" ON public.tenants
FOR ALL USING (id = public.get_auth_tenant_id());

CREATE POLICY "Profiles self access" ON public.profiles
FOR ALL USING (id = auth.uid());

CREATE POLICY "Tenant Members Isolation" ON public.tenant_members
FOR ALL USING (tenant_id = public.get_auth_tenant_id());

DO $$
DECLARE
    t text;
    tables_with_tenant_id text[] := ARRAY[
        'api_keys', 'billing_subscriptions', 'contacts', 'conversations', 'messages',
        'leads', 'tags', 'contact_tags', 'notes', 'handoff_requests', 'tasks',
        'whatsapp_accounts', 'whatsapp_templates', 'outbound_messages', 'webhook_events',
        'webhook_latency_log', 'ai_agents', 'chatbot_flows', 'knowledge_base', 'usage_logs',
        'campaigns', 'campaign_logs', 'audit_logs', 'dead_letter_queue'
    ];
BEGIN
    FOREACH t IN ARRAY tables_with_tenant_id
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS "%I_tenant_isolation" ON public.%I;
            CREATE POLICY "%I_tenant_isolation" ON public.%I
            FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR public.auth_is_tenant_member(tenant_id));
        ', t, t, t, t);
    END LOOP;
END;
$$;

-- ==============================================================================
-- 13. MATERIALIZED VIEWS & ANALYTICS
-- ==============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_daily_message_volume AS
SELECT 
    tenant_id,
    date_trunc('day', created_at) AS day,
    sender_type,
    count(*) AS message_count
FROM public.messages
GROUP BY tenant_id, date_trunc('day', created_at), sender_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dmv_tenant_day_sender ON public.mv_daily_message_volume (tenant_id, day, sender_type);

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_tenant_conversation_stats AS
SELECT 
    tenant_id,
    status,
    mode,
    count(*) AS conversation_count,
    avg(unread_count) as avg_unread
FROM public.conversations
GROUP BY tenant_id, status, mode;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tcs_tenant_status_mode ON public.mv_tenant_conversation_stats (tenant_id, status, mode);

CREATE OR REPLACE FUNCTION public.refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_daily_message_volume;
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_tenant_conversation_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 14. CRON JOBS
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('refresh_analytics_every_5_mins', '*/5 * * * *', 'SELECT public.refresh_analytics_views()');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;

-- ==============================================================================
-- FINAL VALIDATION QUERIES (Run these manually to verify)
-- ==============================================================================
-- SELECT table_name, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- SELECT * FROM pg_indexes WHERE schemaname = 'public';
