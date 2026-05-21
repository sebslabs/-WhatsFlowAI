/**
 * Auth Middleware — Fixed
 *
 * CHANGES:
 * - organizationId renamed to tenantId in req.user
 * - Reads tenant_id from tenant_members (not organization_id from profiles)
 * - Profiles.organization_id kept as fallback for backward compat (it maps to tenant_id)
 */
import type { Request, Response, NextFunction } from 'express'
import { createClient } from '@supabase/supabase-js'
import { extractAccessToken } from '../utils/auth-token.js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        email: string
        role: 'admin' | 'agent' | 'viewer' | 'user'
        /** Canonical tenant UUID — ALWAYS use this, never organization_id */
        tenantId: string
        /** @deprecated use tenantId — kept for controllers that haven't migrated yet */
        organizationId: string
      }
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractAccessToken(req)

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: missing token' })
    return
  }

  try {
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error,
    } = await userSupabase.auth.getUser()

    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized: invalid token' })
      return
    }

    const adminSupabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Resolve tenant from tenant_members (authoritative) or profiles.organization_id (legacy)
    const { data: memberRow } = await adminSupabase
      .from('tenant_members')
      .select('tenant_id, role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    let tenantId: string | null = memberRow?.tenant_id ?? null
    let role: string = memberRow?.role ?? 'viewer'

    // Fallback to profiles.organization_id for legacy compatibility
    if (!tenantId) {
      const { data: profile } = await adminSupabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', user.id)
        .single()

      tenantId = profile?.organization_id ?? null
      role = profile?.role ?? 'viewer'
    }

    if (!tenantId) {
      res.status(403).json({ error: 'Forbidden: account has no tenant association' })
      return
    }

    req.user = {
      id: user.id,
      email: user.email!,
      role: role as 'admin' | 'agent' | 'viewer' | 'user',
      tenantId,
      organizationId: tenantId, // Alias for backward compat
    }

    next()
  } catch (err) {
    console.error('[auth.middleware] Token verification failed:', err)
    res.status(401).json({ error: 'Unauthorized: token verification failed' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden: admin only' })
    return
  }
  next()
}
