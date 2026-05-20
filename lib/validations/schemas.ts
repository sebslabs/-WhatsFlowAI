import { z } from 'zod'

// ── Primitives ────────────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid()

const phoneSchema = z
  .string()
  .min(7)
  .max(20)
  .regex(/^\+?[1-9]\d{6,18}$/, 'Invalid phone number')

const emailSchema = z.string().email().max(254)

const urlSchema = z.string().url().max(2048)

// ── Leads ─────────────────────────────────────────────────────────────────────

export const leadStageSchema = z.enum([
  'New',
  'Contacted',
  'Qualifying',
  'Qualified',
  'Proposal',
  'Booked',
  'Lost',
])

export const leadUrgencySchema = z.enum([
  'Today',
  'This Week',
  'Next Week',
  'This Month',
  'Flexible',
])

export const createLeadSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal('')),
  service: z.string().max(100).trim().optional(),
  stage: leadStageSchema.default('New'),
  urgency: leadUrgencySchema.optional(),
  notes: z.string().max(2000).trim().optional(),
})

export const updateLeadSchema = createLeadSchema
  .partial()
  .extend({ id: uuidSchema })

export const deleteLeadSchema = z.object({ id: uuidSchema })

export const bulkDeleteLeadsSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(100),
})

// ── Automation Flows ──────────────────────────────────────────────────────────

const flowStepSchema = z.object({
  type: z.enum(['message', 'question', 'ai_agent', 'tag', 'notify', 'delay', 'webhook']),
  content: z.string().max(4096).optional(),
  options: z.array(z.string().max(200)).max(10).optional(),
  delay: z.number().int().min(0).max(86400).optional(), // seconds, max 24h
})

export const createFlowSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  active: z.boolean().default(false),
  trigger_type: z.enum(['first_message', 'keyword', 'tag', 'manual']),
  trigger_keyword: z.string().max(100).trim().optional(),
  steps: z.array(flowStepSchema).min(1).max(50),
})

export const updateFlowSchema = createFlowSchema.partial().extend({ id: uuidSchema })

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  status: z.enum(['draft', 'scheduled', 'sent', 'failed']).default('draft'),
  audience_type: z.enum(['all', 'tag', 'stage']),
  audience_tag: z.string().max(100).optional(),
  message: z.string().min(1).max(4096).trim(),
  media_type: z.enum(['none', 'image', 'video', 'document']).default('none'),
  media_url: urlSchema.optional().or(z.literal('')),
  scheduled_at: z.string().datetime().optional(),
})

// ── AI Agents ─────────────────────────────────────────────────────────────────

export const createAIAgentSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  role: z.string().min(1).max(200).trim(),
  instructions: z.string().min(1).max(8000).trim(),
  tone: z.enum(['professional', 'friendly', 'formal', 'casual', 'empathetic']),
})

export const updateAIAgentSchema = createAIAgentSchema.partial().extend({ id: uuidSchema })

export const chatWithAgentSchema = z.object({
  message: z.string().min(1).max(4096).trim(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4096),
      })
    )
    .max(50)
    .default([]),
})

// ── Catalog ───────────────────────────────────────────────────────────────────

export const createProductSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  price: z.number().positive().max(1_000_000),
  compare_price: z.number().positive().max(1_000_000).optional(),
  sku: z.string().max(100).trim().optional(),
  category: z.string().max(100).trim().optional(),
  stock: z.number().int().min(0).max(1_000_000).default(0),
  image_url: urlSchema.optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'draft']).default('active'),
})

// ── Auth ──────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
})

export const registerSchema = loginSchema.extend({
  full_name: z.string().min(2).max(100).trim(),
  organization_name: z.string().min(2).max(100).trim(),
})

export const twoFactorVerifySchema = z.object({
  token: z.string().length(6).regex(/^\d{6}$/, 'Must be 6 digits'),
})

// ── Settings ──────────────────────────────────────────────────────────────────

export const updateSettingsSchema = z.object({
  business_name: z.string().max(100).trim().optional(),
  business_phone: phoneSchema.optional(),
  business_email: emailSchema.optional(),
  whatsapp_number: phoneSchema.optional(),
  ai_enabled: z.boolean().optional(),
  ai_fallback_message: z.string().max(500).trim().optional(),
})

// ── Type exports ──────────────────────────────────────────────────────────────

export type CreateLeadInput = z.infer<typeof createLeadSchema>
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>
export type CreateFlowInput = z.infer<typeof createFlowSchema>
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>
export type CreateAIAgentInput = z.infer<typeof createAIAgentSchema>
export type ChatWithAgentInput = z.infer<typeof chatWithAgentSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
