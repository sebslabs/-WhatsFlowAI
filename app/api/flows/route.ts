import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { assertPermission } from '@/lib/rbac'

// GET /api/flows — Reconstitutes automated workflow objects from relational table + definition payload
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'flows:read')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    // MEDIUM FIX (#5): Explicit column list — avoids over-fetching unused DB columns.
    const { data, error: dbError } = await supabase
      .from('chatbot_flows')
      .select('id, name, is_active, trigger_type, trigger_keyword, definition, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    // Translate database constraints into readable frontend Flow interfaces
    const formatted = (data || []).map((row: any) => {
      // Look inside JSONB definition block for UI specifics
      const def = row.definition || {}
      const isArray = Array.isArray(def)
      
      return {
        id: row.id,
        name: row.name,
        active: row.is_active ?? false,
        triggerType: !isArray && def.triggerType ? def.triggerType : (row.trigger_type === 'catch_all' ? 'first_message' : row.trigger_type || 'keyword'),
        triggerKeyword: row.trigger_keyword || '',
        steps: isArray ? def : (def.steps || [])
      }
    })

    return NextResponse.json(formatted)

  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/flows failed', err)
    return NextResponse.json({ error: err.message || 'Failed to load automation flows' }, { status: 500 })
  }
}

// POST /api/flows — Saves workflows into chatbot_flows safely avoiding PostgreSQL CHECK constraint violations
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    assertPermission(user.role, 'flows:create')
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 403 })
  }

  try {
    const flow = await request.json()
    const { id, name, active, triggerType, triggerKeyword, steps } = flow

    // Strictly align triggers with DB check constraint ('keyword', 'catch_all', 'api', 'manual')
    let safeDbTrigger = 'catch_all'
    if (triggerType === 'keyword') {
      safeDbTrigger = 'keyword'
    } else if (triggerType === 'manual') {
      safeDbTrigger = 'manual'
    }

    const row: any = {
      tenant_id: user.tenant_id,
      name: name || 'Untitled Flow',
      is_active: active ?? false,
      trigger_type: safeDbTrigger,
      trigger_keyword: triggerKeyword || '',
      // Store the UI trigger specifics & full steps nested safely inside the JSONB definition!
      definition: {
        triggerType: triggerType || 'keyword',
        steps: steps || []
      },
      updated_at: new Date().toISOString()
    }

    // Only pass valid UUID strings
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')
    if (isUuid) {
      row.id = id
    }

    // Pre-verify ownership if an existing ID is supplied to prevent spoofed row takeovers
    if (isUuid) {
      const { data: ownerCheck } = await supabase
        .from('chatbot_flows')
        .select('tenant_id')
        .eq('id', id)
        .maybeSingle()

      if (ownerCheck && ownerCheck.tenant_id !== user.tenant_id) {
        logger.warn({ userId: user.id, attemptedId: id }, 'Cross-tenant chatbot flow modification blocked')
        return NextResponse.json({ error: 'Forbidden: ownership validation failed' }, { status: 403 })
      }
    }

    const { data, error: dbError } = await supabase
      .from('chatbot_flows')
      .upsert([row])
      .select()
      .single()

    if (dbError) throw dbError

    return NextResponse.json({
      id: data.id,
      name: data.name,
      active: data.is_active,
      triggerType: data.definition?.triggerType || data.trigger_type,
      triggerKeyword: data.trigger_keyword,
      steps: data.definition?.steps || []
    })

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/flows failed', err)
    return NextResponse.json({ error: err.message || 'Failed to save automation flow' }, { status: 500 })
  }
}
