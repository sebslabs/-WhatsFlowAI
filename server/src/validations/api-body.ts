import { z } from 'zod'

const uuid = z.string().uuid()

/** Campaign save payload (whitelist — prevents mass assignment) */
export const saveCampaignBodySchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1).max(200).trim(),
  status: z.enum(['draft', 'scheduled', 'sent', 'failed']).optional(),
  audienceType: z.string().max(50).optional(),
  audienceTag: z.string().max(100).optional(),
  audienceCount: z.number().int().min(0).max(10_000_000).optional(),
  message: z.string().max(4096).optional(),
  mediaType: z.string().max(50).optional(),
  mediaUrl: z.string().url().max(2048).optional().or(z.literal('')),
  scheduledAt: z.string().max(50).optional(),
  sentAt: z.string().max(50).optional(),
  stats: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().max(50).optional(),
  buttons: z.array(z.unknown()).max(20).optional(),
})

const flowStepSchema = z.object({
  type: z.string().max(50),
  message: z.string().max(4096).optional(),
  variableName: z.string().max(100).optional(),
  buttons: z.array(z.unknown()).max(20).optional(),
  tagName: z.string().max(100).optional(),
  notifyNote: z.string().max(500).optional(),
  bookingUrl: z.union([z.string().url().max(2048), z.literal('')]).optional(),
  delayMinutes: z.number().int().min(0).max(10080).optional(),
  conditionVariable: z.string().max(100).optional(),
  conditionOperator: z.string().max(20).optional(),
  conditionValue: z.string().max(200).optional(),
  mediaType: z.string().max(50).optional(),
  mediaUrl: z.string().max(2048).optional(),
  aiPrompt: z.string().max(8000).optional(),
  webhookUrl: z.union([z.string().url().max(2048), z.literal('')]).optional(),
  listTitle: z.string().max(200).optional(),
  listItems: z.array(z.unknown()).max(50).optional(),
})

export const saveFlowBodySchema = z.object({
  id: uuid.optional(),
  name: z.string().min(1).max(200).trim(),
  active: z.boolean().optional(),
  triggerType: z.enum(['first_message', 'keyword', 'tag', 'manual']),
  triggerKeyword: z.string().max(200).optional(),
  steps: z.array(flowStepSchema).min(1).max(100),
})

export const createTicketBodySchema = z.object({
  conversation_id: uuid.optional(),
  subject: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  reason: z.string().max(5000).optional(),
})

export const updateSettingsBodySchema = z.record(z.string(), z.unknown())

export const saveWhatsAppTemplateBodySchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().min(1).max(200).trim(),
  language: z.string().max(20).optional(),
  category: z.string().max(100).optional(),
  status: z.string().max(50).optional(),
  components: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
})

export const createCatalogProductBodySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative().max(1_000_000),
  compare_price: z.number().nonnegative().max(1_000_000).optional(),
  sku: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  image_url: z.string().max(2048).optional(),
  status: z.enum(['active', 'inactive', 'draft']).optional(),
})

export const updateCatalogProductBodySchema = createCatalogProductBodySchema.partial()

export const createAIAgentBodySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  role: z.string().min(1).max(200).trim().optional(),
  instructions: z.string().min(1).max(8000).trim(),
  tone: z.enum(['professional', 'friendly', 'formal', 'casual', 'empathetic']).optional(),
  model: z.string().max(200).optional(),
  temperature: z.union([z.string(), z.number()]).optional(),
})

export const updateAIAgentBodySchema = createAIAgentBodySchema.partial()

export const chatWithAIAgentBodySchema = z.object({
  message: z.string().min(1).max(4096).trim(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4096),
      })
    )
    .max(50)
    .optional()
    .default([]),
})

export const toggleAIAgentStatusBodySchema = z.object({
  status: z.enum(['active', 'paused']),
})

export const idParamSchema = z.object({
  id: uuid,
})

export const leadIdParamSchema = z.object({
  leadId: uuid,
})
