-- ============================================================
-- WhatsFlow AI — Finalized Production Database Schema
-- Version: 2.2
-- Includes: Campaigns, Templates, Catalog, Widget, AI RAG, CRM
-- Security Strategy: Strict Multi-tenant Row Level Security (RLS)
-- ============================================================

-- ------------------------------------------------------------
-- 0. Core Setup & Extensions
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";    -- Fuzzy searching
create extension if not exists "vector";     -- AI Embeddings

-- Enum Types
do $$ begin
    create type tenant_plan_type as enum ('free', 'pro', 'enterprise');
    create type subscription_status_type as enum ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'inactive');
    create type msg_sender_type as enum ('contact', 'user', 'ai', 'system');
    create type msg_status_type as enum ('sent', 'delivered', 'read', 'failed');
    create type campaign_status_type as enum ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed');
    create type template_status_type as enum ('pending', 'approved', 'rejected');
exception
    when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 1. Tenancy & RBAC
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

-- Table: profiles (Mapped to auth.users)
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text,
  avatar_url      text,
  organization_id uuid, -- Backward compatibility link for NextJS API
  role            text default 'user',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Table: organizations (Alias bridge for backward-compatible frontend context)
create table if not exists organizations (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid references tenants(id) on delete cascade,
  name           text not null,
  slug           text unique not null,
  created_at     timestamptz not null default now()
);

-- Table: tenant_members
create table if not exists tenant_members (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'agent', 'viewer')),
  created_at      timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- Table: billing_subscriptions
create table if not exists billing_subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null unique references tenants(id) on delete cascade,
  plan                   tenant_plan_type not null default 'free',
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 subscription_status_type not null default 'inactive',
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Meta Integration & Templates
-- ------------------------------------------------------------

-- Table: whatsapp_accounts
create table if not exists whatsapp_accounts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  phone_number_id     text unique not null,
  waba_id             text,
  verify_token        text, 
  access_token        text, -- Encrypted in-app
  status              text default 'disconnected',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: whatsapp_templates
create table if not exists whatsapp_templates (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  language            text not null default 'en',
  category            text,
  components          jsonb not null default '[]',
  status              template_status_type not null default 'pending',
  meta_template_id    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, name, language)
);

-- ------------------------------------------------------------
-- 3. CRM & Lead Lifecycle
-- ------------------------------------------------------------

-- Table: contacts
create table if not exists contacts (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null default 'Lead',
  phone               text not null,
  email               text,
  tags                text[] default '{}',
  metadata            jsonb default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, phone)
);

