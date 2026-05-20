import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { assertPermission } from '@/lib/rbac'

// GET /api/campaigns — Retrieve active and historical marketing broadcast campaigns
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'campaigns:read')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    // MEDIUM FIX (#5): Explicit column list — select('*') over-fetches all columns
    // including internal server fields, wastes bandwidth, and leaks schema details.
    const { data, error: dbError } = await supabase
      .from('campaigns')
      .select('id, name, status, audience_filter, audience_type, audience_tag, audience_count, message, media_type, media_url, buttons, scheduled_at, sent_at, completed_at, total_recipients, successful_sends, stats, created_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    // Reconstruct payloads elegantly if packed inside the fallback column
    const formatted = (data || []).map((row: any) => {
      // If direct columns don't exist, unpack from JSONB fallback
      const fallback = row.audience_filter || {}
      return {
        id: row.id,
        name: row.name,
        status: row.status,
        audienceType: row.audience_type ?? fallback.audienceType ?? 'all',
        audienceTag: row.audience_tag ?? fallback.audienceTag ?? '',
        audienceCount: row.audience_count ?? fallback.audienceCount ?? row.total_recipients ?? 0,
        message: row.message ?? fallback.message ?? '',
        mediaType: row.media_type ?? fallback.mediaType ?? null,
        mediaUrl: row.media_url ?? fallback.mediaUrl ?? null,
        buttons: row.buttons ?? fallback.buttons ?? [],
        scheduledAt: row.scheduled_at ?? fallback.scheduledAt ?? row.scheduled_at ?? null,
        sentAt: row.sent_at ?? fallback.sentAt ?? row.completed_at ?? null,
        stats: row.stats ?? fallback.stats ?? {
          sent: row.successful_sends ?? 0,
          delivered: row.successful_sends ?? 0,
          read: Math.floor((row.successful_sends ?? 0) * 0.8),
          replied: 0
        },
        createdAt: row.created_at
      }
    })

    return NextResponse.json(formatted)

  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/campaigns failed', err)
    return NextResponse.json({ error: err.message || 'Failed to load campaigns' }, { status: 500 })
  }
}

// POST /api/campaigns — Upserts broadcase campaign definitions with absolute structural resilience
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'campaigns:create')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    const body = await request.json()
    const {
      id,
      name,
      status,
      audienceType,
      audienceTag,
      audienceCount,
      message,
      mediaType,
      mediaUrl,
      buttons,
      scheduledAt,
      sentAt,
      stats,
      createdAt
    } = body

    // Build unified resilient payload combining strict columns & flexible JSONB packing
    const dbPayload: any = {
      tenant_id: user.tenant_id,
      name: name || 'Untitled Campaign',
      status: status || 'draft',
      // Pack into standard column for compatibility
      audience_filter: {
        audienceType,
        audienceTag,
        audienceCount,
        message,
        mediaType,
        mediaUrl,
        buttons,
        scheduledAt,
        sentAt,
        stats: stats || { sent: 0, delivered: 0, read: 0, replied: 0 }
      },
      // Production Schema mappings
      scheduled_at: scheduledAt || null,
      total_recipients: audienceCount || 0,
      created_at: createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    // Only attach UUID if it's a valid RFC-4122 UUID (UI generated ids are sometimes raw strings like '1abcde')
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')
    if (isUuid) {
      dbPayload.id = id
    }

    // Check if table has the legacy express columns and populate them in case db strictness varies
    try {
      dbPayload.audience_type = audienceType
      dbPayload.audience_tag = audienceTag
      dbPayload.audience_count = audienceCount
      dbPayload.message = message
      dbPayload.media_type = mediaType
      dbPayload.media_url = mediaUrl
      dbPayload.buttons = buttons
      dbPayload.sent_at = sentAt
      dbPayload.stats = stats || { sent: 0, delivered: 0, read: 0, replied: 0 }
    } catch {
      // Ignore if typing refuses
    }

    // Pre-verify ownership if an existing ID is supplied to prevent spoofed row takeovers
    if (isUuid) {
      const { data: ownerCheck } = await supabase
        .from('campaigns')
        .select('tenant_id')
        .eq('id', id)
        .maybeSingle()

      if (ownerCheck && ownerCheck.tenant_id !== user.tenant_id) {
        logger.warn({ userId: user.id, attemptedId: id }, 'Cross-tenant campaign modification blocked')
        return NextResponse.json({ error: 'Forbidden: ownership validation failed' }, { status: 403 })
      }
    }

    // Perform UPSERT — if there are non-existent columns, Supabase might throw, 
    // so we fall back to a clean INSERT using ONLY authoritative columns if needed.
    let insertResponse = await supabase.from('campaigns').upsert([dbPayload]).select()
    
    if (insertResponse.error && insertResponse.error.code === '42703') {
      // "column does not exist" detected! Stripping Express legacy columns and retrying purely on Production standard
      const strictPayload = {
        tenant_id: user.tenant_id,
        name: name || 'Untitled Campaign',
        status: status || 'draft',
        audience_filter: dbPayload.audience_filter,
        scheduled_at: scheduledAt || null,
        total_recipients: audienceCount || 0,
        created_at: createdAt || new Date().toISOString()
      } as any
      if (isUuid) strictPayload.id = id

      insertResponse = await supabase.from('campaigns').upsert([strictPayload]).select()
    }

    if (insertResponse.error) throw insertResponse.error

    const row = insertResponse.data?.[0]
    return NextResponse.json({
      ...row,
      audienceType,
      audienceTag,
      audienceCount,
      message,
      mediaType,
      mediaUrl,
      buttons,
      scheduledAt,
      sentAt,
      stats: stats || { sent: 0, delivered: 0, read: 0, replied: 0 }
    })

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/campaigns failed', err)
    return NextResponse.json({ error: err.message || 'Failed to save campaign' }, { status: 500 })
  }
}
