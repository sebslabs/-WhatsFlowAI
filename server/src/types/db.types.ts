/**
 * ============================================================
 * WhatsFlow AI — Centralized Database Types
 * Aligned 1:1 with supabase_production_schema_final.sql v2.2
 * ============================================================
 * IMPORTANT: Do NOT add field names that don't exist in the DB.
 * This file is the single source of truth for all backend types.
 */

// ── Enums (mirroring PostgreSQL enums exactly) ────────────────────────────────

export type TenantPlanType = 'free' | 'pro' | 'enterprise'

export type SubscriptionStatusType =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'inactive'

/** msg_sender_type PostgreSQL enum */
export type MsgSenderType = 'contact' | 'user' | 'ai' | 'system'

/** msg_status_type PostgreSQL enum */
export type MsgStatusType = 'sent' | 'delivered' | 'read' | 'failed'

/** campaign_status_type PostgreSQL enum */
export type CampaignStatusType =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'

/** template_status_type PostgreSQL enum */
export type TemplateStatusType = 'pending' | 'approved' | 'rejected'

/** Conversation mode — inline check constraint */
export type ConversationMode = 'ai' | 'manual' | 'flow'

/** Lead stage — inline check constraint */
export type LeadStage =
  | 'New'
  | 'Contacted'
  | 'Qualifying'
  | 'Qualified'
  | 'Proposal'
  | 'Booked'
  | 'Lost'

/** Lead status — inline check constraint */
export type LeadStatus = 'active' | 'archived' | 'blocked'

/** Tenant member role — inline check constraint */
export type TenantMemberRole = 'admin' | 'agent' | 'viewer'

/** WhatsApp account status — inline check constraint */
export type WaAccountStatus = 'connected' | 'disconnected' | 'pending'

/** Chatbot flow trigger type — inline check constraint */
export type FlowTriggerType = 'first_message' | 'keyword' | 'tag' | 'manual'

// ── Row Types ─────────────────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  industry_ecosystem: string | null
  support_email: string | null
  whatsapp_number: string | null
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  /** organization_id kept for backward-compat — maps to tenant_id */
  organization_id: string | null
  role: string | null
  created_at: string
  updated_at: string
}

export interface TenantMember {
  id: string
  tenant_id: string
  user_id: string
  role: TenantMemberRole
  created_at: string
}

export interface Contact {
  id: string
  tenant_id: string
  name: string
  phone: string
  email: string | null
  tags: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Lead {
  id: string
  tenant_id: string
  contact_id: string
  stage: LeadStage
  lead_value: number
  assigned_user_id: string | null
  status: LeadStatus
  /** Flow state tracking — added by migration */
  current_flow_id: string | null
  current_step_index: number
  ai_active?: boolean
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  tenant_id: string
  contact_id: string
  status: string
  mode: ConversationMode
  unread_count: number
  last_message_at: string
  created_at: string
}

export interface Message {
  id: string
  tenant_id: string
  conversation_id: string
  sender_type: MsgSenderType
  content: string
  message_type: string
  media_url: string | null
  wa_message_id: string | null
  delivery_status: MsgStatusType
  created_at: string
}

export interface AIAgent {
  id: string
  tenant_id: string
  name: string
  model: string
  instructions: string
  temperature: number
  is_active: boolean
  created_at: string
}

export interface ChatbotFlow {
  id: string
  tenant_id: string
  name: string
  description: string | null
  /** JSONB steps array — flow engine reads this */
  definition: FlowStep[]
  is_active: boolean
  created_at: string
}

export interface WhatsAppAccount {
  id: string
  tenant_id: string
  name: string
  phone_number_id: string
  waba_id: string | null
  verify_token: string | null
  /** Encrypted at application layer before storage */
  access_token: string | null
  status: WaAccountStatus
  created_at: string
  updated_at: string
}

export interface BillingSubscription {
  id: string
  tenant_id: string
  plan: TenantPlanType
  paddle_customer_id: string | null
  paddle_subscription_id: string | null
  paddle_price_id: string | null
  status: SubscriptionStatusType
  current_period_end: string | null
  created_at: string
  updated_at: string
}

export interface WebhookEvent {
  id: string
  /** Matches external_event_id for idempotency */
  external_event_id: string
  status: 'pending' | 'processed' | 'failed'
  payload: Record<string, unknown> | null
  created_at: string
}

// ── Flow Engine Types ─────────────────────────────────────────────────────────

export type FlowStepType =
  | 'message'
  | 'question'
  | 'buttons'
  | 'tag'
  | 'notify'
  | 'booking'
  | 'delay'
  | 'condition'
  | 'media'
  | 'payment'
  | 'ai_agent'
  | 'webhook'
  | 'list'
  | 'handover'
  | 'sheets'
  | 'end'

export interface FlowStep {
  id: string
  type: FlowStepType
  message?: string
  variableName?: string
  buttons?: { id: string; label: string }[]
  tagName?: string
  notifyNote?: string
  bookingUrl?: string
  delayMinutes?: number
  conditionVariable?: string
  conditionOperator?: string
  conditionValue?: string
  mediaType?: 'image' | 'video' | 'document'
  mediaUrl?: string
  mediaCaption?: string
  endMessage?: string
  endLeadStage?: string
  paymentAmount?: string
  paymentCurrency?: string
  paymentDescription?: string
  aiPrompt?: string
  webhookUrl?: string
  webhookPayload?: string
  listTitle?: string
  listItems?: { id: string; title: string; desc?: string }[]
  handoverNote?: string
  spreadsheetId?: string
  sheetName?: string
}

// ── Webhook Worker Payload ────────────────────────────────────────────────────

export interface IncomingWebhookMessage {
  /** Meta's unique message ID — used for deduplication */
  messageId: string
  /** Sender's WhatsApp phone number (E.164 format) */
  from: string
  /** Message text (sanitized before DB insertion) */
  text: string
  /** ISO timestamp derived from Meta's Unix timestamp */
  timestamp: string
  /** phone_number_id from Meta payload — used to look up whatsapp_accounts */
  phoneNumberId: string | null
  /** Pre-resolved tenant UUID (if available from earlier step) */
  tenantId?: string
  /** Full raw Meta payload for audit/debug */
  rawPayload: Record<string, unknown>
}
