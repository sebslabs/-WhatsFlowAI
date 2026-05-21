-- ============================================================
-- MIGRATION: Autoprovision Workspace Settings
-- Version: 1.0
-- Description: Extends the default user provisioning trigger to 
--              automatically populate the public.settings JSONB config.
-- Safe to re-run (idempotent replacement)
-- ============================================================

BEGIN;

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

  -- 5. Billing
  INSERT INTO public.billing_subscriptions (tenant_id, plan, status)
  VALUES (new_tenant_id, 'free'::public.tenant_plan_type, 'active'::public.subscription_status_type)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 6. Default AI Agent
  INSERT INTO public.ai_agents (tenant_id, name, model, instructions, temperature, is_active)
  VALUES (
    new_tenant_id,
    'Primary Support Agent',
    'mistral',
    'You are a professional, helpful support assistant. Keep replies concise and friendly.',
    0.7,
    true
  );

  -- 7. Default Workspace Settings Config (Inject registration values directly!)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settings') THEN
    INSERT INTO public.settings (tenant_id, config, updated_at)
    VALUES (
      new_tenant_id,
      jsonb_build_object(
        'business_name', coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
        'industry', coalesce(new.raw_user_meta_data->>'industry_ecosystem', 'ecommerce'),
        'whatsapp_number', coalesce(new.raw_user_meta_data->>'whatsapp_number', ''),
        'support_email', coalesce(new.raw_user_meta_data->>'support_email', ''),
        'full_name', coalesce(new.raw_user_meta_data->>'full_name', ''),
        'personal_email', new.email
      ),
      now()
    )
    ON CONFLICT (tenant_id) DO UPDATE 
    SET config = jsonb_build_object(
      'business_name', coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
      'industry', coalesce(new.raw_user_meta_data->>'industry_ecosystem', 'ecommerce'),
      'whatsapp_number', coalesce(new.raw_user_meta_data->>'whatsapp_number', ''),
      'support_email', coalesce(new.raw_user_meta_data->>'support_email', ''),
      'full_name', coalesce(new.raw_user_meta_data->>'full_name', ''),
      'personal_email', new.email
    );
  END IF;

  RETURN new;
END;
$$;

COMMIT;
