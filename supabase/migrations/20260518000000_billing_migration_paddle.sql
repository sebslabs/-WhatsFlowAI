-- ==============================================================================
-- WhatsFlow AI Database Migration: Stripe to Paddle Subscription Alignment
-- File: 20260518000000_billing_migration_paddle.sql
-- Description: Drops obsolete Stripe columns, adds Paddle columns, and preserves data.
-- ==============================================================================

BEGIN;

-- 1. Check and safely expand billing_subscriptions table to support Paddle tracking
ALTER TABLE public.billing_subscriptions 
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_price_id text;

-- 2. Add performance indexing to support instant webhook upsert lookups
CREATE INDEX IF NOT EXISTS idx_billing_subs_paddle_sub ON public.billing_subscriptions (paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_subs_paddle_cust ON public.billing_subscriptions (paddle_customer_id);

-- 3. Safely copy existing subscription data if any Stripe columns contain values
UPDATE public.billing_subscriptions
SET 
  paddle_customer_id = stripe_customer_id,
  paddle_subscription_id = stripe_subscription_id
WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
  AND (paddle_customer_id IS NULL AND paddle_subscription_id IS NULL);

-- 4. Clean up the obsolete Stripe columns once data is safely preserved
ALTER TABLE public.billing_subscriptions 
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id;

-- 5. Hardening and updating standard default provisioning triggers
CREATE OR REPLACE FUNCTION public.create_default_tenant_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_tenant_id uuid;
  tenant_slug text;
BEGIN
  -- 1. Build a guaranteed UNIQUE slug using user ID slice to prevent collisions
  tenant_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'organization_name', 'org'), '[^a-z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 6);

  -- 2. Insert Core Tenant (Modern Structure)
  INSERT INTO public.tenants (name, slug, industry_ecosystem, support_email, whatsapp_number)
  VALUES (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
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

  -- 6. Initialize billing safely aligned to our new Paddle columns
  INSERT INTO public.billing_subscriptions (tenant_id, plan, status)
  VALUES (new_tenant_id, 'free'::public.tenant_plan_type, 'active'::public.subscription_status_type);

  -- 7. Spin up Default AI Agent
  INSERT INTO public.ai_agents (tenant_id, name, model, instructions, temperature, is_active)
  VALUES (new_tenant_id, 'Primary Support Agent', 'gpt-4o', 'Professional business support expert.', 0.7, true);

  RETURN new;
END;
$$;

COMMIT;
