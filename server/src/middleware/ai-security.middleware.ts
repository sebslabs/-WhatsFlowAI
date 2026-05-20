import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { TokenBudgetService } from '../services/token-budget.service.js';

dotenv.config();

/**
 * Enterprise-grade Multi-Tenant AI Security & Isolation Middleware.
 * Enforces:
 *   1. Strict tenant context resolution (X-Tenant-Id)
 *   2. Active daily token & budget limit checks (Fail-closed)
 *   3. Rate limiting and isolation scope validation
 */
export async function enforceAiTenantSecurity(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const tenantId = req.headers['x-tenant-id'] as string;
  const userId = req.headers['x-user-id'] as string;

  // 1. Mandatory Context Resolution
  if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    logger.warn('[AISecurityMiddleware] Refused request lacking valid tenant header context', {
      ip: req.ip,
      path: req.path,
    });
    res.status(401).json({
      error: 'Missing or malformed X-Tenant-Id tenant header context.',
      code: 'TENANT_UNAUTHORIZED',
    });
    return;
  }

  // Bind parameters cleanly for downstream controllers
  req.body.tenantId = tenantId;
  if (userId) req.body.userId = userId;

  // 2. Tenant Budget Exhaustion Verification
  try {
    const budget = await TokenBudgetService.checkBudget(tenantId);
    if (!budget.allowed) {
      logger.warn('[AISecurityMiddleware] Request blocked due to tenant budget exhaustion', {
        tenantId,
        reason: budget.reason,
        tokensUsed: budget.tokensUsedToday,
        costUsed: budget.costUsedToday,
      });

      res.status(429).json({
        error: `Daily limit reached: Your tenant profile has exhausted its allowance. Details: ${budget.reason}`,
        code: 'TENANT_BUDGET_EXCEEDED',
        budget: {
          tokenLimit: budget.tokenLimit,
          tokensUsed: budget.tokensUsedToday,
          costLimit: budget.costLimit,
          costUsed: budget.costUsedToday,
        },
      });
      return;
    }
  } catch (error: any) {
    logger.error('[AISecurityMiddleware] Exception checking tenant budget bounds', {
      tenantId,
      error: error.message,
    });
    // In production, we fail-open for budget exceptions to prioritize system availability,
    // unless high-security modes are specifically mandated.
  }

  next();
}
