import dotenv from 'dotenv';
import { getRedisClient } from '../lib/redis.js';
import { logger } from '../utils/logger.js';
import type { BudgetStatus } from '../types/ai-security.types.js';

dotenv.config();

export class TokenBudgetService {
  // ── Default Daily Hard Limits ───────────────────────────────────────────────
  private static defaultTokenLimit = parseInt(process.env.AI_DAILY_TOKEN_LIMIT || '500000', 10);
  private static defaultCostLimit = parseFloat(process.env.AI_DAILY_COST_LIMIT || '5.00');

  private static getTokenKey(tenantId: string): string {
    return `tenant:${tenantId}:daily_tokens`;
  }

  private static getCostKey(tenantId: string): string {
    return `tenant:${tenantId}:daily_cost`;
  }

  /**
   * Helper to fetch a tenant's configured limits.
   * Standardizes support for tenant-specific overrides in the future.
   */
  public static async getTenantLimits(tenantId: string): Promise<{ tokenLimit: number; costLimit: number }> {
    // In production, you would fetch these limits from a Supabase "tenants" or "settings" table.
    // We default to the central environment configuration.
    return {
      tokenLimit: this.defaultTokenLimit,
      costLimit: this.defaultCostLimit,
    };
  }

  /**
   * Check if a tenant has exceeded their daily token or monetary budget
   */
  public static async checkBudget(tenantId: string): Promise<BudgetStatus> {
    const redis = getRedisClient();
    const tokenKey = this.getTokenKey(tenantId);
    const costKey = this.getCostKey(tenantId);

    const [tokensRaw, costRaw] = await Promise.all([
      redis.get(tokenKey),
      redis.get(costKey),
    ]);

    const tokensUsedToday = tokensRaw ? parseInt(tokensRaw, 10) : 0;
    const costUsedToday = costRaw ? parseFloat(costRaw) : 0.0;

    const { tokenLimit, costLimit } = await this.getTenantLimits(tenantId);

    let allowed = true;
    let reason: BudgetStatus['reason'] = undefined;

    if (tokensUsedToday >= tokenLimit) {
      allowed = false;
      reason = 'token_limit_exceeded';
    } else if (costUsedToday >= costLimit) {
      allowed = false;
      reason = 'cost_limit_exceeded';
    }

    return {
      allowed,
      ...(reason ? { reason } : {}),
      tokensUsedToday,
      tokenLimit,
      costUsedToday,
      costLimit,
    };
  }

  /**
   * Atomically increment a tenant's daily usage counters with 24-hour expiration checks
   */
  public static async incrementUsage(
    tenantId: string,
    tokens: number,
    cost: number
  ): Promise<void> {
    const redis = getRedisClient();
    const tokenKey = this.getTokenKey(tenantId);
    const costKey = this.getCostKey(tenantId);

    try {
      // 1. Increment tokens
      const newTokenCount = await redis.incrby(tokenKey, tokens);
      // If the count equals the incremented value, this is a new key; set 24h TTL.
      if (newTokenCount === tokens) {
        await redis.expire(tokenKey, 86400); // 24 Hours
      }

      // 2. Increment cost
      const newCostCountStr = await redis.incrbyfloat(costKey, cost);
      const newCostCount = parseFloat(newCostCountStr);
      // Cost comparison accounting for small JS floating point variances
      if (Math.abs(newCostCount - cost) < 0.00001) {
        await redis.expire(costKey, 86400); // 24 Hours
      }

      logger.info(`[TokenBudget] Incremented usage`, {
        tenantId,
        addedTokens: tokens,
        totalTokens: newTokenCount,
        addedCost: cost,
        totalCost: newCostCount,
      });
    } catch (error: any) {
      logger.error(`[TokenBudget] Failed to increment usage counters`, {
        tenantId,
        error: error.message,
      });
    }
  }

  /**
   * Manual reset method for debugging or admin UI panel overrides
   */
  public static async resetBudget(tenantId: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(this.getTokenKey(tenantId), this.getCostKey(tenantId));
    logger.warn(`[TokenBudget] Daily counters reset manually by administrator`, { tenantId });
  }
}
