/**
 * Notify the Express Socket.IO server after a message is persisted (Baileys / Next.js path).
 * Requires INTERNAL_API_KEY on both Next.js and Express.
 */
export async function broadcastMessageToRealtime(
  tenantId: string,
  conversationId: string,
  message: Record<string, unknown>
): Promise<void> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:5000';
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey) {
    console.error(
      '[realtime-broadcast] INTERNAL_API_KEY is not set — Socket.IO will NOT receive Baileys messages. ' +
        'Set the same key in Next.js (.env.local) and server/.env'
    );
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/api/internal/realtime/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': internalKey,
      },
      body: JSON.stringify({ tenantId, conversationId, message }),
    });

    if (!res.ok) {
      console.warn('[realtime-broadcast] HTTP', res.status, await res.text().catch(() => ''));
    } else {
      console.log('[realtime-broadcast] emitted new_message', { tenantId, conversationId });
    }
  } catch (err) {
    console.warn('[realtime-broadcast] failed:', (err as Error).message);
  }
}
