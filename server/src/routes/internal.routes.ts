import { Router, type Request, type Response, type NextFunction } from 'express'
import { RealtimeController } from '../controllers/realtime.controller.js'
import { getBaileysQueue } from '../services/baileys-queue.js'

const router = Router()

function requireInternalKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.INTERNAL_API_KEY
  const provided = req.headers['x-internal-key']

  if (!expected || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  next()
}

router.post('/realtime/broadcast', requireInternalKey, RealtimeController.broadcast)

router.post('/baileys/enqueue', requireInternalKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, sessionId, sendJid, rawJid, messageId, phone, pushName, text, fromMe, rawMessage } = req.body

    const queue = getBaileysQueue()
    await queue.add('process-baileys-message', {
      tenantId,
      sessionId,
      sendJid,
      rawJid,
      messageId,
      phone,
      pushName,
      text,
      fromMe,
      rawMessage
    }, {
      jobId: `baileys-${messageId}`, // Natural deduplication
    })

    res.status(202).json({ success: true, message: 'Message enqueued successfully' })
  } catch (err: any) {
    console.error('[Internal Baileys Enqueue] Error:', err.message)
    res.status(500).json({ error: 'Failed to enqueue message' })
  }
})

export default router
