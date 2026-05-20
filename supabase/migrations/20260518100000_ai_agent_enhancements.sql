-- Migration: AI Agent Enhancements (20260518100000)
-- Adds conversation_contexts, ai_settings, sentiment tracking, threading

-- 1. Conversation contexts (AI memory per conversation)
CREATE TABLE IF NOT EXISTS public.conversation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL,
    history JSONB NOT NULL DEFAULT '[]',
    summary TEXT,
    sentiment TEXT DEFAULT 'neutral',
    sentiment_score NUMERIC(4,3) DEFAULT 0,
    escalated BOOLEAN NOT NULL DEFAULT FALSE,
    escalated_at TIMESTAMPTZ,
    escalated_reason TEXT,
    topic_tags TEXT[] DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, conversation_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_contexts_tenant_conv
    ON public.conversation_contexts(tenant_id, conversation_id);

ALTER TABLE public.conversation_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_conv_contexts" ON public.conversation_contexts
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

-- 2. AI settings per tenant
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    tone TEXT NOT NULL DEFAULT 'professional',
    language TEXT NOT NULL DEFAULT 'en',
    max_response_length INT NOT NULL DEFAULT 500,
    monthly_spend_cap_usd NUMERIC(10,2) DEFAULT NULL,
    monthly_spend_used_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    spend_cap_reset_at TIMESTAMPTZ,
    auto_response_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sentiment_detection_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    suggested_replies_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    conversation_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rag_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    typing_indicator_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    escalation_keywords JSONB NOT NULL DEFAULT '["human","agent","support","complaint","refund","cancel"]',
    preferred_model TEXT NOT NULL DEFAULT 'mistral-large-latest',
    requests_today INT NOT NULL DEFAULT 0,
    requests_month INT NOT NULL DEFAULT 0,
    tokens_month INT NOT NULL DEFAULT 0,
    success_rate NUMERIC(5,2) DEFAULT 100.0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id)
);

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_iso_ai_settings" ON public.ai_settings
    USING (tenant_id IN (
        SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid()
    ));

-- 3. QR sessions: device fingerprinting columns
ALTER TABLE public.whatsapp_qr_sessions
    ADD COLUMN IF NOT EXISTS device_name TEXT,
    ADD COLUMN IF NOT EXISTS device_ip TEXT,
    ADD COLUMN IF NOT EXISTS reconnect_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS health_check_at TIMESTAMPTZ;

-- 4. Messages: AI metadata + message threading
ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS ai_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_provider TEXT,
    ADD COLUMN IF NOT EXISTS ai_latency_ms INT,
    ADD COLUMN IF NOT EXISTS sentiment TEXT,
    ADD COLUMN IF NOT EXISTS suggested_replies JSONB;

CREATE INDEX IF NOT EXISTS idx_messages_parent
    ON public.messages(parent_message_id)
    WHERE parent_message_id IS NOT NULL;

-- 5. Auto-provision ai_settings for all existing tenants
INSERT INTO public.ai_settings (tenant_id)
SELECT id FROM public.tenants
WHERE id NOT IN (SELECT tenant_id FROM public.ai_settings)
ON CONFLICT DO NOTHING;
