import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    
    // Queries stats from the leads table using tenant isolation
    const { data: leads, error: dbError } = await supabase
      .from('leads')
      .select('stage')
      .eq('tenant_id', user.tenant_id)

    if (dbError) throw dbError

    const totalLeads = leads?.length || 0
    const bookedLeads = leads?.filter((l: any) => l.stage?.toLowerCase() === 'booked').length || 0
    const conversionRate = totalLeads > 0 ? Math.round((bookedLeads / totalLeads) * 100) : 0

    return NextResponse.json({
      totalLeads,
      bookedLeads,
      conversionRate,
      totalBooked: bookedLeads,
    })
  } catch (err) {
    logger.error({ userId: user.id }, 'GET /api/stats failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
