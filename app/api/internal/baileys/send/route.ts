import { NextRequest, NextResponse } from 'next/server';
import { getBaileysSession } from '@/lib/whatsapp-qr';
import { logger } from '@/lib/logger';

/**
 * Secure internal Next.js bridge route.
 * Receives computed AI messages or campaign jobs from the background workers,
 * looks up the active memory Baileys socket session, and transmits the WhatsApp message.
 */
export async function POST(req: NextRequest) {
  try {
    const internalKey = req.headers.get('x-internal-secret');
    const systemInternalKey = process.env.WEBHOOK_INTERNAL_SECRET;

    if (!systemInternalKey || internalKey !== systemInternalKey) {
      logger.warn('[Internal Baileys Send] Blocked unauthorized or missing internal key request.');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tenantId, sessionId, jid, text } = body;

    if (!tenantId || !sessionId || !jid || !text) {
      return NextResponse.json({ error: 'Missing tenantId, sessionId, jid, or text' }, { status: 400 });
    }

    // Retrieve active connection socket from global Map memory
    const sock = await getBaileysSession(tenantId, sessionId);
    if (!sock) {
      throw new Error(`No active Baileys socket found for sessionId: ${sessionId}`);
    }

    // Execute instant non-blocking Baileys socket send command
    const sent = await sock.sendMessage(jid, { text });

    return NextResponse.json({
      success: true,
      messageId: sent?.key?.id || null,
    });
  } catch (err: any) {
    logger.error('[Internal Baileys Send] Outbound delivery failed', undefined, err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'GENERIC_ERROR',
      },
      { status: 500 }
    );
  }
}
