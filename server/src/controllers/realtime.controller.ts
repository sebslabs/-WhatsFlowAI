import type { Request, Response } from 'express'
import { broadcastNewMessage } from '../lib/realtime.js'
import { logger } from '../utils/logger.js'

export class RealtimeController {
  /** Internal-only: Next.js Baileys layer calls this after DB insert. */
  static broadcast(req: Request, res: Response): void {
    const { tenantId, conversationId, message } = req.body as {
      tenantId?: string
      conversationId?: string
      message?: Record<string, unknown>
    }

    if (!tenantId || !conversationId || !message) {
      res.status(400).json({ error: 'tenantId, conversationId, and message are required' })
      return
    }

    broadcastNewMessage(tenantId, conversationId, message)
    logger.debug('[realtime] internal broadcast', { tenantId, conversationId })
    res.json({ ok: true })
  }
}
