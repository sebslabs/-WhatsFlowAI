import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    // Direct match against PROD tables schema
    const { data, error: dbErr } = await supabase
      .from('whatsapp_accounts')
      .select('phone_number_id, business_account_id, status, updated_at, metadata')
      .eq('tenant_id', user.tenant_id)
      .maybeSingle()

    if (dbErr) throw dbErr

    const host = request.headers.get('host') || 'localhost:3000'
    const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http'
    
    // Point upstream hooks directly to Next.js receiver instance
    const webhook_url = `${proto}://${host}/api/webhooks/whatsapp?tenantId=${user.tenant_id}`

    if (!data) {
      return NextResponse.json({ status: 'disconnected', webhook_url })
    }

    // Standardize mapping to keep frontend dashboard states fully compatible
    const metaObj = typeof data.metadata === 'object' ? data.metadata : {}
    
    // SECURITY FIX (CRITICAL #3): Never expose a hardcoded default verify token.
    // Return null if no tenant-specific token is stored — callers must configure it.
    return NextResponse.json({
      phone_number_id: data.phone_number_id,
      waba_id: data.business_account_id,
      verify_token: (metaObj as any)?.verify_token || null,
      display_name: (metaObj as any)?.display_name || null,
      display_phone_number: (metaObj as any)?.display_phone_number || null,
      status: data.status,
      updated_at: data.updated_at,
      webhook_url
    })

  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { error: dbErr } = await supabase
      .from('whatsapp_accounts')
      .delete()
      .eq('tenant_id', user.tenant_id)

    if (dbErr) throw dbErr

    return NextResponse.json({ success: true, message: 'WhatsApp account disconnected' })
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: err.message },
      { status: 500 }
    )
  }
}
