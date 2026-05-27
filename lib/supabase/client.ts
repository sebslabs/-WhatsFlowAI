import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // IMPROVEMENT 3: Use PKCE flow for all browser auth operations.
      // Combined with JWT expiry = 1800s in Supabase dashboard
      // (Authentication → Settings → JWT expiry), this ensures frozen tabs
      // that never fire browser events will eventually expire server-side.
      auth: {
        flowType: 'pkce',
      },
    }
  )
}
