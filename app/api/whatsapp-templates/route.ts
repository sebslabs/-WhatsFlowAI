import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { assertPermission } from '@/lib/rbac'

// Maps database lowercase status enum to frontend uppercase statuses
function mapDbToFrontend(template: any) {
  let status = 'PENDING'
  const dbStatus = String(template.status).toLowerCase()
  if (dbStatus === 'approved') status = 'APPROVED'
  else if (dbStatus === 'rejected') status = 'REJECTED'
  else if (dbStatus === 'pending') status = 'PENDING'

  return {
    ...template,
    status,
    category: String(template.category || 'MARKETING').toUpperCase()
  }
}

// Maps frontend uppercase statuses to database lowercase safe values
function mapFrontendToDb(template: any) {
  let status = 'pending'
  const clientStatus = String(template.status).toUpperCase()
  if (clientStatus === 'APPROVED') status = 'approved'
  else if (clientStatus === 'REJECTED') status = 'rejected'
  else if (clientStatus === 'PENDING' || clientStatus === 'DRAFT') status = 'pending'

  return {
    id: template.id,
    name: template.name,
    language: template.language || 'en_US',
    category: String(template.category || 'MARKETING').toLowerCase(),
    status,
    components: template.components || [],
    meta_template_id: template.meta_template_id || null,
    updated_at: new Date().toISOString()
  }
}

// GET /api/whatsapp-templates — Fetches all templates for the tenant with enum normalization
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'templates:read')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    // PERFORMANCE FIX: Explicit columns — avoids select('*') over-fetch
    const { data, error: dbError } = await supabase
      .from('whatsapp_templates')
      .select('id, name, language, category, status, components, meta_template_id, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    const mapped = (data || []).map(mapDbToFrontend)
    return NextResponse.json(mapped)

  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/whatsapp-templates failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// POST /api/whatsapp-templates — Creates or saves edits to an existing WhatsApp message template
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'templates:create')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    // Map to the DB-safe shape and inject tenant isolation context
    const dbPayload = {
      ...mapFrontendToDb(body),
      tenant_id: user.tenant_id
    }

    // Clean client-side UUID if it's a randomized placeholder so Postgres gen_random_uuid() executes
    if (String(dbPayload.id).startsWith('wt-')) {
      delete (dbPayload as any).id
    }

    // Pre-verify ownership if an existing ID is supplied to prevent spoofed row takeovers
    const existingId = dbPayload.id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existingId || '')

    if (isUuid) {
      const { data: ownerCheck } = await supabase
        .from('whatsapp_templates')
        .select('tenant_id')
        .eq('id', existingId)
        .maybeSingle()

      if (ownerCheck && ownerCheck.tenant_id !== user.tenant_id) {
        logger.warn({ userId: user.id, attemptedId: existingId }, 'Cross-tenant template modification blocked')
        return NextResponse.json({ error: 'Forbidden: ownership validation failed' }, { status: 403 })
      }
    }

    const { data, error: dbError } = await supabase
      .from('whatsapp_templates')
      .upsert(dbPayload, { onConflict: 'id' })
      .select()
      .single()

    if (dbError) throw dbError

    logger.info({ userId: user.id, templateId: data.id }, 'WhatsApp template saved successfully')
    return NextResponse.json(mapDbToFrontend(data))

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/whatsapp-templates failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
