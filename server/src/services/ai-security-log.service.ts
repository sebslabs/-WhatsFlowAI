import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import type { AISecurityLog } from '../types/ai-security.types.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export class AISecurityLogService {
  /**
   * Persists a comprehensive safety incident log to Supabase for audit reviews.
   */
  public static async logIncident(log: AISecurityLog): Promise<void> {
    try {
      const payload = {
        tenant_id: log.tenantId,
        lead_id: log.leadId,
        risk_score: log.riskScore,
        category: log.category,
        blocked: log.blocked,
        model_used: log.modelUsed,
        input_tokens: log.inputTokens,
        output_tokens: log.outputTokens,
        cost: log.cost,
        raw_input_preview: log.rawInputPreview.slice(0, 100), // Enforce preview truncation for security
        action_taken: log.actionTaken,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('ai_security_logs').insert(payload);

      if (error) {
        throw error;
      }

      logger.info('[AISecurityLogService] Successfully persisted safety audit log', {
        tenantId: log.tenantId,
        category: log.category,
        blocked: log.blocked,
      });
    } catch (err: any) {
      logger.error('[AISecurityLogService] Failed to insert security incident logs', {
        error: err.message,
        tenantId: log.tenantId,
      });
    }
  }

  /**
   * Retreives high-risk security events for the admin audit dashboard
   */
  public static async getTenantSecurityAlerts(
    tenantId: string,
    limit = 50
  ) {
    const { data, error } = await supabase
      .from('ai_security_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }
    return data;
  }
}
