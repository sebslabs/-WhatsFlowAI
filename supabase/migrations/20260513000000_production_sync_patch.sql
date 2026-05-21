-- ============================================================
-- MIGRATION: Production Schema Sync Patch
-- Version: 3.0
-- Purpose: Resolves all backend ↔ DB mismatches found in QA audit
-- Safe to re-run (uses IF NOT EXISTS / DO $$ guards)
-- ============================================================

-- ── 1. Flow State Tracking on Leads ─────────────────────────────────────────
-- Adds current_flow_id and current_step_index to leads for flow engine state.
-- Backend (webhook.worker.ts + flow.service.ts) requires these.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'current_flow_id'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN current_flow_id uuid REFERENCES public.chatbot_flows(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.leads.current_flow_id IS
      'Active flow the contact is currently executing. NULL = no active flow.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'current_step_index'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN current_step_index integer NOT NULL DEFAULT 0;
    COMMENT ON COLUMN public.leads.current_step_index IS
      'Zero-based index of the last completed step in current_flow_id.';
  END IF;
END $$;

-- ── 2. UUID Defaults on Tables Missing Them ──────────────────────────────────

DO $$
BEGIN
  -- chatbot_flows.id should always default to gen_random_uuid()
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chatbot_flows'
      AND column_name = 'id' AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.chatbot_flows ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;

  -- organizations.id should default to gen_random_uuid()
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'organizations'
  ) THEN
    ALTER TABLE public.organizations ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- ── 3. Chatbot Flows — Add definition column if using older 'steps' name ─────

DO $$
BEGIN
  -- If schema has 'steps' column instead of 'definition', rename it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chatbot_flows' AND column_name = 'steps'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chatbot_flows' AND column_name = 'definition'
  ) THEN
    ALTER TABLE public.chatbot_flows RENAME COLUMN steps TO definition;
  END IF;

  -- Add definition column if it doesn't exist at all
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chatbot_flows' AND column_name = 'definition'
  ) THEN
    ALTER TABLE public.chatbot_flows ADD COLUMN definition jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

-- ── 4. Fix Billing: Remove references to non-existent 'plans'/'subscriptions' ─
-- The autoprovisioning trigger referenced plans+subscriptions which don't exist.
-- Replaced with billing_subscriptions using correct enum types.

