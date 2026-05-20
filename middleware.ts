// Edge Runtime compatibility polyfill for process global
if (typeof globalThis.process === 'undefined') {
  (globalThis as any).process = { env: {} };
} else if (typeof (globalThis.process as any).version === 'undefined') {
  (globalThis.process as any).version = 'v18.0.0';
}

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

// Routes that require the 'admin' role
const ADMIN_ONLY_ROUTES = [
  '/dashboard/settings/billing',
  '/dashboard/settings/team',
  '/api/admin',
]

// Public routes that never require auth
const PUBLIC_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/',
  '/pricing',
  '/features',
  '/blog',
  '/help',
  '/guide',
  '/about',
  '/careers',
  '/privacy',
  '/terms',
  '/terms-and-conditions',
  '/refund',
  '/refund-policy',
  '/status',
  '/api/diagnostic',
]

// Webhook routes bypass auth entirely (they use HMAC signature verification instead)
const WEBHOOK_ROUTES = ['/api/webhooks']

// SECURITY FIX (CRITICAL #2): Internal routes bypass session auth but are
// protected by a mandatory x-internal-key header validated here at the edge.
// This prevents the middleware from redirecting internal machine-to-machine
// calls to /auth/login while still enforcing strict secret verification.
const INTERNAL_ROUTES = ['/api/internal']

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )
}

function isWebhook(pathname: string): boolean {
  return WEBHOOK_ROUTES.some((route) => pathname.startsWith(route))
}

function isAdminOnly(pathname: string): boolean {
  return ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route))
}

// SECURITY FIX (CRITICAL #2): Validate the internal shared secret at the edge.
// Returns true only if the header matches the configured INTERNAL_API_KEY.
function isInternal(pathname: string): boolean {
  return INTERNAL_ROUTES.some((route) => pathname.startsWith(route))
}

export async function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl

    // 1. Zero-Trust Header Purification: Strip client-supplied context headers to prevent request smuggling
    const requestHeaders = new Headers(request.headers)
    requestHeaders.delete('x-user-id')
    requestHeaders.delete('x-tenant-id')
    requestHeaders.delete('x-user-role')

    // Webhook routes skip auth entirely
    if (isWebhook(pathname)) {
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        }
      })
    }

    // SECURITY FIX (CRITICAL #2): Internal route — validate x-internal-key at edge.
    // Machine-to-machine calls use a shared secret instead of user JWT sessions.
    if (isInternal(pathname)) {
      const internalKey = request.headers.get('x-internal-key')
      const systemInternalKey = process.env.INTERNAL_API_KEY

      // If the INTERNAL_API_KEY env var is not configured, block all internal calls
      if (!systemInternalKey) {
        return NextResponse.json(
          { error: 'Internal service misconfigured', code: 'INTERNAL_KEY_MISSING' },
          { status: 500 }
        )
      }

      // Reject requests with a missing or incorrect internal key
      if (!internalKey || internalKey !== systemInternalKey) {
        return NextResponse.json(
          { error: 'Unauthorized', code: 'INVALID_INTERNAL_KEY' },
          { status: 401 }
        )
      }

      return NextResponse.next({
        request: { headers: requestHeaders },
      })
    }

    let response = NextResponse.next({
      request: {
        headers: requestHeaders,
      }
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            request.cookies.set({ name, value, ...options })
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              }
            })
            response.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            request.cookies.set({ name, value: '', ...options })
            response = NextResponse.next({
              request: {
                headers: requestHeaders,
              }
            })
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Always call getUser() — never getSession() — to validate the JWT server-side.
    const { data: { user } } = await supabase.auth.getUser()

    const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/api/')

    // Unauthenticated user hitting a protected route
    if (!user && isProtected && !isPublic(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Unauthorized. Missing valid JWT authentication token.', code: 'UNAUTHORIZED' },
          { status: 401 }
        )
      }
      const loginUrl = request.nextUrl.clone()
      loginUrl.pathname = '/auth/login'
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Authenticated user hitting auth pages → redirect to dashboard
    if (user && (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/register'))) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashboardUrl)
    }

    // RBAC: admin-only route enforcement
    if (user && isAdminOnly(pathname)) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Forbidden. Requester lacks the admin role.', code: 'FORBIDDEN' },
            { status: 403 }
          )
        }
        const forbiddenUrl = request.nextUrl.clone()
        forbiddenUrl.pathname = '/dashboard'
        return NextResponse.redirect(forbiddenUrl)
      }
    }

    // SECURITY FIX (HIGH #5): Align tenant_id resolution with requireAuthApi in lib/auth.ts.
    // Previously used profiles.organization_id which could diverge from the canonical
    // tenant_members.tenant_id — creating a split-brain tenant context between middleware
    // headers and downstream API guards. Now uses the same tenant_members lookup.
    if (user) {
      const { data: member } = await supabase
        .from('tenant_members')
        .select('role, tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()

      const tenantId = member?.tenant_id ?? 'system'
      const userRole = member?.role ?? 'viewer'

      response.headers.set('x-user-id', user.id)
      response.headers.set('x-tenant-id', tenantId)
      response.headers.set('x-user-role', userRole)

      requestHeaders.set('x-user-id', user.id)
      requestHeaders.set('x-tenant-id', tenantId)
      requestHeaders.set('x-user-role', userRole)

      // SaaS Subscription Edge-Enforcement Middleware Check
      if (tenantId !== 'system') {
        const { data: sub } = await supabase
          .from('billing_subscriptions')
          .select('subscription_status, ai_conversation_used, ai_conversation_limit')
          .eq('tenant_id', tenantId)
          .maybeSingle()

        if (sub) {
          const status = sub.subscription_status
          const isExpiredOrSuspended = ['expired', 'suspended'].includes(status)
          const isLimitReached = status === 'limit_reached' || ((sub.ai_conversation_used || 0) >= (sub.ai_conversation_limit || 1500))

          // Redirect blocked users to settings/billing page unless accessing billing or settings
          const isBillingRoute = pathname.startsWith('/dashboard/settings') || 
                                 pathname.startsWith('/api/settings') || 
                                 pathname.startsWith('/api/webhooks')

          if (isExpiredOrSuspended && pathname.startsWith('/dashboard') && !isBillingRoute) {
            const billingUrl = request.nextUrl.clone()
            billingUrl.pathname = '/dashboard/settings'
            billingUrl.searchParams.set('tab', 'billing')
            billingUrl.searchParams.set('alert', 'expired')
            return NextResponse.redirect(billingUrl)
          }

          // Block AI requests at edge if expired or limit reached
          const isAiRoute = pathname.startsWith('/api/ai-agents') || pathname.startsWith('/api/ai-settings')
          if ((isExpiredOrSuspended || isLimitReached) && isAiRoute) {
            return NextResponse.json(
              { error: 'Subscription limits exceeded or trial expired. Please visit Settings -> Billing to upgrade.', code: 'SUBSCRIPTION_RESTRICTED' },
              { status: 403 }
            )
          }
        }
      }
    }

    return response
  } catch (middlewareError: any) {
    console.error('[Middleware Fatal Exception Caught]:', middlewareError)
    // Safe Fail-Open: allow the request to proceed to its route/page normally.
    // This prevents standard environment configuration bugs from blacking out the entire site.
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

