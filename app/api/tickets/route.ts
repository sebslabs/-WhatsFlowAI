import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET /api/tickets — Loads raised tickets from the unified tenant handoff_requests table
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    // MEDIUM FIX (#5): Explicit column list — handoff_requests may contain internal
    // metadata columns not needed by the frontend tickets view.
    const { data, error: dbError } = await supabase
      .from('handoff_requests')
      .select('id, status, reason, conversation_id, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    // Unpack serialized metadata from the 'reason' text column back into standard UI interfaces
    const formatted = (data || []).map((row: any) => {
      const rawReason = row.reason || ''
      
      // Fallback splitting strategy "Subject | Description | Priority: ..."
      const segments = rawReason.split(' | ')
      const subject = segments[0] || 'Support Inquiry'
      const description = segments[1] || rawReason
      
      let priority = 'medium'
      const prioritySegment = segments.find((s: string) => s.toLowerCase().startsWith('priority:'))
      if (prioritySegment) {
        priority = prioritySegment.replace(/priority:/i, '').trim().toLowerCase()
      }

      // Map handoff_status ('pending', 'resolved', etc) to support ticket status
      let ticketStatus = 'open'
      if (row.status === 'resolved') ticketStatus = 'resolved'
      else if (row.status === 'accepted') ticketStatus = 'in-progress'

      return {
        id: row.id.slice(0, 8).toUpperCase(), // Keep displayed IDs clean & professional
        subject,
        description,
        status: ticketStatus,
        priority: priority as 'low' | 'medium' | 'high',
        createdAt: row.created_at
      }
    })

    return NextResponse.json(formatted)

  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/tickets failed', err)
    return NextResponse.json({ error: err.message || 'Failed to load tickets' }, { status: 500 })
  }
}

// POST /api/tickets — Serializes raised support tickets into standard SaaS handoff requests
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const body = await request.json()
    const { subject, description, priority } = body

    // 1. Locate the newest conversation for this tenant to successfully anchor the handoff request
    const { data: latestConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', user.tenant_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Support Tickets act as enterprise level system inquiries, but require an anchor if enforced.
    // If no conversation exists yet, we generate a system anchor automatically if possible.
    let anchorConversationId = latestConv?.id

    if (!anchorConversationId) {
      // Generate fallback generic contact & conversation for internal SaaS telemetry anchoring
      const { data: systemContact } = await supabase
        .from('contacts')
        .insert([{ 
          tenant_id: user.tenant_id, 
          name: 'SaaS System User', 
          phone_number: '+10000000000' 
        }])
        .select()
        .maybeSingle()

      if (systemContact) {
        const { data: systemConv } = await supabase
          .from('conversations')
          .insert([{ 
            tenant_id: user.tenant_id, 
            contact_id: systemContact.id, 
            status: 'open' 
          }])
          .select()
          .maybeSingle()
        
        anchorConversationId = systemConv?.id
      }
    }

    if (!anchorConversationId) {
      return NextResponse.json(
        { error: 'A customer conversation must exist to generate a support anchor. Please simulate a conversation first.' }, 
        { status: 422 }
      )
    }

    // 2. Construct standardized reason string mimicking Express schema
    const normalizedReason = [
      subject || 'Support Request',
      description || 'No description.',
      `Priority: ${priority || 'medium'}`
    ].join(' | ').slice(0, 5000)

    // 3. Insert unified handoff request
    const { data, error: dbError } = await supabase
      .from('handoff_requests')
      .insert([
        {
          tenant_id: user.tenant_id,
          conversation_id: anchorConversationId,
          reason: normalizedReason,
          status: 'pending',
          requested_by_ai: false
        }
      ])
      .select()
      .single()

    if (dbError) throw dbError

    // Return response perfectly matching local state interface
    return NextResponse.json({
      id: data.id.slice(0, 8).toUpperCase(),
      subject: subject,
      description: description,
      status: 'open',
      priority: priority || 'medium',
      createdAt: data.created_at
    })

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/tickets failed', err)
    return NextResponse.json({ error: err.message || 'Failed to submit ticket' }, { status: 500 })
  }
}
