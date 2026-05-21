import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

type RouteParams = { params: { id: string } }

// PUT /api/catalog/[id] — Updates an existing catalog product or service
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const updatePayload = {
      name: body.name,
      type: body.type,
      description: body.description,
      price: body.price !== undefined ? parseFloat(body.price) : undefined,
      compare_price: body.compare_price !== undefined ? (body.compare_price ? parseFloat(body.compare_price) : null) : undefined,
      sku: body.sku,
      category: body.category,
      stock: body.stock !== undefined ? parseInt(body.stock) : undefined,
      image_url: body.image_url || (body.images && body.images[0]) || null,
      images: body.images,
      url: body.url,
      status: body.status,
      updated_at: new Date().toISOString(),
    }

    // Clean undefined properties so they aren't updated
    Object.keys(updatePayload).forEach(
      (key) => (updatePayload as any)[key] === undefined && delete (updatePayload as any)[key]
    )

    const { data, error: dbError } = await supabase
      .from('catalog_products')
      .update(updatePayload)
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Security scope
      .select()
      .single()

    if (dbError) throw dbError

    logger.info({ userId: user.id, productId: id }, 'Catalog item updated')
    return NextResponse.json(data)
  } catch (err: any) {
    logger.error({ userId: user.id, productId: id }, 'PUT /api/catalog/[id] failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// DELETE /api/catalog/[id] — Deletes a catalog product or service
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    const { error: dbError } = await supabase
      .from('catalog_products')
      .delete()
      .eq('id', id)
      .eq('tenant_id', user.tenant_id) // Security scope

    if (dbError) throw dbError

    logger.info({ userId: user.id, productId: id }, 'Catalog item deleted')
    return NextResponse.json({ success: true })
  } catch (err: any) {
    logger.error({ userId: user.id, productId: id }, 'DELETE /api/catalog/[id] failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
