import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { emitToTenant } from '../lib/realtime.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class HumanHandoffService {
  /**
   * Disables AI auto-response for a lead and broadcasts a realtime human handoff request to connected agents.
   */
  public static async initiateHandoff(
    tenantId: string,
    contactId: string,
    reason: string,
    leadId?: string
  ): Promise<boolean> {
    try {
      const { data: convRow } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const conversationId = convRow?.id || leadId || 'unknown';
      logger.info(`[HumanHandoff] Triggered for conversationId ${conversationId}`);

      logger.warn(`[HumanHandoffService] Initializing human handoff`, {
        tenantId,
        contactId,
        reason,
        leadId,
      });

      // 1. Deactivate AI for the lead in the Supabase CRM database
      // Supports querying by direct leadId or fallback contactId
      const query = supabase
        .from('leads')
        .update({
          ai_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId);

      if (leadId) {
        query.eq('id', leadId);
      } else {
        query.eq('contact_id', contactId);
      }

      const { data, error } = await query.select('id, stage').maybeSingle();

      if (error) {
        throw error;
      }

      const activeLeadId = data?.id || leadId || 'unknown';

      // 2. Dispatch a real-time WebSocket alert to all dashboard inbox clients inside the tenant room
      const payload = {
        leadId: activeLeadId,
        contactId,
        tenantId,
        reason,
        timestamp: new Date().toISOString(),
      };

      // Emit global tenant event using our optimized realtime hub
      emitToTenant(tenantId, 'human_handoff_requested', payload);
      emitToTenant(tenantId, 'inbox_update', {
        conversationId: activeLeadId,
        preview: `⚠️ AI Agent Paused — Human Handoff Requested`,
        timestamp: new Date().toISOString(),
        sender_type: 'system',
        unread_delta: 1,
      });

      logger.info(`[HumanHandoffService] Handoff event broadcast successfully`, {
        tenantId,
        leadId: activeLeadId,
      });

      return true;
    } catch (err: any) {
      logger.error(`[HumanHandoffService] Failed to complete human handoff routine`, {
        error: err.message,
        tenantId,
      });
      return false;
    }
  }

  /**
   * Helper to detect if a user's raw message explicitly requests a human operator
   */
  public static containsHandoffIntent(message: string): boolean {
    const handoffKeywords = [
      /\b(speak|talk)\s+(to|with)\s+(a\s+)?(human|person|agent|representative|manager|supervisor)\b/i,
      /\b(connect|transfer)\s+me\s+(to|with)\b/i,
      /\b(real|live)\s+(human|person|agent|support)\b/i,
      /\b(human|live)\s+(agent|support|representative)\b/i,
      /\b(want|need)\s+(a|an)?\s*(human|agent|representative|manager)\b/i,
      /\b(speak|talk)\s+to\s+(someone|staff)\b/i,
      /\b(escalate|escalation)\b/i,
      /\b(refund|lawsuit|attorney|lawyer|sue|legal\s+action)\b/i,
      /\b(speak|talk)\s+to\s+(your|a)\s+(manager|supervisor)\b/i,
    ];
    return handoffKeywords.some((pattern) => pattern.test(message));
  }
}
