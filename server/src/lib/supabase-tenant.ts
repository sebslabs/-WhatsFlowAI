import type { Request } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { extractAccessToken } from '../utils/auth-token.js'

/**
 * Supabase client scoped to the caller's JWT — RLS policies apply.
 * Never use the service-role client for user-facing CRUD.
 */
export function createTenantSupabaseClient(req: Request): SupabaseClient {
  const token = extractAccessToken(req)
  if (!token) {
    throw new Error('Missing access token')
  }
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}
