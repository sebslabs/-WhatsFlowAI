-- ====================================================================
-- MIGRATION: Add Tenant Identity Fields & Update Auto-Provisioning
-- Date: 2026-05-12
-- ====================================================================

-- 1. Add Columns to 'tenants' table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'industry_ecosystem') THEN
    ALTER TABLE tenants ADD COLUMN industry_ecosystem text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'support_email') THEN
    ALTER TABLE tenants ADD COLUMN support_email text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'whatsapp_number') THEN
    ALTER TABLE tenants ADD COLUMN whatsapp_number text;
  END IF;
END $$;

-- 2. Add Columns to 'organizations' table (for backward compatibility)
DO $$ 
BEGIN 
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'industry_ecosystem') THEN
      ALTER TABLE organizations ADD COLUMN industry_ecosystem text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'support_email') THEN
      ALTER TABLE organizations ADD COLUMN support_email text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'whatsapp_number') THEN
      ALTER TABLE organizations ADD COLUMN whatsapp_number text;
    END IF;
  END IF;
END $$;

-- 3. Refresh the Provisioning Function to capture metadata
CREATE OR REPLACE FUNCTION public.create_default_tenant_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
  admin_role_id uuid;
  member_role_id uuid;
  default_plan_id uuid;
  tenant_slug text;
BEGIN
  -- Build a safe, unique slug from the organization name or signup credentials
  tenant_slug := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'organization_name', 'org-' || substring(new.id::text, 1, 8)),
    '[^a-z0-9]', '-', 'g'
  ));

  -- 1. Insert Core Tenant with expanded metadata
  INSERT INTO tenants (name, slug, industry_ecosystem, support_email, whatsapp_number)
  VALUES (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Organization'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
  )
  RETURNING id INTO new_tenant_id;

  -- 2. Insert Compatibility Organization
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations') THEN
    INSERT INTO organizations (id, name, slug, industry_ecosystem, support_email, whatsapp_number)
    VALUES (
      new_tenant_id,
      coalesce(new.raw_user_meta_data->>'organization_name', 'My Organization'),
      tenant_slug,
      new.raw_user_meta_data->>'industry_ecosystem',
      new.raw_user_meta_data->>'support_email',
      new.raw_user_meta_data->>'whatsapp_number'
    );
  END IF;

  -- 3. Insert User Profile
  INSERT INTO profiles (id, email, full_name, avatar_url, organization_id, role)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new_tenant_id,
    'admin'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4. Create Standard Tenant Roles
  INSERT INTO roles (tenant_id, name, description)
  VALUES (new_tenant_id, 'admin', 'Tenant Administrator with global credentials')
  RETURNING id INTO admin_role_id;

  INSERT INTO roles (tenant_id, name, description)
  VALUES (new_tenant_id, 'member', 'Standard team agent with operational access')
  RETURNING id INTO member_role_id;

  -- 5. Set Admin Permissions
  INSERT INTO permissions (tenant_id, role_id, action) VALUES
    (new_tenant_id, admin_role_id, 'leads:read'),
    (new_tenant_id, admin_role_id, 'leads:write'),
    (new_tenant_id, admin_role_id, 'conversations:read'),
    (new_tenant_id, admin_role_id, 'conversations:write'),
    (new_tenant_id, admin_role_id, 'billing:manage'),
    (new_tenant_id, admin_role_id, 'settings:write');

  -- 6. Add User to Tenant Members with Admin designation
  INSERT INTO tenant_members (tenant_id, user_id, role_id, role_name)
  VALUES (new_tenant_id, new.id, admin_role_id, 'admin');

  -- 7. Add Default Tenant Configuration Settings (Optional safely handles absent tables)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integrations') THEN
    INSERT INTO integrations (tenant_id, provider, credentials, is_active)
    VALUES (new_tenant_id, 'openai', '{"model": "gpt-4o"}'::jsonb, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 8. Spin up first Active AI Support Agent
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_agents') THEN
    INSERT INTO ai_agents (tenant_id, name, model, instructions, tone, is_active)
    VALUES (
      new_tenant_id,
      'WhatsFlow Support Agent',
      'gpt-4o',
      'You are a friendly, expert assistant helping users resolve general issues.',
      'professional',
      true
    );
  END IF;

  -- 9. Connect Subscription Billing Plan
  SELECT id INTO default_plan_id FROM plans WHERE slug = 'free' LIMIT 1;
  IF default_plan_id IS NULL THEN
    INSERT INTO plans (name, slug, price_monthly, max_leads, max_ai_calls, max_team_members, features)
    VALUES ('Free Plan', 'free', 0.00, 500, 1000, 5, '["chat", "ai_replies"]')
    RETURNING id INTO default_plan_id;
  END IF;

  INSERT INTO subscriptions (tenant_id, plan_id, status)
  VALUES (new_tenant_id, default_plan_id, 'active');

  RETURN new;
END;
$$;
