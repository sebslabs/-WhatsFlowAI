/**
 * Tenant Middleware — Fixed
 *
 * CHANGES:
 * - injectTenantId now injects tenant_id (not organization_id) into req.body
 * - Strips both organization_id and user_id from client payloads
 */
import type { Request, Response, NextFunction } from 'express'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { extractAccessToken } from '../utils/auth-token.js'

declare global {
  namespace Express {
    interface Request {
      tenantDb?: SupabaseClient
      adminDb?: SupabaseClient
    }
  }
}

/**
 * Attaches a user-JWT-scoped Supabase client (RLS active) to req.tenantDb.
 * Must run after authenticate().
 */
export function attachTenantDb(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = extractAccessToken(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing token' })
    return
  }

  req.tenantDb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  next()
}

/**
 * Service-role client — only for privileged internal operations.
 * NEVER expose to client-facing routes.
 */
export function attachAdminDb(req: Request, _res: Response, next: NextFunction): void {
  req.adminDb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  next()
}

/**
 * Injects the authenticated user's tenant_id into req.body.
 * Prevents client-supplied tenant_id or organization_id overrides.
 * Must run after authenticate().
 */
export function injectTenantId(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.tenantId) {
    res.status(401).json({ error: 'Unauthorized: no tenant' })
    return
  }

  if (req.body && typeof req.body === 'object') {
    // Canonical field — always injected server-side
    req.body.tenant_id = req.user.tenantId
    // Strip legacy/dangerous client-supplied fields
    delete req.body.organization_id
    delete req.body.user_id
  }

  next()
}
