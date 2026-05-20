import { Router } from 'express'
import multer from 'multer'
import { APIController } from '../controllers/api.controller.js'
import { WhatsAppController } from '../controllers/whatsapp.controller.js'
import { LogsController } from '../controllers/logs.controller.js'
import { apiLoggingMiddleware } from '../middleware/logging.middleware.js'
import { authenticate, requireAdmin } from '../middleware/auth.middleware.js'
import { apiRateLimit } from '../middleware/rate-limit.middleware.js'
import { validate, validateParams } from '../middleware/validate.middleware.js'
import {
  saveCampaignBodySchema,
  saveFlowBodySchema,
  createTicketBodySchema,
  updateSettingsBodySchema,
  saveWhatsAppTemplateBodySchema,
  createCatalogProductBodySchema,
  updateCatalogProductBodySchema,
  createAIAgentBodySchema,
  updateAIAgentBodySchema,
  chatWithAIAgentBodySchema,
  toggleAIAgentStatusBodySchema,
  idParamSchema,
  leadIdParamSchema,
} from '../validations/api-body.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only image files are allowed'))
  },
})

const router = Router()

router.use(apiLoggingMiddleware)

router.get('/whatsapp/verify', WhatsAppController.verify)
router.get('/whatsapp/webhook', WhatsAppController.verify) // Support Meta callback URL handshake GET
router.post('/whatsapp/webhook', WhatsAppController.webhook)
router.post('/chatbot/public', APIController.chatPublicBot)

router.use(authenticate)
router.use(apiRateLimit)

router.post('/whatsapp/connect',  authenticate, WhatsAppController.connect)
router.get('/whatsapp/config',   authenticate, WhatsAppController.getConfig)
router.post('/whatsapp/send',    authenticate, WhatsAppController.send)  // Manual agent send

router.get('/logs', requireAdmin, LogsController.getLogs)
router.get('/logs/:id', requireAdmin, validateParams(idParamSchema), LogsController.getLogById)

router.get('/conversations', APIController.getConversations)
router.get('/stats', APIController.getStats)
router.get('/leads', APIController.getLeads)
router.get('/flows', APIController.getFlows)
router.get('/campaigns', APIController.getCampaigns)
router.post('/campaigns', requireAdmin, validate(saveCampaignBodySchema), APIController.saveCampaign)
router.delete('/campaigns/:id', requireAdmin, validateParams(idParamSchema), APIController.deleteCampaign)
router.get('/knowledge', APIController.getKnowledgeSources)
router.get('/analytics', APIController.getAnalytics)
router.get('/tickets', APIController.getTickets)
router.post('/tickets', validate(createTicketBodySchema), APIController.createTicket)
// FIXED: route param is conversationId (not leadId — matches schema conversations.id)
router.get(
  '/conversations/:conversationId/messages',
  APIController.getMessages
)
router.post('/flows', requireAdmin, validate(saveFlowBodySchema), APIController.saveFlow)
router.delete('/flows/:id', requireAdmin, validateParams(idParamSchema), APIController.deleteFlow)
router.get('/settings', APIController.getSettings)
router.post('/settings', requireAdmin, validate(updateSettingsBodySchema), APIController.updateSettings)

router.get('/whatsapp-templates', APIController.getWhatsAppTemplates)
router.post(
  '/whatsapp-templates',
  requireAdmin,
  validate(saveWhatsAppTemplateBodySchema),
  APIController.saveWhatsAppTemplate
)
router.delete(
  '/whatsapp-templates/:id',
  requireAdmin,
  validateParams(idParamSchema),
  APIController.deleteWhatsAppTemplate
)

router.get('/catalog', APIController.getCatalogProducts)
router.post('/catalog/upload', requireAdmin, upload.single('file'), APIController.uploadCatalogImage)
router.post('/catalog', requireAdmin, validate(createCatalogProductBodySchema), APIController.createCatalogProduct)
router.put(
  '/catalog/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateCatalogProductBodySchema),
  APIController.updateCatalogProduct
)
router.delete('/catalog/:id', requireAdmin, validateParams(idParamSchema), APIController.deleteCatalogProduct)

router.get('/ai-agents', APIController.getAIAgents)
router.post('/ai-agents', requireAdmin, validate(createAIAgentBodySchema), APIController.createAIAgent)
router.put(
  '/ai-agents/:id',
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateAIAgentBodySchema),
  APIController.updateAIAgent
)
router.delete('/ai-agents/:id', requireAdmin, validateParams(idParamSchema), APIController.deleteAIAgent)
router.patch(
  '/ai-agents/:id/status',
  requireAdmin,
  validateParams(idParamSchema),
  validate(toggleAIAgentStatusBodySchema),
  APIController.toggleAIAgentStatus
)
router.post(
  '/ai-agents/:id/chat',
  validateParams(idParamSchema),
  validate(chatWithAIAgentBodySchema),
  APIController.chatWithAIAgent
)

export default router
