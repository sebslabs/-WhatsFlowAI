import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi, requireAdminApi } from '@/lib/auth';

// Mock Supabase Client dependencies
const mockSsrCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: any[]) => mockSsrCreateClient(...args),
}));

vi.mock('@supabase/supabase-js', () => {
  const mockFrom = vi.fn().mockImplementation((table) => {
    if (table === 'tenant_members') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'user', tenant_id: 'tenant-123' },
          error: null,
        }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  return {
    createClient: vi.fn().mockImplementation(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
      from: mockFrom,
    })),
  };
});

describe('API Auth Guards', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

    // Reset SSR client mock
    mockSsrCreateClient.mockReset();
    mockSsrCreateClient.mockImplementation(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Auth session missing' },
        }),
      },
      from: vi.fn(),
    }));

    // Reset and restore default mock implementation of createClient to purge mockImplementationOnce queue
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReset();
    vi.mocked(createClient).mockImplementation(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
      from: (table: string) => {
        if (table === 'tenant_members') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: 'user', tenant_id: 'tenant-123' },
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      },
    }) as any);
  });

  it('should successfully authenticate user with valid Bearer token', async () => {
    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        Authorization: 'Bearer valid-jwt-token',
      },
    });

    const result = await requireAuthApi(request);

    expect(result.error).toBeNull();
    expect(result.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'user',
      tenant_id: 'tenant-123',
    });
  });

  it('should fail authentication if Bearer token is missing', async () => {
    // Modify mock to simulate no user
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockImplementationOnce(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Auth session missing' },
        }),
      },
      from: vi.fn(),
    } as any));

    const request = new NextRequest('http://localhost:3000/api/test', {
      headers: {
        Authorization: '',
      },
    });

    const result = await requireAuthApi(request);

    expect(result.user).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error?.status).toBe(401);
  });

  it('should block non-admins on admin-only route guards', async () => {
    const request = new NextRequest('http://localhost:3000/api/admin-route', {
      headers: {
        Authorization: 'Bearer valid-jwt-token',
      },
    });

    const result = await requireAdminApi(request);

    expect(result.user).toBeNull();
    expect(result.error).toBeInstanceOf(NextResponse);
    expect(result.error?.status).toBe(403);
  });
});
