import type { UserRole } from '@/lib/auth'

/**
 * Permission matrix. Every action must appear here — deny by default.
 */
const PERMISSIONS: Record<string, UserRole[]> = {
  // Leads
  'leads:read': ['admin', 'user'],
  'leads:create': ['admin', 'user'],
  'leads:update': ['admin', 'user'],
  'leads:delete': ['admin', 'user'],
  'leads:bulk_delete': ['admin', 'user'],
  'leads:import': ['admin'],

  // Conversations
  'conversations:read': ['admin', 'user'],
  'conversations:send': ['admin', 'user'],

  // Flows / Automation
  'flows:read': ['admin', 'user'],
  'flows:create': ['admin'],
  'flows:update': ['admin'],
  'flows:delete': ['admin'],

  // Campaigns
  'campaigns:read': ['admin', 'user'],
  'campaigns:create': ['admin'],
  'campaigns:delete': ['admin'],

  // AI Agents
  'ai_agents:read': ['admin', 'user'],
  'ai_agents:create': ['admin'],
  'ai_agents:update': ['admin'],
  'ai_agents:delete': ['admin'],
  'ai_agents:chat': ['admin', 'user'],

  // Catalog
  'catalog:read': ['admin', 'user'],
  'catalog:create': ['admin'],
  'catalog:update': ['admin'],
  'catalog:delete': ['admin'],

  // Knowledge Base
  'knowledge:read': ['admin', 'user'],
  'knowledge:create': ['admin'],
  'knowledge:delete': ['admin'],

  // Templates
  'templates:read': ['admin', 'user'],
  'templates:create': ['admin'],
  'templates:delete': ['admin'],

  // Analytics
  'analytics:read': ['admin', 'user'],

  // Settings
  'settings:read': ['admin', 'user'],
  'settings:update': ['admin'],

  // Team / Billing (admin-only)
  'team:manage': ['admin'],
  'billing:manage': ['admin'],
}

/**
 * Returns true if the given role has the requested permission.
 * Deny by default: returns false for any unknown permission.
 */
export function hasPermission(role: UserRole, permission: string): boolean {
  // 1. Owners possess absolute super-user permissions across the entire system
  if (role === 'owner') return true

  const allowed = PERMISSIONS[permission]
  if (!allowed) return false

  // 2. Support role hierarchy mapping
  return allowed.includes(role) || 
         (role === 'agent' && allowed.includes('user')) ||
         (role === 'admin' && allowed.includes('user'))
}

/**
 * Throws if the user lacks the required permission.
 * Use in API routes after requireAuthApi().
 */
export function assertPermission(role: UserRole, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new PermissionDeniedError(permission)
  }
}

export class PermissionDeniedError extends Error {
  readonly permission: string
  constructor(permission: string) {
    super(`Permission denied: ${permission}`)
    this.name = 'PermissionDeniedError'
    this.permission = permission
  }
}
