import { createClient } from './supabase/client';

/**
 * The Fly.io backend URL — used ONLY for internal machine-to-machine calls
 * (Baileys/WhatsApp QR endpoints that live exclusively on the Express server).
 * All standard Next.js API routes (/api/ai-agents, /api/conversations, etc.)
 * are served by Vercel and must use a relative URL (no prefix).
 */
export const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Routes that live on the Fly.io Express backend (not on Vercel).
 * Any endpoint starting with one of these prefixes will be sent to BACKEND_URL.
 * Everything else is sent as a relative URL to the Vercel Next.js server.
 */
const FLY_BACKEND_ROUTES = [
  '/api/internal/baileys',
  '/api/whatsapp/qr',
];

function isFlyBackendRoute(endpoint: string): boolean {
  return FLY_BACKEND_ROUTES.some((prefix) => endpoint.startsWith(prefix));
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  let authHeader: Record<string, string> = {}

  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.access_token) {
      authHeader = { Authorization: `Bearer ${session.access_token}` }
    }
  } catch {
    console.warn('[apiFetch] Could not read session for Authorization header')
  }

  // Only prepend the Fly.io backend URL for routes that actually live there.
  // All Next.js API routes use a relative path so Vercel handles them correctly.
  const baseUrl = isFlyBackendRoute(endpoint) ? BACKEND_URL : '';
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(err.error || `API Error: ${response.statusText}`)
  }

  return response.json()
}