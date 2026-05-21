import type { Lead, LeadFormData, LeadStage, LeadUrgency } from '@/types/index'
import { createClient } from './supabase/client';

/** Row shape returned by GET /api/leads (Supabase column names). */
export type ApiLeadRow = {
  id: string
  name: string
  phone: string
  email: string | null
  service: string | null
  stage: LeadStage
  urgency: string | null
  notes: string | null
  created_at: string
  updated_at?: string | null
}

const DEFAULT_AVATAR = 'bg-[#22C55E]'

export function mapApiLeadToLead(row: ApiLeadRow): Lead {
  const last = row.updated_at ?? row.created_at
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email ?? undefined,
    service: row.service?.trim() ? row.service : 'General Inquiry',
    urgency: (row.urgency as LeadUrgency) || 'Flexible',
    stage: row.stage,
    source: 'CRM',
    assignedTo: undefined,
    notes: row.notes ?? undefined,
    avatarColor: DEFAULT_AVATAR,
    createdAt: row.created_at,
    lastActivity: last,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  }
}

function formToCreateBody(data: LeadFormData) {
  return {
    name: data.name.trim(),
    phone: data.phone.trim(),
    email: data.email.trim() || undefined,
    service: data.service.trim() || undefined,
    stage: data.stage,
    urgency: (data.urgency || undefined) as LeadUrgency | undefined,
    notes: data.notes.trim() || undefined,
  }
}

async function parseError(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  if (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string') {
    return (body as { error: string }).error
  }
  return res.statusText || 'Request failed'
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` }
    }
  } catch {
    console.warn('[leads-client] Could not read session for Authorization header')
  }
  return {}
}

/**
 * Cookie and Bearer Token authenticated calls to Next.js App Router `/api/leads`.
 * Passes the Bearer token explicitly to synchronize context with the stateless backend.
 */
export async function fetchLeadsList(): Promise<Lead[]> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch('/api/leads', { 
    credentials: 'include',
    headers: {
      ...authHeaders,
    }
  })
  if (!res.ok) throw new Error(await parseError(res))
  const rows = (await res.json()) as ApiLeadRow[]
  return Array.isArray(rows) ? rows.map(mapApiLeadToLead) : []
}

export async function createLeadApi(data: LeadFormData): Promise<Lead> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch('/api/leads', {
    method: 'POST',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(formToCreateBody(data)),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const row = (await res.json()) as ApiLeadRow
  return mapApiLeadToLead(row)
}

export async function updateLeadApi(id: string, data: LeadFormData): Promise<Lead> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch('/api/leads', {
    method: 'PATCH',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({
      id,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim() || undefined,
      service: data.service.trim() || undefined,
      stage: data.stage,
      urgency: (data.urgency || undefined) as LeadUrgency | undefined,
      notes: data.notes.trim() || undefined,
    }),
  })
  if (!res.ok) throw new Error(await parseError(res))
  const row = (await res.json()) as ApiLeadRow
  return mapApiLeadToLead(row)
}

export async function deleteLeadApi(id: string): Promise<void> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch(`/api/leads?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      ...authHeaders,
    },
  })
  if (!res.ok) throw new Error(await parseError(res))
}

export async function bulkDeleteLeadsApi(ids: string[]): Promise<void> {
  const authHeaders = await getAuthHeaders()
  const res = await fetch('/api/leads', {
    method: 'DELETE',
    credentials: 'include',
    headers: { 
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(await parseError(res))
}
