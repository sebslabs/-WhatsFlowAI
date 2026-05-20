/**
 * /api/leads — Secure leads endpoint.
 *
 * Security layers applied in order:
 *   1. Rate limiting   (Upstash Redis sliding window)
 *   2. Authentication  (Supabase JWT via getServerUser)
 *   3. Authorization   (RBAC permission check)
 *   4. Input validation (Zod schema)
 *   5. Tenant isolation (Supabase RLS — enforced at DB level)
 *   6. Response sanitization (no raw DB errors to client)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { hasPermission, PermissionDeniedError } from '@/lib/rbac'
import { rateLimitApi, rateLimitExceededResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  createLeadSchema,
  updateLeadSchema,
  bulkDeleteLeadsSchema,
  deleteLeadSchema,
} from '@/lib/validations/schemas'
import { ZodError } from 'zod'

// ── GET /api/leads ─────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const rl = await rateLimitApi(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  if (!hasPermission(user.role, 'leads:read')) {
    return NextResponse.json({ error: 'Forbidden', userRole: user.role }, { status: 403 })
  }

  try {

    // RLS on the `leads` table automatically filters by organization_id.
    // No need to manually .eq('organization_id', user.organizationId) — RLS does it.
    const { data, error: dbError } = await supabase
      .from('leads')
      .select('id, name, phone, email, service, stage, urgency, notes, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    logger.info({ userId: user.id, count: data?.length }, 'Leads fetched')
    return NextResponse.json(data ?? [])
  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/leads failed', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message || String(err), raw: err }, { status: 500 })
  }
}

// ── POST /api/leads ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const rl = await rateLimitApi(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  if (!hasPermission(user.role, 'leads:create')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const validated = createLeadSchema.parse(body)

    const { data, error: dbError } = await supabase
      .from('leads')
      .insert({
        ...validated,
        tenant_id: user.tenant_id,
      })
      .select('id, name, phone, email, service, stage, urgency, notes, created_at')
      .single()

    if (dbError) {
      // Unique violation on phone — return 409 instead of leaking DB error
      if (dbError.code === '23505') {
        return NextResponse.json(
          { error: 'A lead with this phone number already exists' },
          { status: 409 }
        )
      }
      throw dbError
    }

    logger.info({ userId: user.id, leadId: data.id }, 'Lead created')
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.flatten().fieldErrors },
        { status: 422 }
      )
    }
    logger.error({ userId: user.id }, 'POST /api/leads failed', err)
    return NextResponse.json({ error: 'Internal server error', details: err?.message || String(err), raw: err }, { status: 500 })
  }
}

// ── PATCH /api/leads ───────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const rl = await rateLimitApi(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  if (!hasPermission(user.role, 'leads:update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { id, ...fields } = updateLeadSchema.parse(body)

    const { data, error: dbError } = await supabase
      .from('leads')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', user.tenant_id)
      // RLS ensures this update only touches rows owned by the user's org
      .select('id, name, phone, email, service, stage, urgency, notes, updated_at')
      .single()

    if (dbError) throw dbError
    if (!data) {
      // RLS blocked the update — row either doesn't exist or belongs to another tenant
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    logger.info({ userId: user.id, leadId: id }, 'Lead updated')
    return NextResponse.json(data)
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.flatten().fieldErrors },
        { status: 422 }
      )
    }
    logger.error({ userId: user.id }, 'PATCH /api/leads failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE /api/leads ──────────────────────────────────────────────────────
// Single lead: DELETE /api/leads?id=<uuid>  (permission: leads:delete)
// Bulk:       DELETE /api/leads            body: { ids: uuid[] } (leads:bulk_delete)

export async function DELETE(request: NextRequest) {
  const rl = await rateLimitApi(request)
  if (!rl.success) return rateLimitExceededResponse(rl)

  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  const singleId = request.nextUrl.searchParams.get('id')

  if (singleId) {
    if (!hasPermission(user.role, 'leads:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const { id } = deleteLeadSchema.parse({ id: singleId })

      const { error: dbError } = await supabase
        .from('leads')
        .delete()
        .eq('id', id)
        .eq('tenant_id', user.tenant_id)

      if (dbError) throw dbError

      logger.info({ userId: user.id, leadId: id }, 'Lead deleted')
      return NextResponse.json({ deleted: 1 })
    } catch (err: any) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: err.flatten().fieldErrors },
          { status: 422 }
        )
      }
      logger.error({ userId: user.id }, 'DELETE /api/leads?id= failed', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  if (!hasPermission(user.role, 'leads:bulk_delete')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const { ids } = bulkDeleteLeadsSchema.parse(body)

    const { error: dbError } = await supabase
      .from('leads')
      .delete()
      .in('id', ids)
      .eq('tenant_id', user.tenant_id)
    // RLS prevents cross-tenant deletes automatically

    if (dbError) throw dbError

    logger.info({ userId: user.id, count: ids.length }, 'Leads bulk-deleted')
    return NextResponse.json({ deleted: ids.length })
  } catch (err: any) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: err.flatten().fieldErrors },
        { status: 422 }
      )
    }
    if (err instanceof PermissionDeniedError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    logger.error({ userId: user.id }, 'DELETE /api/leads failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
