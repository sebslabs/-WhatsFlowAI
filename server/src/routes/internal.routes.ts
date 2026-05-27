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

router.post('/baileys/qr', requireInternalKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, sessionId } = req.body
    const { startBaileysSession, waitForSessionQr } = await import('../services/whatsapp-qr.service.js')
    
    await startBaileysSession(tenantId, sessionId)
    const ready = await waitForSessionQr(sessionId)
    res.json(ready)
  } catch (err: any) {
    console.error('[Internal Baileys QR] Error:', err.message)
    res.status(500).json({ error: err.message || 'QR generation timed out' })
  }
})

router.delete('/baileys/qr/:id', requireInternalKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string
    if (!id) {
      res.status(400).json({ error: 'Missing id parameter' })
      return
    }
    const { disconnectBaileysSession } = await import('../services/whatsapp-qr.service.js')
    await disconnectBaileysSession(id)
    res.json({ success: true })
  } catch (err: any) {
    console.error('[Internal Baileys Disconnect] Error:', err.message)
    res.status(500).json({ error: 'Failed to disconnect session' })
  }
})

router.post('/baileys/send', requireInternalKey, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, sessionId, jid, text, messageType, mediaUrl, mimeType, fileName } = req.body
    const { getBaileysSession } = await import('../services/whatsapp-qr.service.js')
    
    const sock = await getBaileysSession(tenantId, sessionId)
    if (!sock) {
      res.status(404).json({ error: 'WhatsApp QR socket disconnected. Please reconnect.' })
      return
    }

    let sentResult;
    if (messageType === 'image') {
      sentResult = await sock.sendMessage(jid, { image: { url: mediaUrl }, caption: text || '' })
    } else if (messageType === 'document') {
      sentResult = await sock.sendMessage(jid, { document: { url: mediaUrl }, mimetype: mimeType || 'application/octet-stream', fileName: fileName || 'Document' })
    } else if (messageType === 'audio') {
      sentResult = await sock.sendMessage(jid, { audio: { url: mediaUrl }, mimetype: mimeType || 'audio/ogg; codecs=opus', ptt: true })
    } else {
      sentResult = await sock.sendMessage(jid, { text })
    }

    res.json({ success: true, messageId: sentResult?.key?.id || null })
  } catch (err: any) {
    console.error('[Internal Baileys Send] Error:', err.message)
    res.status(500).json({ error: err.message || 'Internal server error' })
  }
})

export default router
