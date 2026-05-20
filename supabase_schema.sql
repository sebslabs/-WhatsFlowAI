-- ============================================================
-- WhatsFlow AI — Complete Production Database Schema
-- ============================================================
-- Designed for: Supabase PostgreSQL (Multi-Tenant, SaaS Scale)
-- Security Strategy: Row Level Security (RLS) with Defense-in-Depth
-- Compatibility: Supports both tenant_id & organization_id
-- ============================================================

-- ------------------------------------------------------------
-- 0. Enable Extensions
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";    -- For fuzzy search on contacts/leads
create extension if not exists "vector";     -- For AI RAG Embeddings (1536-dim)

-- ------------------------------------------------------------
-- 1. Core Tenant Tables
-- ------------------------------------------------------------

-- Table: tenants
create table if not exists tenants (
  id             uuid primary key default gen_random_uuid(),
  name               text not null,
  slug               text unique not null,
  industry_ecosystem text,
  support_email      text,
  whatsapp_number    text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Table: organizations (maintained for backward compatibility with older services)
create table if not exists organizations (
  id             uuid primary key references tenants(id) on delete cascade,
  name               text not null,
  slug               text unique not null,
  industry_ecosystem text,
  support_email      text,
  whatsapp_number    text,
  plan               text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  max_leads      int  not null default 500,
  max_ai_calls   int  not null default 1000,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Table: profiles (maps to Supabase auth.users)
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  organization_id uuid references organizations(id) on delete set null, -- Compatibility link
  role            text not null default 'member' check (role in ('admin', 'member', 'user')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Table: plans (global billing tiers)
create table if not exists plans (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text unique not null,
  price_monthly    numeric(12,2) not null check (price_monthly >= 0),
  max_leads        int not null default 500,
  max_ai_calls     int not null default 1000,
  max_team_members int not null default 5,
  features         jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Table: subscriptions (tenant subscription states)
create table if not exists subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null unique references tenants(id) on delete cascade,
  plan_id                uuid references plans(id) on delete set null,
  stripe_subscription_id text unique,
  stripe_customer_id     text,
  status                 text not null default 'inactive' check (status in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'inactive')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. RBAC Tables
-- ------------------------------------------------------------

-- Table: roles
create table if not exists roles (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  name            text not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, name)
);

-- Table: permissions
create table if not exists permissions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  role_id         uuid not null references roles(id) on delete cascade,
  action          text not null, -- e.g., 'leads:read', 'billing:manage'
  created_at      timestamptz not null default now(),
  unique (role_id, action)
);

-- Table: tenant_members (mapping users to tenants & roles)
create table if not exists tenant_members (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role_id         uuid references roles(id) on delete set null,
  role_name       text not null default 'member', -- cached for fast reads
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ------------------------------------------------------------
-- 3. WhatsApp Integration
-- ------------------------------------------------------------

-- Table: whatsapp_accounts
create table if not exists whatsapp_accounts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  phone_number_id     text unique not null, -- Meta Phone Number ID
  waba_id             text,                 -- WhatsApp Business Account ID
  verify_token        text,                 -- Meta Webhook verification token
  access_token        text,                 -- Meta System User Access Token (Encrypted)
  status              text not null default 'disconnected' check (status in ('connected', 'disconnected', 'pending')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: whatsapp_integrations
create table if not exists whatsapp_integrations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  user_id             uuid not null references profiles(id) on delete cascade,
  phone_number_id     text,
  business_account_id text,
  access_token        text, -- Encrypted in logic layer
  webhook_verify_token text,
  integration_code    text not null check (integration_code ~ '^\d{4}$'), -- 4-digit numeric
  status              text not null default 'inactive' check (status in ('active', 'inactive')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (integration_code)
);

-- ------------------------------------------------------------
-- 4. CRM Tables
-- ------------------------------------------------------------

-- Table: contacts
create table if not exists contacts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null default 'New Contact',
  phone               text not null,
  email               text,
  avatar_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, phone)
);

-- Table: leads
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null unique references contacts(id) on delete cascade,
  stage               text not null default 'New' check (stage in ('New','Contacted','Qualifying','Qualified','Proposal','Booked','Lost')),
  urgency             text check (urgency in ('Today','This Week','Next Week','This Month','Flexible')),
  service_interested  text,
  lead_value          numeric(12,2) not null default 0.00 check (lead_value >= 0),
  assigned_user_id    uuid references profiles(id) on delete set null,
  status              text not null default 'active' check (status in ('active', 'archived', 'blocked')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: tags
create table if not exists tags (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  color               text default '#10B981',
  created_at          timestamptz not null default now(),
  unique (tenant_id, name)
);

-- Table: contact_tags
create table if not exists contact_tags (
  contact_id          uuid not null references contacts(id) on delete cascade,
  tag_id              uuid not null references tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- Table: notes (internal lead CRM notes)
create table if not exists notes (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  author_id           uuid references profiles(id) on delete set null,
  content             text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: tasks
create table if not exists tasks (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  assignee_id         uuid references profiles(id) on delete set null,
  title               text not null,
  description         text,
  due_at              timestamptz,
  status              text not null default 'pending' check (status in ('pending', 'completed', 'overdue')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. Chat & Conversations
-- ------------------------------------------------------------

-- Table: conversations
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  status              text not null default 'open' check (status in ('open', 'snoozed', 'closed')),
  mode                text not null default 'ai' check (mode in ('ai', 'manual', 'flow')),
  unread_count        int not null default 0 check (unread_count >= 0),
  last_message_at     timestamptz default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, contact_id)
);

-- Table: messages
create table if not exists messages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  conversation_id     uuid not null references conversations(id) on delete cascade,
  sender_id           uuid references profiles(id) on delete set null,
  sender_type         text not null check (sender_type in ('contact', 'user', 'ai', 'system')),
  content             text not null,
  message_type        text not null default 'text' check (message_type in ('text', 'image', 'video', 'document', 'audio', 'location', 'template')),
  media_url           text,
  whatsapp_message_id text unique,
  delivery_status     text not null default 'sent' check (delivery_status in ('sent', 'delivered', 'read', 'failed')),
  error_message       text,
  created_at          timestamptz not null default now()
);

-- Table: handoff_requests (human support takeover)
create table if not exists handoff_requests (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  conversation_id     uuid not null references conversations(id) on delete cascade,
  status              text not null default 'pending' check (status in ('pending', 'assigned', 'resolved')),
  reason              text,
  assigned_to         uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. AI & Automation
-- ------------------------------------------------------------

-- Table: ai_agents
create table if not exists ai_agents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  model               text not null default 'gpt-4o',
  instructions        text not null,
  tone                text not null default 'professional' check (tone in ('professional','friendly','formal','casual','empathetic')),
  temperature         numeric(3,2) default 0.70 check (temperature >= 0 and temperature <= 2),
  max_tokens          int not null default 500,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: chatbot_flows (replaced 'flows' table, includes schema mapping)
create table if not exists chatbot_flows (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  description         text,
  steps               jsonb not null default '[]',
  is_active           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: flows (retained for backward compatibility and visual mapping)
create table if not exists flows (
  id                  uuid primary key references chatbot_flows(id) on delete cascade,
  organization_id     uuid not null references organizations(id) on delete cascade,
  name                text not null,
  active              boolean not null default false,
  trigger_type        text not null check (trigger_type in ('first_message','keyword','tag','manual')),
  trigger_keyword     text,
  steps               jsonb not null default '[]',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: automation_rules
create table if not exists automation_rules (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  trigger_type        text not null check (trigger_type in ('incoming_message', 'lead_stage_changed', 'tag_added', 'human_handoff')),
  conditions          jsonb not null default '{}',
  action_type         text not null check (action_type in ('send_message', 'start_flow', 'assign_user', 'add_tag', 'notify_slack')),
  action_payload      jsonb not null default '{}',
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: knowledge_base (For AI Agent RAG embeddings)
create table if not exists knowledge_base (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  title               text,
  content             text not null,
  source_type         text not null default 'text' check (source_type in ('text','url','pdf','faq')),
  source_url          text,
  metadata            jsonb not null default '{}',
  embedding           vector(1536), -- 1536-dim text-embedding-3-small or text-embedding-ada-002
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. Integrations & Webhooks
-- ------------------------------------------------------------

-- Table: integrations
create table if not exists integrations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  provider            text not null check (provider in ('openai', 'stripe', 'zapier', 'n8n', 'hubspot', 'slack')),
  credentials         jsonb not null default '{}', -- Encrypted credentials or API secrets
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, provider)
);

-- Table: webhook_events (Idempotency ledger & duplicate processing safehouse)
create table if not exists webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  event_id            text unique not null, -- Unique event identifier from Meta (e.g., Sourced from Webhook Request)
  event_type          text not null,        -- e.g. "messages.received"
  payload             jsonb not null,
  status              text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error_message       text,
  processed_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- Table: api_keys (Developer portal access keys)
create table if not exists api_keys (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  key_hash            text unique not null, -- SHA-256 Hash of key
  key_prefix          text not null,        -- e.g., "wf_live_"
  scopes              jsonb not null default '[]',
  expires_at          timestamptz,
  last_used_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. Analytics & Logging
-- ------------------------------------------------------------

-- Table: usage_logs
create table if not exists usage_logs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  resource_type       text not null check (resource_type in ('ai_tokens', 'whatsapp_messages', 'leads_count')),
  quantity            int not null default 1,
  metadata            jsonb not null default '{}', -- Detailed log parameters like prompt/completion tokens
  created_at          timestamptz not null default now()
);

-- Table: audit_logs (Activity compliance logs)
create table if not exists audit_logs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  user_id             uuid references profiles(id) on delete set null,
  action              text not null,       -- e.g., 'lead.deleted', 'billing.updated'
  entity_type         text not null,       -- e.g., 'lead', 'subscription'
  entity_id           uuid,
  old_values          jsonb,
  new_values          jsonb,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz not null default now()
);

-- Table: api_logs
create table if not exists api_logs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid references tenants(id) on delete cascade,
  user_id             uuid references profiles(id) on delete cascade,
  endpoint            text not null,
  method              text not null,
  request_body        jsonb,
  response_body       jsonb,
  status_code         int,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 9. Database Helper Functions
-- ------------------------------------------------------------

-- Helper: Check if user belongs to the tenant (Security Definer to prevent recursive RLS)
create or replace function is_tenant_member(t_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from tenant_members
    where tenant_id = t_id and user_id = auth.uid()
  );
end;
$$;

-- Helper: Check if user has specific tenant role (Security Definer to prevent recursive RLS)
create or replace function has_tenant_role(t_id uuid, req_role text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from tenant_members
    where tenant_id = t_id 
      and user_id = auth.uid() 
      and (role_name = req_role or role_name = 'admin')
  );
end;
$$;

-- Helper: Get current user's primary tenant_id
create or replace function current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from tenant_members where user_id = auth.uid() limit 1;
$$;

-- Helper: Get current user's primary organization_id
create or replace function current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid() limit 1;
$$;

-- Trigger Function: Set updated_at column
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger Function: Provision Tenant & Member on User Auth Signup
create or replace function create_default_tenant_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_tenant_id uuid;
  admin_role_id uuid;
  member_role_id uuid;
  default_plan_id uuid;
  tenant_slug text;
begin
  -- Build a safe, unique slug from the organization name or signup credentials
  tenant_slug := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'organization_name', 'org-' || substring(new.id::text, 1, 8)),
    '[^a-z0-9]', '-', 'g'
  ));

  -- 1. Insert Core Tenant
  insert into tenants (name, slug, industry_ecosystem, support_email, whatsapp_number)
  values (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Organization'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
  )
  returning id into new_tenant_id;

  -- 2. Insert Compatibility Organization
  insert into organizations (id, name, slug, industry_ecosystem, support_email, whatsapp_number)
  values (
    new_tenant_id,
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Organization'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
  );

  -- 3. Insert User Profile
  insert into profiles (id, email, full_name, avatar_url, organization_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new_tenant_id,
    'admin'
  );

  -- 4. Create Standard Tenant Roles
  insert into roles (tenant_id, name, description)
  values (new_tenant_id, 'admin', 'Tenant Administrator with global credentials')
  returning id into admin_role_id;

  insert into roles (tenant_id, name, description)
  values (new_tenant_id, 'member', 'Standard team agent with operational access')
  returning id into member_role_id;

  -- 5. Set Admin Permissions
  insert into permissions (tenant_id, role_id, action) values
    (new_tenant_id, admin_role_id, 'leads:read'),
    (new_tenant_id, admin_role_id, 'leads:write'),
    (new_tenant_id, admin_role_id, 'conversations:read'),
    (new_tenant_id, admin_role_id, 'conversations:write'),
    (new_tenant_id, admin_role_id, 'billing:manage'),
    (new_tenant_id, admin_role_id, 'settings:write');

  -- 6. Add User to Tenant Members with Admin designation
  insert into tenant_members (tenant_id, user_id, role_id, role_name)
  values (new_tenant_id, new.id, admin_role_id, 'admin');

  -- 7. Add Default Tenant Configuration Settings
  insert into integrations (tenant_id, provider, credentials, is_active)
  values (new_tenant_id, 'openai', '{"model": "gpt-4o"}'::jsonb, true);

  -- 8. Spin up first Active AI Support Agent
  insert into ai_agents (tenant_id, name, model, instructions, tone, is_active)
  values (
    new_tenant_id,
    'WhatsFlow Support Agent',
    'gpt-4o',
    'You are a friendly, expert assistant helping users resolve general issues.',
    'professional',
    true
  );

  -- 9. Connect Subscription Billing Plan
  select id into default_plan_id from plans where slug = 'free' limit 1;
  if default_plan_id is null then
    insert into plans (name, slug, price_monthly, max_leads, max_ai_calls, max_team_members, features)
    values ('Free Plan', 'free', 0.00, 500, 1000, 5, '["chat", "ai_replies"]')
    returning id into default_plan_id;
  end if;

  insert into subscriptions (tenant_id, plan_id, status)
  values (new_tenant_id, default_plan_id, 'active');

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 10. Automated Triggers Configuration
-- ------------------------------------------------------------

-- Set updated_at on relevant tables
create trigger set_updated_at_tenants before update on tenants for each row execute function set_updated_at();
create trigger set_updated_at_organizations before update on organizations for each row execute function set_updated_at();
create trigger set_updated_at_profiles before update on profiles for each row execute function set_updated_at();
create trigger set_updated_at_plans before update on plans for each row execute function set_updated_at();
create trigger set_updated_at_subscriptions before update on subscriptions for each row execute function set_updated_at();
create trigger set_updated_at_roles before update on roles for each row execute function set_updated_at();
create trigger set_updated_at_tenant_members before update on tenant_members for each row execute function set_updated_at();
create trigger set_updated_at_whatsapp_accounts before update on whatsapp_accounts for each row execute function set_updated_at();
create trigger set_updated_at_contacts before update on contacts for each row execute function set_updated_at();
create trigger set_updated_at_leads before update on leads for each row execute function set_updated_at();
create trigger set_updated_at_conversations before update on conversations for each row execute function set_updated_at();
create trigger set_updated_at_ai_agents before update on ai_agents for each row execute function set_updated_at();
create trigger set_updated_at_chatbot_flows before update on chatbot_flows for each row execute function set_updated_at();
create trigger set_updated_at_handoff_requests before update on handoff_requests for each row execute function set_updated_at();
create trigger set_updated_at_notes before update on notes for each row execute function set_updated_at();
create trigger set_updated_at_tasks before update on tasks for each row execute function set_updated_at();
create trigger set_updated_at_integrations before update on integrations for each row execute function set_updated_at();
create trigger set_updated_at_whatsapp_integrations before update on whatsapp_integrations for each row execute function set_updated_at();

-- Bind Sign Up Trigger to Auth Users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_default_tenant_for_new_user();

-- ------------------------------------------------------------
-- 11. Row Level Security (RLS) Configuration
-- ------------------------------------------------------------

-- Enable Row Level Security (Enforced on all tenant tables)
alter table tenants            enable row level security;
alter table organizations      enable row level security;
alter table profiles           enable row level security;
alter table subscriptions      enable row level security;
alter table roles              enable row level security;
alter table permissions        enable row level security;
alter table tenant_members     enable row level security;
alter table whatsapp_accounts  enable row level security;
alter table contacts           enable row level security;
alter table leads              enable row level security;
alter table tags               enable row level security;
alter table contact_tags       enable row level security;
alter table notes              enable row level security;
alter table tasks              enable row level security;
alter table conversations      enable row level security;
alter table messages           enable row level security;
alter table handoff_requests   enable row level security;
alter table ai_agents          enable row level security;
alter table chatbot_flows      enable row level security;
alter table automation_rules   enable row level security;
alter table knowledge_base     enable row level security;
alter table integrations       enable row level security;
alter table webhook_events     enable row level security;
alter table api_keys           enable row level security;
alter table usage_logs         enable row level security;
alter table audit_logs         enable row level security;
alter table whatsapp_integrations enable row level security;
alter table api_logs           enable row level security;

-- Deny by default: Ensure public access is completely restricted
-- (Implicitly enforced in Supabase, but declared explicitly for safety)

-- RLS: tenants
create policy "Select tenants user belongs to" on tenants for select using (is_tenant_member(id));
create policy "Update tenants admin can execute" on tenants for update using (has_tenant_role(id, 'admin'));

-- RLS: organizations
create policy "Select orgs user belongs to" on organizations for select using (is_tenant_member(id));
create policy "Update orgs admin can execute" on organizations for update using (has_tenant_role(id, 'admin'));

-- RLS: profiles
create policy "View profiles in same tenant" on profiles for select using (is_tenant_member(organization_id));
create policy "Update own user profile" on profiles for update using (id = auth.uid());

-- RLS: tenant_members
create policy "Select tenant members in same tenant" on tenant_members for select using (is_tenant_member(tenant_id));
create policy "Admin edit tenant memberships" on tenant_members for all using (has_tenant_role(tenant_id, 'admin'));

-- RLS: roles & permissions
create policy "Read roles on own tenant" on roles for select using (is_tenant_member(tenant_id));
create policy "Admin manage roles" on roles for all using (has_tenant_role(tenant_id, 'admin'));
create policy "Read permissions on own tenant" on permissions for select using (is_tenant_member(tenant_id));
create policy "Admin manage permissions" on permissions for all using (has_tenant_role(tenant_id, 'admin'));

-- RLS: subscriptions
create policy "Read subscription status" on subscriptions for select using (is_tenant_member(tenant_id));

-- RLS: whatsapp_accounts
create policy "Members manage WABA accounts" on whatsapp_accounts for all using (is_tenant_member(tenant_id));

-- RLS: contacts
create policy "Read contacts on own tenant" on contacts for select using (is_tenant_member(tenant_id));
create policy "Insert contacts on own tenant" on contacts for insert with check (is_tenant_member(tenant_id));
create policy "Update contacts on own tenant" on contacts for update using (is_tenant_member(tenant_id));
create policy "Delete contacts on own tenant" on contacts for delete using (is_tenant_member(tenant_id));

-- RLS: leads
create policy "Read leads on own tenant" on leads for select using (is_tenant_member(tenant_id));
create policy "Insert leads on own tenant" on leads for insert with check (is_tenant_member(tenant_id));
create policy "Update leads on own tenant" on leads for update using (is_tenant_member(tenant_id));
create policy "Delete leads on own tenant" on leads for delete using (is_tenant_member(tenant_id));

-- RLS: conversations
create policy "Read conversations on own tenant" on conversations for select using (is_tenant_member(tenant_id));
create policy "Insert conversations on own tenant" on conversations for insert with check (is_tenant_member(tenant_id));
create policy "Update conversations on own tenant" on conversations for update using (is_tenant_member(tenant_id));
create policy "Delete conversations on own tenant" on conversations for delete using (is_tenant_member(tenant_id));

-- RLS: messages
create policy "Read messages on own tenant" on messages for select using (is_tenant_member(tenant_id));
create policy "Insert messages on own tenant" on messages for insert with check (is_tenant_member(tenant_id));

-- RLS: ai_agents
create policy "Manage AI agents on own tenant" on ai_agents for all using (is_tenant_member(tenant_id));

-- RLS: chatbot_flows & flows (compatibility)
create policy "Manage chatbot flows" on chatbot_flows for all using (is_tenant_member(tenant_id));
create policy "Manage compatibility flows" on flows for all using (is_tenant_member(organization_id));

-- RLS: automation_rules
create policy "Manage automation rules" on automation_rules for all using (is_tenant_member(tenant_id));

-- RLS: handoff_requests
create policy "Manage handoff requests" on handoff_requests for all using (is_tenant_member(tenant_id));

-- RLS: tags & contact_tags
create policy "Manage tags" on tags for all using (is_tenant_member(tenant_id));
create policy "Manage contact tags" on contact_tags for all using (
  exists (select 1 from contacts where contacts.id = contact_id and is_tenant_member(contacts.tenant_id))
);

-- RLS: notes
create policy "Manage notes" on notes for all using (is_tenant_member(tenant_id));

-- RLS: tasks
create policy "Manage tasks" on tasks for all using (is_tenant_member(tenant_id));

-- RLS: integrations
create policy "Select integrations" on integrations for select using (is_tenant_member(tenant_id));
create policy "Manage integrations admins only" on integrations for all using (has_tenant_role(tenant_id, 'admin'));

-- RLS: webhook_events
create policy "Service role managed webhook logs" on webhook_events for select using (is_tenant_member(tenant_id));

-- RLS: api_keys
create policy "Select developer keys" on api_keys for select using (is_tenant_member(tenant_id));
create policy "Admin configure developer keys" on api_keys for all using (has_tenant_role(tenant_id, 'admin'));

-- RLS: usage_logs & audit_logs
create policy "Select resource usage metrics" on usage_logs for select using (is_tenant_member(tenant_id));
create policy "Select audit ledger entries" on audit_logs for select using (is_tenant_member(tenant_id));

-- RLS: whatsapp_integrations
create policy "Members manage whatsapp integrations" on whatsapp_integrations for all using (is_tenant_member(tenant_id));

-- RLS: api_logs
create policy "Select API logs on own tenant" on api_logs for select using (is_tenant_member(tenant_id));
create policy "Service role insert API logs" on api_logs for insert with check (true);

-- ------------------------------------------------------------
-- 12. Performance Optimization Indexes
-- ------------------------------------------------------------

-- Core Multi-Tenant Sharding Indexes
create index if not exists idx_profiles_org_id on profiles(organization_id);
create index if not exists idx_tenant_members_tenant on tenant_members(tenant_id);
create index if not exists idx_tenant_members_user on tenant_members(user_id);
create index if not exists idx_subscriptions_tenant_id on subscriptions(tenant_id);
create index if not exists idx_subscriptions_status on subscriptions(status);

-- CRM Performance Shards
create index if not exists idx_contacts_tenant_phone on contacts(tenant_id, phone);
create index if not exists idx_leads_tenant_stage on leads(tenant_id, stage);
create index if not exists idx_leads_contact_id on leads(contact_id);
create index if not exists idx_leads_assigned_user_id on leads(assigned_user_id);

-- Conversations & Message Retrieval Performance
create index if not exists idx_conversations_tenant_contact on conversations(tenant_id, contact_id);
create index if not exists idx_conversations_status on conversations(status);
create index if not exists idx_conversations_last_msg on conversations(last_message_at desc);
create index if not exists idx_messages_conversation_id on messages(conversation_id, created_at desc);
create index if not exists idx_messages_whatsapp_id on messages(whatsapp_message_id);

-- Webhook Deduplication & Automation
create index if not exists idx_webhook_events_id on webhook_events(event_id);
create index if not exists idx_webhook_events_status on webhook_events(status);

-- Usage & Audit Analytics
create index if not exists idx_usage_logs_tenant_created on usage_logs(tenant_id, created_at desc);
create index if not exists idx_audit_logs_tenant_created on audit_logs(tenant_id, created_at desc);
create index if not exists idx_api_logs_tenant_created on api_logs(tenant_id, created_at desc);
create index if not exists idx_whatsapp_integrations_code on whatsapp_integrations(integration_code);

-- RAG Vector Search Index for knowledge_base (IVFFlat/HNSW based on database size)
create index if not exists idx_knowledge_base_embeddings on knowledge_base using hnsw (embedding vector_cosine_ops);

-- Fuzzy Search Trigram GIN indexes
create index if not exists idx_contacts_name_trgm on contacts using gin(name gin_trgm_ops);
create index if not exists idx_contacts_phone_trgm on contacts using gin(phone gin_trgm_ops);

-- ============================================================
-- End of Schema Definition
-- ============================================================
