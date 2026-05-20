import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseJsClient, SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export type UserRole = 'admin' | 'user' | 'owner' | 'agent' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  role: UserRole
  organizationId: string
}

/**
 * Returns the authenticated user from the Supabase JWT.
 * Uses getUser() (network-verified) not getSession() (cookie-only, spoofable).
 * Returns null if not authenticated.
 */
export async function getServerUser(): Promise<AuthUser | null> {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, organization_id')
      .eq('id', user.id)
      .single()

    if (!profile) return null

    if (!profile.organization_id) {
      logger.warn({ userId: user.id }, 'User has no organization_id — treating as unauthenticated for API/UI guards')
      return null
    }

    return {
      id: user.id,
      email: user.email!,
      role: (profile.role as UserRole) ?? 'user',
      organizationId: profile.organization_id as string,
    }
  } catch {
    return null
  }
}

/**
 * Server Component guard. Redirects to /auth/login if not authenticated.
 * Usage: const user = await requireAuth()
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getServerUser()
  if (!user) {
    redirect('/auth/login')
  }
  return user
}

/**
 * Server Component guard. Redirects to /dashboard if authenticated user is not admin.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== 'admin') {
    logger.warn({ userId: user.id }, 'Non-admin attempted admin route')
    redirect('/dashboard')
  }
  return user
}

export interface ApiAuthUser {
  id: string
  email: string
  role: UserRole
  tenant_id: string
}

/**
 * Auto-provisions a tenant, tenant_members row, and profile for a brand-new user.
 * Called as a fallback when requireAuthApi finds a valid JWT but no tenant context.
 */
async function autoProvisionTenant(
  supabase: SupabaseClient,
  user: { id: string; email: string; user_metadata?: any }
): Promise<{ tenantId: string; role: UserRole } | null> {
  let tenantId: string | null = null
  try {
    const meta = user.user_metadata || {}

    // Generate safe, unique slug for tenant matching DB autoprovision structure
    const orgName = meta.organization_name || 'My Business'
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + user.id.substring(0, 6)

    // 1. Create tenant (Removing non-existent owner_id column)
    const { data: newTenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        name: orgName,
        slug,
        whatsapp_number: meta.whatsapp_number || '',
        support_email: meta.support_email || '',
        industry_ecosystem: meta.industry_ecosystem || 'dental',
      })
      .select('id')
      .single()

    if (tenantErr || !newTenant) {
      throw new Error(`Failed to create tenant: ${tenantErr?.message || 'Empty result'}`)
    }

    tenantId = newTenant.id as string

    // 2. Create tenant_members row (Replacing 'owner' with allowed 'admin' role)
    const { error: memberErr } = await supabase
      .from('tenant_members')
      .insert({ user_id: user.id, tenant_id: tenantId, role: 'admin' })

    if (memberErr) {
      throw new Error(`Failed to create tenant member entry: ${memberErr.message}`)
    }

    // 3. Upsert profile (Replacing 'owner' with allowed 'admin' role)
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: meta.full_name || '',
        role: 'admin',
        organization_id: tenantId,
      })

    if (profileErr) {
      throw new Error(`Failed to upsert profile: ${profileErr.message}`)
    }

    logger.info({ userId: user.id, tenantId }, 'Auto-provisioned tenant successfully for new user')
    return { tenantId, role: 'admin' }
  } catch (err: any) {
    logger.error('[Auto-provision] Transaction failed, triggering rollback', err)
    
    // Transaction Rollback Safety: Clean up partially created records to prevent orphaned states
    if (tenantId) {
      logger.info({ tenantId }, '[Auto-provision] Rollback: Deleting partially created tenant')
      await supabase.from('tenants').delete().eq('id', tenantId)
    }
    return null
  }
}

/**
 * API Route guard. Returns a 401 JSON response if the request is unauthenticated.
 * Usage: const { user, supabase, error } = await requireAuthApi(request)
 *
 * Auth flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify token with Supabase (getUser — network-verified, not cookie-spoofable)
 *   3. Look up tenant_members for tenant context
 *   4. Fallback: look up profiles.organization_id
 *   5. Fallback: auto-provision tenant for brand-new users (no DB rows yet)
 */
