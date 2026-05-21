-- ==============================================================================
-- WhatsFlow AI Database Migration: SaaS Subscriptions and AI Usage Management
-- File: 20260519000000_billing_system_subscription_usage.sql
-- Description: Adds subscription fields, enums, limits, payment history tracking, and updates triggers.
-- ==============================================================================

BEGIN;

-- 1. Create type if needed, but we will store as TEXT or domain constraint for maximum robust Paddle mapping
-- Add new columns to public.billing_subscriptions
ALTER TABLE public.billing_subscriptions 
  ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz DEFAULT (now() + interval '7 days'),
  ADD COLUMN IF NOT EXISTS subscription_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS grace_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS ai_conversation_limit integer DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS ai_conversation_used integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

-- Ensure indexing for billing performance
CREATE INDEX IF NOT EXISTS idx_billing_subs_status ON public.billing_subscriptions (subscription_status);
CREATE INDEX IF NOT EXISTS idx_billing_subs_plan ON public.billing_subscriptions (plan_type);

-- 2. Create payment_history table
CREATE TABLE IF NOT EXISTS public.payment_history (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    amount numeric(10,2) NOT NULL,
    currency text NOT NULL DEFAULT 'USD',
    payment_status text NOT NULL,
    payment_method text,
    transaction_id text,
    billing_period_start timestamptz,
    billing_period_end timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on payment_history
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Set up RLS policy for payment_history
DROP POLICY IF EXISTS payment_history_tenant_isolation ON public.payment_history;
CREATE POLICY "payment_history_tenant_isolation" ON public.payment_history
  FOR ALL USING (tenant_id = public.get_auth_tenant_id() OR public.auth_is_tenant_member(tenant_id));

-- 3. Hardening and updating standard default provisioning triggers to automatically initialize a 7-day free trial
CREATE OR REPLACE FUNCTION public.create_default_tenant_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_tenant_id uuid;
  tenant_slug text;
BEGIN
  -- 1. Build a guaranteed UNIQUE slug using user ID slice to prevent collisions
  tenant_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'organization_name', 'org'), '[^a-z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 6);

  -- 2. Insert Core Tenant (Modern Structure)
  INSERT INTO public.tenants (name, slug, industry_ecosystem, support_email, whatsapp_number, plan)
  VALUES (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number',
    'free'::public.tenant_plan
  )
  RETURNING id INTO new_tenant_id;

  -- 3. Insert Bridge Organization (Backward Compatibility needed by Next.js API)
  INSERT INTO public.organizations (tenant_id, name, slug)
  VALUES (new_tenant_id, coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'), tenant_slug);

  -- 4. Insert into Profiles (Crucial: maps organization_id so frontend works!)
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

  -- 5. Finalize RBAC Mapping
  INSERT INTO public.tenant_members (tenant_id, user_id, role)
  VALUES (new_tenant_id, new.id, 'admin')
  ON CONFLICT DO NOTHING;

  -- 6. Initialize billing aligned with our SaaS Subscriptions trial logic
  -- Every new user automatically gets a 7-day free trial. No credit card is required.
  INSERT INTO public.billing_subscriptions (
    tenant_id, 
    plan_type, 
    subscription_status, 
    trial_start_date, 
    trial_end_date, 
    ai_conversation_limit, 
    ai_conversation_used, 
    payment_status
  )
  VALUES (
    new_tenant_id, 
    'free', 
    'trial', 
    now(), 
    now() + interval '7 days', 
    1500, 
    0, 
    'unpaid'
  );

  -- 7. Spin up Default AI Agent
  INSERT INTO public.ai_agents (tenant_id, name, model, instructions, temperature, is_active)
  VALUES (new_tenant_id, 'Primary Support Agent', 'gpt-4o', 'Professional business support expert.', 0.7, true);

  RETURN new;
END;
$$;

COMMIT;
