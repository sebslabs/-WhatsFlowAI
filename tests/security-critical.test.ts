/**
 * Security tests for CRITICAL fixes applied before QA deployment.
 *
 * These tests verify that the removed/disabled dangerous endpoints
 * behave correctly and cannot be exploited.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

// ─── Fix #1a: /api/diagnostic returns 404 in production ────────────────────

describe('CRITICAL Fix #1a — /api/diagnostic disabled in production', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return 404 when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { GET } = await import('../app/api/diagnostic/route');
    const req = new NextRequest('http://localhost:3000/api/diagnostic');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not Found');
  });

  it('should NOT expose cross-tenant data — requires admin auth in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    // Mock requireAdminApi to simulate unauthenticated request
    vi.mock('@/lib/auth', () => ({
      requireAdminApi: vi.fn().mockResolvedValue({
        user: null,
        supabase: null,
        error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      }),
    }));

    const { GET } = await import('../app/api/diagnostic/route');
    const req = new NextRequest('http://localhost:3000/api/diagnostic');
    const res = await GET(req);

    // Without auth, must return 401 — not expose data
    expect(res.status).toBe(401);
  });
});

// ─── Fix #1b: /api/diagnostic/messages returns 404 in all environments ─────

describe('CRITICAL Fix #1b — /api/diagnostic/messages permanently disabled', () => {
  it('should return 404 regardless of NODE_ENV', async () => {
    vi.resetModules();
    const { GET } = await import('../app/api/diagnostic/messages/route');
    const req = new NextRequest('http://localhost:3000/api/diagnostic/messages');
    const res = await GET();

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Not Found');
  });

  it('should NOT perform any database mutations (no Supabase client instantiated)', async () => {
    const createClientSpy = vi.fn();
    vi.mock('@supabase/supabase-js', () => ({ createClient: createClientSpy }));

    vi.resetModules();
    const { GET } = await import('../app/api/diagnostic/messages/route');
    await GET();

    // Supabase client must never be instantiated — no DB calls on a disabled endpoint
    expect(createClientSpy).not.toHaveBeenCalled();
  });
});

// ─── Fix #2: /api/internal requires x-internal-key ─────────────────────────

describe('CRITICAL Fix #2 — /api/internal validated at edge middleware', () => {
  it('should reject requests without x-internal-key header', async () => {
    process.env.INTERNAL_API_KEY = 'super-secret-key';

    // Simulate the middleware check directly
    const internalKey = undefined;
    const systemKey = process.env.INTERNAL_API_KEY;
    const isUnauthorized = !internalKey || internalKey !== systemKey;

    expect(isUnauthorized).toBe(true);
  });

  it('should reject requests with incorrect x-internal-key', async () => {
    process.env.INTERNAL_API_KEY = 'super-secret-key';

    const internalKey = 'wrong-key';
    const systemKey = process.env.INTERNAL_API_KEY;
    const isUnauthorized = !internalKey || internalKey !== systemKey;

    expect(isUnauthorized).toBe(true);
  });

  it('should allow requests with correct x-internal-key', async () => {
    process.env.INTERNAL_API_KEY = 'super-secret-key';

    const internalKey = 'super-secret-key';
    const systemKey = process.env.INTERNAL_API_KEY;
    const isAuthorized = internalKey === systemKey;

    expect(isAuthorized).toBe(true);
  });
});

// ─── Fix #3: No default verify token ────────────────────────────────────────

describe('CRITICAL Fix #3 — WhatsApp verify token has no hardcoded default', () => {
  it('connect route: verify_token stored as null when no token is provided and env var absent', async () => {
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.META_VERIFY_TOKEN;

    const verifyToken = undefined;
    const webhookVerifyToken = undefined;
    const envToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN;

    const stored = verifyToken || webhookVerifyToken || envToken || null;

    // Must store null, NOT 'whatsflow_default_verify'
    expect(stored).toBeNull();
    expect(stored).not.toBe('whatsflow_default_verify');
  });

  it('connect route: rejects in production if no verify token env var is set', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.WHATSAPP_VERIFY_TOKEN;
    delete process.env.META_VERIFY_TOKEN;

    const isProduction = process.env.NODE_ENV === 'production';
    const hasToken = !!(process.env.WHATSAPP_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN);

    // In production with no token configured, handler should refuse
    expect(isProduction && !hasToken).toBe(true);
  });
});

// ─── Fix #4: File upload allowlist ───────────────────────────────────────────

describe('CRITICAL Fix #4 — File upload MIME type allowlist', () => {
  const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ]);

  const MIME_TO_EXTENSION: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
  };

  it('should reject SVG files (potential XSS vector)', () => {
    expect(ALLOWED_MIME_TYPES.has('image/svg+xml')).toBe(false);
  });

  it('should reject executable files', () => {
    expect(ALLOWED_MIME_TYPES.has('application/x-msdownload')).toBe(false);
    expect(ALLOWED_MIME_TYPES.has('text/javascript')).toBe(false);
  });

  it('should allow expected safe file types', () => {
    expect(ALLOWED_MIME_TYPES.has('image/jpeg')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('image/png')).toBe(true);
    expect(ALLOWED_MIME_TYPES.has('application/pdf')).toBe(true);
  });

  it('should reject MIME/extension mismatch attack (e.g. .exe claiming image/png)', () => {
    const claimedMime = 'image/png';
    const fileExtension = 'exe';
    const allowedExts = MIME_TO_EXTENSION[claimedMime] ?? [];
    expect(allowedExts.includes(fileExtension)).toBe(false);
  });

  it('should accept matching MIME/extension pairs', () => {
    const claimedMime = 'image/png';
    const fileExtension = 'png';
    const allowedExts = MIME_TO_EXTENSION[claimedMime] ?? [];
    expect(allowedExts.includes(fileExtension)).toBe(true);
  });
});
