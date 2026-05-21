import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    
    // Queries leads for aggregation with tenant_id isolation
    const { data: leads, error: dbError } = await supabase
      .from('leads')
      .select('created_at, service_interested, stage')
      .eq('tenant_id', user.tenant_id)

    if (dbError) throw dbError

    // Aggregate service statistics
    const serviceMap: Record<string, number> = {}
    leads?.forEach((l: any) => {
      const svc = l.service_interested || 'General'
      serviceMap[svc] = (serviceMap[svc] || 0) + 1
    })
    const serviceStats = Object.entries(serviceMap).map(([service, count]) => ({
      service,
      count,
    }))

    // Aggregate or project daily stats for past 7 days
    const dailyMap: Record<string, { date: string, leads: number, conversions: number }> = {}
    
    // Pre-fill past 7 days list
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      dailyMap[dateStr] = { date: dateStr, leads: 0, conversions: 0 }
    }

    leads?.forEach((l: any) => {
      const dateStr = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (dailyMap[dateStr]) {
        dailyMap[dateStr].leads++
        if (l.stage?.toLowerCase() === 'booked') {
          dailyMap[dateStr].conversions++
        }
      }
    })

    const dailyStats = Object.values(dailyMap)

    return NextResponse.json({
      dailyStats,
      serviceStats,
    })
  } catch (err) {
    logger.error({ userId: user.id }, 'GET /api/analytics failed', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