export async function requireAuthApi(
  _request: NextRequest
): Promise<
  | { user: ApiAuthUser; supabase: SupabaseClient; error: null }
  | { user: null; supabase: null; error: NextResponse }
> {
  try {
    // ── 1. Extract token ──────────────────────────────────────────────────
    const authHeader = _request.headers.get('Authorization')
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : undefined

    // ── 2. Build Supabase client ──────────────────────────────────────────
    let supabase: SupabaseClient
    if (token) {
      // Stateless client that strictly honors the incoming Bearer token.
      // Bypasses all cookie contexts — safe for API routes called from the browser.
      supabase = createSupabaseJsClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        }
      )
    } else {
      // Fallback: SSR client using Next.js cookies (e.g. server-to-server calls)
      supabase = createClient()
    }

    // ── 3. Verify token — getUser() is network-verified (not spoofable) ───
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      logger.warn({ tokenPresent: !!token, err: authError?.message }, 'Unauthenticated API request rejected')
      return {
        user: null,
        supabase: null,
        error: NextResponse.json(
          {
            error: 'Unauthorized',
            code: 'NO_USER',
            details: authError?.message || 'Token absent or invalid',
            tokenPresent: !!token,
          },
          { status: 401 }
        ),
      }
    }

    // ── 4. Resolve tenant — tenant_members (primary) ──────────────────────
    const { data: member, error: memberDbError } = await supabase
      .from('tenant_members')
      .select('role, tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    let tenantId = member?.tenant_id as string | undefined
    let role: UserRole = (member?.role as UserRole) ?? 'user'

    // ── 5. Resolve tenant — profiles fallback ─────────────────────────────
    let profileDbError = null
    if (!tenantId) {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .maybeSingle()

      profileDbError = profileErr
      if (profile?.organization_id) {
        tenantId = profile.organization_id as string
        role = (profile.role as UserRole) ?? 'user'
      }
    }

    // ── 6. Auto-provision for brand-new users ─────────────────────────────
    if (!tenantId) {
      logger.warn({ userId: user.id }, 'No tenant found — attempting auto-provision for new user')

      const provisioned = await autoProvisionTenant(supabase, {
        id: user.id,
        email: user.email!,
        user_metadata: user.user_metadata,
      })

      if (!provisioned) {
        // Auto-provision failed — user genuinely has no tenant access
        logger.warn(
          { userId: user.id, memberDbError: memberDbError?.message, profileDbError: profileDbError?.message },
          'Auto-provision failed — rejecting request'
        )
        return {
          user: null,
          supabase: null,
          error: NextResponse.json(
            {
              error: 'Unauthorized',
              code: 'NO_TENANT',
              details: 'User account is not associated with any organisation. Please complete registration.',
            },
            { status: 401 }
          ),
        }
      }

      tenantId = provisioned.tenantId
      role = provisioned.role
    }

    // ── 7. Return authenticated context ───────────────────────────────────
    return {
      user: {
        id: user.id,
        email: user.email!,
        role,
        tenant_id: tenantId,
      },
      supabase,
      error: null,
    }
  } catch (err: any) {
    logger.error({}, 'requireAuthApi: unexpected exception', err)
    return {
      user: null,
      supabase: null,
      error: NextResponse.json(
        { error: 'Unauthorized', code: 'EXCEPTION', details: err?.message || String(err) },
        { status: 401 }
      ),
    }
  }
}

/**
 * API Route guard for admin-only endpoints.
 */
export async function requireAdminApi(
  request: NextRequest
): Promise<
  | { user: ApiAuthUser; supabase: SupabaseClient; error: null }
  | { user: null; supabase: null; error: NextResponse }
> {
  const result = await requireAuthApi(request)
  if (result.error) return { user: null, supabase: null, error: result.error }

  if (result.user.role !== 'admin') {
    logger.warn({ userId: result.user.id }, 'Privilege escalation attempt rejected')
    return {
      user: null,
      supabase: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return result
}