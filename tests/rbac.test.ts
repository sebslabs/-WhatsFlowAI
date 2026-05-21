import { describe, it, expect } from 'vitest';
import { hasPermission, assertPermission, PermissionDeniedError } from '@/lib/rbac';

describe('Role-Based Access Control (RBAC)', () => {
  describe('hasPermission', () => {
    it('should grant super-user access to owners for any permission', () => {
      expect(hasPermission('owner', 'billing:manage')).toBe(true);
      expect(hasPermission('owner', 'leads:import')).toBe(true);
      expect(hasPermission('owner', 'random:undefined:permission')).toBe(true);
    });

    it('should allow admins to perform admin-only tasks', () => {
      expect(hasPermission('admin', 'leads:import')).toBe(true);
      expect(hasPermission('admin', 'ai_agents:create')).toBe(true);
      expect(hasPermission('admin', 'team:manage')).toBe(true);
    });

    it('should block regular users from admin-only tasks', () => {
      expect(hasPermission('user', 'leads:import')).toBe(false);
      expect(hasPermission('user', 'ai_agents:create')).toBe(false);
      expect(hasPermission('user', 'team:manage')).toBe(false);
    });

    it('should allow regular users to perform standard actions', () => {
      expect(hasPermission('user', 'leads:read')).toBe(true);
      expect(hasPermission('user', 'conversations:read')).toBe(true);
      expect(hasPermission('user', 'ai_agents:chat')).toBe(true);
    });

    it('should correctly implement role hierarchy (admin inherits user permissions)', () => {
      expect(hasPermission('admin', 'leads:read')).toBe(true);
      expect(hasPermission('admin', 'conversations:read')).toBe(true);
    });

    it('should correctly implement role hierarchy (agent inherits user permissions)', () => {
      expect(hasPermission('agent', 'leads:read')).toBe(true);
      expect(hasPermission('agent', 'conversations:read')).toBe(true);
    });

    it('should block agents from admin-only permissions', () => {
      expect(hasPermission('agent', 'leads:import')).toBe(false);
      expect(hasPermission('agent', 'team:manage')).toBe(false);
    });

    it('should return false for completely unknown permissions', () => {
      expect(hasPermission('user', 'nonexistent:action')).toBe(false);
      expect(hasPermission('admin', 'nonexistent:action')).toBe(false);
    });
  });

  describe('assertPermission', () => {
    it('should not throw if user has the permission', () => {
      expect(() => assertPermission('admin', 'team:manage')).not.toThrow();
    });

    it('should throw PermissionDeniedError if user lacks the permission', () => {
      expect(() => assertPermission('user', 'team:manage')).toThrow(PermissionDeniedError);
      expect(() => assertPermission('user', 'team:manage')).toThrow('Permission denied: team:manage');
    });
  });
});