CREATE OR REPLACE FUNCTION public.create_default_tenant_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  tenant_slug   text;
BEGIN
  -- Build a collision-safe slug
  tenant_slug := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'organization_name', 'org'),
    '[^a-z0-9]', '-', 'g'
  )) || '-' || substring(new.id::text, 1, 6);

  -- 1. Insert tenant
  INSERT INTO public.tenants (name, slug, industry_ecosystem, support_email, whatsapp_number)
  VALUES (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
  )
  RETURNING id INTO new_tenant_id;

  -- 2. Bridge organization for legacy frontend references (backward compat)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') THEN
    INSERT INTO public.organizations (id, tenant_id, name, slug)
    VALUES (
      new_tenant_id,
      new_tenant_id,
      coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
      tenant_slug
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- 3. Profile (organization_id = tenant_id for backward compat)
  INSERT INTO public.profiles (id, email, full_name, avatar_url, organization_id, role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new_tenant_id,
    'admin'
  )
  ON CONFLICT (id) DO UPDATE SET organization_id = new_tenant_id, role = 'admin';

  -- 4. Tenant RBAC
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, new.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- 5. Billing — FIXED: uses billing_subscriptions + correct enum types
  --    (previously referenced non-existent 'plans' and 'subscriptions' tables)
  INSERT INTO public.billing_subscriptions (tenant_id, plan, status)
  VALUES (new_tenant_id, 'free'::public.tenant_plan_type, 'active'::public.subscription_status_type)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 6. Default AI Agent — FIXED: uses is_active (boolean), removes non-existent 'tone' column
  INSERT INTO public.ai_agents (tenant_id, name, model, instructions, temperature, is_active)
  VALUES (
    new_tenant_id,
    'Primary Support Agent',
    'gemini-1.5-flash',
    'You are a professional, helpful support assistant. Keep replies concise and friendly.',
    0.7,
    true
  );

  RETURN new;
END;
$$;

-- Reattach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_tenant_for_new_user();

-- ── 5. Production Indexes ────────────────────────────────────────────────────

-- Messages: inbox fetch (conversation + time)
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
  ON public.messages (conversation_id, created_at DESC);

-- Messages: tenant-level analytics
CREATE INDEX IF NOT EXISTS idx_messages_tenant_created
  ON public.messages (tenant_id, created_at DESC);

-- Leads: worker phone lookup (not covered by contacts unique constraint)
CREATE INDEX IF NOT EXISTS idx_leads_tenant_contact
  ON public.leads (tenant_id, contact_id);

-- Leads: flow state queries
CREATE INDEX IF NOT EXISTS idx_leads_current_flow
  ON public.leads (tenant_id, current_flow_id)
  WHERE current_flow_id IS NOT NULL;

-- Conversations: inbox ordering
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_last_msg
  ON public.conversations (tenant_id, last_message_at DESC);

-- Webhook events: deduplication lookup
CREATE INDEX IF NOT EXISTS idx_webhook_events_ext_id
  ON public.webhook_events (external_event_id);

-- Campaign logs: performance reporting
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_created
  ON public.campaign_logs (campaign_id, sent_at DESC);

-- AI Agents: active agent lookup (partial index for speed)
CREATE INDEX IF NOT EXISTS idx_ai_agents_active
  ON public.ai_agents (tenant_id, is_active)
  WHERE is_active = true;

-- WhatsApp Accounts: tenant resolution by phone_number_id
CREATE INDEX IF NOT EXISTS idx_wa_accounts_phone_number_id
  ON public.whatsapp_accounts (phone_number_id, status);

-- Tenant members: user lookup
CREATE INDEX IF NOT EXISTS idx_tenant_members_user
  ON public.tenant_members (user_id, tenant_id);

-- ── 6. RLS for New / Previously Unprotected Tables ───────────────────────────

-- webhook_events (tenant-isolated)
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Webhook events isolation" ON public.webhook_events;

-- handoff_requests
ALTER TABLE public.handoff_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Handoff requests isolation" ON public.handoff_requests;
CREATE POLICY "Handoff requests isolation" ON public.handoff_requests
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

-- tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tasks isolation" ON public.tasks;
CREATE POLICY "Tasks isolation" ON public.tasks
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

-- chatbot_flows (re-enable with tenant_id — previously used organization_id)
ALTER TABLE public.chatbot_flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chatbot flows isolation" ON public.chatbot_flows;
CREATE POLICY "Chatbot flows isolation" ON public.chatbot_flows
  FOR ALL USING (public.auth_is_tenant_member(tenant_id));

-- campaign_logs (accessible through campaigns + tenant check)
ALTER TABLE public.campaign_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaign logs isolation" ON public.campaign_logs;
CREATE POLICY "Campaign logs isolation" ON public.campaign_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_logs.campaign_id
        AND public.auth_is_tenant_member(c.tenant_id)
    )
  );

-- ── 7. Updated_at Triggers for Missing Tables ────────────────────────────────

DROP TRIGGER IF EXISTS trg_chatbot_flows_upd ON public.chatbot_flows;
CREATE TRIGGER trg_chatbot_flows_upd
  BEFORE UPDATE ON public.chatbot_flows
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_accounts_upd ON public.whatsapp_accounts;
CREATE TRIGGER trg_whatsapp_accounts_upd
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_whatsapp_templates_upd ON public.whatsapp_templates;
CREATE TRIGGER trg_whatsapp_templates_upd
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ── 8. Webhook Idempotency: tenant_id on webhook_events ──────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.webhook_events ADD COLUMN tenant_id uuid;
    CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant
      ON public.webhook_events (tenant_id, created_at DESC);
  END IF;
END $$;

-- ── 9. PG Incremental Unread Counter RPC (used by ConversationRepository) ────

CREATE OR REPLACE FUNCTION public.increment_unread_and_touch(p_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET
    last_message_at = now(),
    unread_count = unread_count + 1
  WHERE id = p_conversation_id;
END;
$$;

-- ============================================================
-- END MIGRATION 3.0
-- ============================================================
