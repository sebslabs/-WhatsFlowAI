import type { Request } from 'express'

/**
 * Extract Supabase JWT from Authorization header or sb-access-token cookie.
 * Must match auth.middleware token extraction for consistent tenant scoping.
 */
export function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }
  const cookie = req.cookies?.['sb-access-token']
  if (cookie) return cookie
  return null
}