-- Table: leads
create table if not exists leads (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null unique references contacts(id) on delete cascade,
  stage               text not null default 'New',
  lead_value          numeric(12,2) default 0.00,
  assigned_user_id    uuid references profiles(id) on delete set null,
  status              text default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: tasks
create table if not exists tasks (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid references contacts(id) on delete cascade,
  title               text not null,
  description         text,
  due_at              timestamptz,
  status              text default 'pending',
  assigned_to         uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Messaging & Conversations
-- ------------------------------------------------------------

-- Table: conversations
create table if not exists conversations (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  status              text not null default 'open',
  mode                text not null default 'ai' check (mode in ('ai', 'manual', 'flow')),
  unread_count        int default 0,
  last_message_at     timestamptz default now(),
  created_at          timestamptz not null default now(),
  unique (tenant_id, contact_id)
);

-- Table: messages
create table if not exists messages (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  conversation_id     uuid not null references conversations(id) on delete cascade,
  sender_type         msg_sender_type not null,
  content             text not null,
  message_type        text default 'text',
  media_url           text,
  wa_message_id       text unique,
  delivery_status     msg_status_type default 'sent',
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. AI, Knowledge Base & Automation
-- ------------------------------------------------------------

-- Table: ai_agents
create table if not exists ai_agents (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  model               text default 'gpt-4o',
  instructions        text not null,
  temperature         numeric(3,2) default 0.7,
  is_active           boolean default true,
  created_at          timestamptz not null default now()
);

-- Table: knowledge_base (pgvector for RAG)
create table if not exists knowledge_base (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  content             text not null,
  embedding           vector(1536),
  metadata            jsonb default '{}',
  created_at          timestamptz not null default now()
);

-- Table: chatbot_flows
create table if not exists chatbot_flows (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  definition          jsonb not null, -- JSON configuration of nodes/edges
  is_active           boolean default false,
  created_at          timestamptz not null default now()
);

-- Table: settings
create table if not exists settings (
  tenant_id           uuid primary key references tenants(id) on delete cascade,
  config              jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 6. Campaigns & Catalog & Widget
-- ------------------------------------------------------------

-- Table: campaigns
create table if not exists campaigns (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  template_id         uuid references whatsapp_templates(id) on delete set null,
  whatsapp_account_id uuid references whatsapp_accounts(id) on delete set null,
  status              campaign_status_type not null default 'draft',
  schedule_time       timestamptz,
  audience_filter     jsonb, -- Defines who gets message (tags, stages)
  total_count         int default 0,
  sent_count          int default 0,
  delivered_count     int default 0,
  read_count          int default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Table: campaign_logs (Audit trail of individual sends)
create table if not exists campaign_logs (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references campaigns(id) on delete cascade,
  contact_id          uuid not null references contacts(id) on delete cascade,
  status              text default 'pending',
  wa_message_id       text,
  sent_at             timestamptz,
  error_message       text
);

-- Table: product_categories
create table if not exists product_categories (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  created_at          timestamptz not null default now()
);

-- Table: products
create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  category_id         uuid references product_categories(id) on delete set null,
  name                text not null,
  description         text,
  price               numeric(12,2) not null check (price >= 0),
  currency            text default 'USD',
  image_url           text,
  sku                 text,
  inventory           int default 0,
  is_active           boolean default true,
  created_at          timestamptz not null default now()
);

-- Table: chat_widgets
create table if not exists chat_widgets (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  domain              text not null, -- Allowed domain constraint
  branding_color      text default '#25D366',
  welcome_message     text,
  position            text default 'bottom-right',
  is_active           boolean default true,
  created_at          timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. Analytics, Audit & Security Helpers
-- ------------------------------------------------------------

-- Table: api_keys
create table if not exists api_keys (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  name                text not null,
  key_hash            text unique not null,
  last_used_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- Table: webhook_events (Idempotency store)
create table if not exists webhook_events (
  id                  uuid primary key default gen_random_uuid(),
  external_event_id   text unique not null,
  status              text default 'pending',
  payload             jsonb,
  created_at          timestamptz not null default now()
);

-- Security Definer Functions for RLS
create or replace function auth_is_tenant_member(check_tenant_id uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from tenant_members 
    where tenant_id = check_tenant_id and user_id = auth.uid()
  );
end;
$$;

-- Trigger function for updated_at
create or replace function trigger_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 8. Row Level Security (RLS) Activation
-- ------------------------------------------------------------

alter table tenants enable row level security;
alter table profiles enable row level security;
alter table tenant_members enable row level security;
alter table billing_subscriptions enable row level security;
alter table whatsapp_accounts enable row level security;
alter table whatsapp_templates enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;
alter table tasks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table ai_agents enable row level security;
alter table knowledge_base enable row level security;
alter table chatbot_flows enable row level security;
alter table campaigns enable row level security;
alter table products enable row level security;
alter table settings enable row level security;
alter table chat_widgets enable row level security;

-- RLS Policy Generators (Drop first to ensure re-runnability)
drop policy if exists "Access own tenant" on tenants;
create policy "Access own tenant" on tenants for select using (auth_is_tenant_member(id));

drop policy if exists "Profiles access" on profiles;
create policy "Profiles access" on profiles for select using (exists (select 1 from tenant_members where user_id = auth.uid()));

drop policy if exists "Profile updates" on profiles;
create policy "Profile updates" on profiles for update using (id = auth.uid());

-- Generic Tenant Isolation Policies (Drop first to ensure re-runnability)
drop policy if exists "Tenant isolation on subscription" on billing_subscriptions;
create policy "Tenant isolation on subscription" on billing_subscriptions for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on wa_accounts" on whatsapp_accounts;
create policy "Tenant isolation on wa_accounts" on whatsapp_accounts for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on templates" on whatsapp_templates;
create policy "Tenant isolation on templates" on whatsapp_templates for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on contacts" on contacts;
create policy "Tenant isolation on contacts" on contacts for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on leads" on leads;
create policy "Tenant isolation on leads" on leads for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on conversations" on conversations;
create policy "Tenant isolation on conversations" on conversations for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on messages" on messages;
create policy "Tenant isolation on messages" on messages for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on agents" on ai_agents;
create policy "Tenant isolation on agents" on ai_agents for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on KB" on knowledge_base;
create policy "Tenant isolation on KB" on knowledge_base for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on campaigns" on campaigns;
create policy "Tenant isolation on campaigns" on campaigns for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on products" on products;
create policy "Tenant isolation on products" on products for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on settings" on settings;
create policy "Tenant isolation on settings" on settings for all using (auth_is_tenant_member(tenant_id));

drop policy if exists "Tenant isolation on widgets" on chat_widgets;
create policy "Tenant isolation on widgets" on chat_widgets for all using (auth_is_tenant_member(tenant_id));

-- ------------------------------------------------------------
-- 9. Indexes & Performance Tuning
-- ------------------------------------------------------------

-- Foreign Keys & Shards
create index if not exists idx_tm_uid on tenant_members(user_id);
create index if not exists idx_contacts_phone_lookup on contacts(tenant_id, phone);
create index if not exists idx_leads_contact on leads(contact_id);
create index if not exists idx_conv_contact on conversations(contact_id);
create index if not exists idx_msg_conv on messages(conversation_id, created_at desc);
create index if not exists idx_msg_wa_id on messages(wa_message_id);
create index if not exists idx_campaign_logs_cid on campaign_logs(campaign_id);

-- HNSW vector index for lightning-fast semantic search
create index if not exists idx_kb_vector on knowledge_base using hnsw (embedding vector_cosine_ops);

-- Trigram GIN for lightning fast contact prefix/fuzzy matching
create index if not exists idx_contacts_name_trgm on contacts using gin(name gin_trgm_ops);

-- Setup Triggers
-- Setup Triggers (Drop guards added for repeated deployment survival)
drop trigger if exists trg_tenants_upd on tenants;
create trigger trg_tenants_upd before update on tenants for each row execute function trigger_set_updated_at();

drop trigger if exists trg_subs_upd on billing_subscriptions;
create trigger trg_subs_upd before update on billing_subscriptions for each row execute function trigger_set_updated_at();

drop trigger if exists trg_contacts_upd on contacts;
create trigger trg_contacts_upd before update on contacts for each row execute function trigger_set_updated_at();

drop trigger if exists trg_leads_upd on leads;
create trigger trg_leads_upd before update on leads for each row execute function trigger_set_updated_at();

drop trigger if exists trg_campaigns_upd on campaigns;
create trigger trg_campaigns_upd before update on campaigns for each row execute function trigger_set_updated_at();

drop trigger if exists trg_settings_upd on settings;
create trigger trg_settings_upd before update on settings for each row execute function trigger_set_updated_at();

-- ------------------------------------------------------------
-- 10. Automated Identity & Tenant Provisioning
-- ------------------------------------------------------------

-- Trigger Function: Provisions Tenant, Profile, Sub, and Agent on Auth.Signup
create or replace function create_default_tenant_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_tenant_id uuid;
  tenant_slug text;
begin
  -- 1. Build a guaranteed UNIQUE slug using user ID slice to prevent collisions
  tenant_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'organization_name', 'org'), '[^a-z0-9]', '-', 'g')) || '-' || substring(new.id::text, 1, 6);

  -- 2. Insert Core Tenant (Modern Structure)
  insert into tenants (name, slug, industry_ecosystem, support_email, whatsapp_number)
  values (
    coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'),
    tenant_slug,
    new.raw_user_meta_data->>'industry_ecosystem',
    new.raw_user_meta_data->>'support_email',
    new.raw_user_meta_data->>'whatsapp_number'
  )
  returning id into new_tenant_id;

  -- 3. Insert Bridge Organization (Backward Compatibility needed by front-end)
  insert into organizations (tenant_id, name, slug)
  values (new_tenant_id, coalesce(new.raw_user_meta_data->>'organization_name', 'My Business'), tenant_slug);

  -- 4. Insert into Profiles (Crucial: maps organization_id so frontend works!)
  insert into profiles (id, email, full_name, avatar_url, organization_id, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new_tenant_id,
    'admin'
  )
  on conflict (id) do update set organization_id = new_tenant_id, role = 'admin';

  -- 5. Finalize RBAC Mapping
  insert into tenant_members (tenant_id, user_id, role)
  values (new_tenant_id, new.id, 'admin')
  on conflict do nothing;

  -- 6. Initialize billing safely
  insert into billing_subscriptions (tenant_id, plan, status)
  values (new_tenant_id, 'free'::tenant_plan_type, 'active'::subscription_status_type);

  -- 7. Spin up Default AI
  insert into ai_agents (tenant_id, name, model, instructions, temperature, is_active)
  values (new_tenant_id, 'Primary Support Agent', 'gpt-4o', 'Professional expert.', 0.7, true);

  return new;
end;
$$;

-- Attach to standard Supabase authentication event
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function create_default_tenant_for_new_user();

-- ============================================================
-- END SCHEMA
-- ============================================================
