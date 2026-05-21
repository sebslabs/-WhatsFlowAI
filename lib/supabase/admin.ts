import { createClient } from '@supabase/supabase-js'

/**
 * Enterprise-grade server-side Supabase Service Role client singleton.
 * Bypasses RLS constraints safely for backend computations and guarantees
 * a single shared instance across all execution threads in Node.js.
 */
let supabaseAdminSingleton: ReturnType<typeof createClient> | null = null

export function getSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!supabaseAdminSingleton) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceRoleKey) {
      throw new Error('[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in process.env');
    }

    supabaseAdminSingleton = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseAdminSingleton
}

export const supabaseAdmin = getSupabaseAdmin()
