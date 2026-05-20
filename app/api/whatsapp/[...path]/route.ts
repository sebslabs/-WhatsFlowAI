import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

async function proxyRequest(request: NextRequest, { params }: { params: { path: string[] } }) {
  const subPath = params.path.join('/')
  const url = new URL(request.url)
  
  // Reconstruct targets to direct them exactly to the active Express ecosystem instance
  const targetUrl = `${BACKEND_API}/api/whatsapp/${subPath}${url.search}`

  const headers = new Headers()
  
  // Clean and inherit only essential headers to bypass CORS and host collision errors
  const allowedHeaders = ['authorization', 'content-type', 'accept', 'x-hub-signature-256']
  request.headers.forEach((value, key) => {
    if (allowedHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith('x-')) {
      headers.append(key, value)
    }
  })

  let body: any = undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      body = await request.text()
    } catch {
      body = undefined
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      credentials: 'omit'
    })

    const data = await response.text()
    let responseHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('Content-Type') || 'application/json'
    }

    return new NextResponse(data, {
      status: response.status,
      headers: responseHeaders
    })

  } catch (err: any) {
    console.error(`[WhatsAppProxy] Failed routing to ${targetUrl}:`, err.message)
    return NextResponse.json({
      error: 'Infrastructure Bridge Timeout',
      details: 'Could not reach the backend Express server. Please ensure your node server is active on port 5000.'
    }, { status: 503 })
  }
}

export const GET = proxyRequest
export const POST = proxyRequest
export const PUT = proxyRequest
export const PATCH = proxyRequest
export const DELETE = proxyRequest
