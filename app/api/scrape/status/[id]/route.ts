import { NextRequest, NextResponse } from 'next/server'

const BACKEND_API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const targetUrl = `${BACKEND_API}/api/scrape/status/${params.id}`

  const headers = new Headers()
  const allowedHeaders = ['authorization', 'content-type', 'accept']
  request.headers.forEach((value, key) => {
    if (allowedHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith('x-')) {
      headers.append(key, value)
    }
  })

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      credentials: 'omit'
    })

    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json'
      }
    })
  } catch (err: any) {
    console.error(`[ScrapeStatusProxy] Failed routing to ${targetUrl}:`, err.message)
    return NextResponse.json({
      error: 'Infrastructure Bridge Timeout',
      details: 'Could not reach the backend Express server. Please ensure your node server is active on port 5000.'
    }, { status: 503 })
  }
}
