import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { POST, GET } from '@/app/api/webhooks/whatsapp/route';

// Mock BullMQ Queue and IORedis connection
vi.mock('bullmq', () => {
  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
    })),
  };
});

vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
    })),
  };
});

// Mock Supabase
vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === 'whatsapp_accounts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-meta-123' },
              error: null,
            }),
          };
        }
        if (table === 'whatsapp_qr_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { tenant_id: 'tenant-baileys-456' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    })),
  };
});

describe('WhatsApp Webhook API Route', () => {
  const metaSecret = 'meta-app-secret-key';
  const internalSecret = 'internal-shared-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.META_APP_SECRET = metaSecret;
    process.env.WEBHOOK_INTERNAL_SECRET = internalSecret;
    process.env.META_VERIFY_TOKEN = 'meta-verify';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  describe('GET — Meta Verification Protocol', () => {
    it('should verify webhook successfully with valid token', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=meta-verify&hub.challenge=test-challenge'
      );
      
      const res = await GET(req);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe('test-challenge');
    });

    it('should reject webhook verification with invalid token', async () => {
      const req = new NextRequest(
        'http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-verify&hub.challenge=test-challenge'
      );
      
      const res = await GET(req);
      expect(res.status).toBe(403);
    });
  });

  describe('POST — Webhook Ingress & Validation', () => {
    it('should reject Meta payloads with invalid signatures', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const body = JSON.stringify(payload);
      
      const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': 'sha256=invalid-signature-hash',
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('Invalid signature');
    });

    it('should successfully ingest Meta payloads with valid signatures', async () => {
      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone-meta-123' },
              messages: [{ id: 'msg-123', from: '1234567890', text: { body: 'Hello Meta' } }]
            }
          }]
        }]
      };
      const body = JSON.stringify(payload);
      const signature = 'sha256=' + crypto.createHmac('sha256', metaSecret).update(body).digest('hex');

      const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hub-signature-256': signature,
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });

    it('should successfully ingest Baileys payloads with valid internal secret', async () => {
      const payload = {
        messageId: 'msg-baileys-456',
        from: '0987654321',
        text: 'Hello Baileys',
        to: '0987654321'
      };
      const body = JSON.stringify(payload);

      const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': internalSecret,
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.received).toBe(true);
    });

    it('should reject Baileys payloads with missing or invalid internal secret', async () => {
      const payload = {
        messageId: 'msg-baileys-456',
        from: '0987654321',
        text: 'Hello Baileys'
      };
      const body = JSON.stringify(payload);

      const req = new Request('http://localhost:3000/api/webhooks/whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': 'wrong-internal-secret',
        },
        body,
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });
});
