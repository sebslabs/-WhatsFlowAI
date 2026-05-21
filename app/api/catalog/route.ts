import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth'
import { logger } from '@/lib/logger'

// GET /api/catalog — Retrieves all catalog items scoped to the current tenant
export async function GET(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  try {
    // PERFORMANCE FIX: Explicit columns — avoids select('*') over-fetch
    const { data, error: dbError } = await supabase
      .from('catalog_products')
      .select('id, name, type, description, price, compare_price, sku, category, stock, image_url, images, url, status, created_at, updated_at')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (dbError) throw dbError

    return NextResponse.json(data || [])
  } catch (err: any) {
    logger.error({ userId: user.id }, 'GET /api/catalog failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}

// POST /api/catalog — Creates a new product or service in the catalog
export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request)
  if (error) return error

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  try {
    const payload = {
      name: body.name,
      type: body.type || 'product',
      description: body.description || null,
      price: parseFloat(body.price) || 0,
      compare_price: body.compare_price ? parseFloat(body.compare_price) : null,
      sku: body.sku || null,
      category: body.category || 'General',
      stock: parseInt(body.stock) || 0,
      image_url: body.image_url || (body.images && body.images[0]) || null,
      images: body.images || [],
      url: body.url || null,
      status: body.status || 'active',
      tenant_id: user.tenant_id, // Injected securely from token
    }

    const { data, error: dbError } = await supabase
      .from('catalog_products')
      .insert([payload])
      .select()
      .single()

    if (dbError) throw dbError

    logger.info({ userId: user.id, productId: data.id }, 'Catalog item created')
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/catalog failed', err)
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    )
  }
}
