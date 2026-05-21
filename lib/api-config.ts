import { createClient } from './supabase/client';

export const API_BASE_URL = '';

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

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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