import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { broadcastMessageToRealtime } from '@/lib/realtime-broadcast'

/**
 * Pause AI for a lead and notify dashboard clients (Next.js / AIGateway path).
 */
export async function initiateHumanHandoff(
  tenantId: string,
  contactId: string,
  reason: string,
  leadId?: string
): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin()
    const { data: convRow } = await (admin.from('conversations') as any)
      .select('id')
      .eq('contact_id', contactId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const conversationId = convRow?.id || leadId || 'unknown'
    logger.info(`[HumanHandoff] Triggered for conversationId ${conversationId}`)
    let query = (admin.from('leads') as any)
      .update({ ai_active: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    if (leadId) {
      query = query.eq('id', leadId)
    } else {
      query = query.eq('contact_id', contactId)
    }

    const { data, error } = await query.select('id').maybeSingle()
    if (error) throw error

    const activeLeadId = data?.id ?? leadId ?? 'unknown'

    await broadcastMessageToRealtime(tenantId, activeLeadId, {
      type: 'human_handoff_requested',
      leadId: activeLeadId,
      contactId,
      tenantId,
      reason,
      timestamp: new Date().toISOString(),
      preview: 'AI paused — human handoff requested',
      sender_type: 'system',
    })

    logger.warn({ tenantId, leadId: activeLeadId, reason }, '[human-handoff] AI paused for lead')
    return true
  } catch (err) {
    logger.error({ err, tenantId, contactId }, '[human-handoff] Failed')
    return false
  }
}

export function containsHandoffIntent(message: string): boolean {
  const patterns = [
    /\b(speak|talk)\s+(to|with)\s+(a\s+)?(human|person|agent|representative|manager|supervisor)\b/i,
    /\b(connect|transfer)\s+me\s+(to|with)\b/i,
    /\b(real|live)\s+(human|person|agent|support)\b/i,
    /\b(human|live)\s+(agent|support|representative)\b/i,
    /\b(want|need)\s+(a|an)?\s*(human|agent|representative|manager)\b/i,
    /\b(escalate|escalation)\b/i,
    /\b(refund|lawsuit|attorney|lawyer|sue|legal\s+action)\b/i,
  ]
  return patterns.some((p) => p.test(message))
}
