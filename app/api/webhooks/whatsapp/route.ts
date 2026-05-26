import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
// MEDIUM FIX (#9): Import shared HMAC verifier — same function used in tests.
// Eliminates duplicate logic that could silently diverge between test and production.
import { verifyWebhookHmac } from '@/lib/utils/webhook-hmac';
import { timingSafeEqual } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
});
const webhookQueue = new Queue('whatsapp-messages', { connection });

function verifyInternalSecret(request: Request): boolean {
  const authHeader = request.headers.get('x-internal-secret');
  const secret = process.env.WEBHOOK_INTERNAL_SECRET;
  if (!secret || !authHeader) return false;
  try {
    const a = Buffer.from(authHeader, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// MEDIUM FIX (#9): verifyMetaSignature() replaced by shared verifyWebhookHmac().
// The inline implementation has been removed — see lib/utils/webhook-hmac.ts.
function verifyMetaSignature(rawBody: string, request: Request): boolean {
  const signatureHeader = request.headers.get('x-hub-signature-256');
  const secret = process.env.META_APP_SECRET;
  if (!secret) {
    console.error('[webhook] META_APP_SECRET is not configured');
    return false;
  }
  return verifyWebhookHmac(rawBody, signatureHeader, secret);
}

async function resolveTenantId(payload: any, isBaileys: boolean): Promise<string | null> {
  // 3. The tenant resolution logic must ONLY use these two lookups (in order):
  // a. Match payload.to or payload.phone against whatsapp_accounts.phone_number_id
  
  const phoneId = isBaileys ? (payload.to || payload.phone) : payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

  if (phoneId) {
    const { data: account } = await supabase
      .from('whatsapp_accounts')
      .select('tenant_id')
      .eq('phone_number_id', phoneId)
      .maybeSingle();
      
    if (account?.tenant_id) return account.tenant_id;
  }

  // b. Match against whatsapp_qr_sessions.phone_number where status = 'connected'
  let cleanPhone = '';
  if (isBaileys) {
    if (payload.to) cleanPhone = String(payload.to).replace(/\D/g, '');
    else if (payload.phone) cleanPhone = String(payload.phone).replace(/\D/g, '');
  }

  if (cleanPhone) {
    const { data: session } = await supabase
      .from('whatsapp_qr_sessions')
      .select('tenant_id')
      .eq('phone_number', cleanPhone)
      .eq('status', 'connected')
      .maybeSingle();
      
    if (session?.tenant_id) return session.tenant_id;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- Auth ---
    const isBaileysPayload = !!(payload?.messageId && payload?.from && payload?.text !== undefined);
    
    if (isBaileysPayload && !verifyInternalSecret(request)) {
      console.warn('[Webhook] Unauthorized Baileys request — missing or invalid secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!isBaileysPayload && !verifyMetaSignature(rawBody, request)) {
      console.warn('[Webhook] Invalid X-Hub-Signature-256 signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // --- Tenant Resolution ---
    const tenantId = await resolveTenantId(payload, isBaileysPayload);
    if (!tenantId) {
      console.warn('[Webhook] Could not resolve tenant for payload:', {
        from: payload?.from,
        messageId: payload?.messageId,
      });
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // --- Queue ---
    let messageId = 'unknown';
    let from = 'unknown';
    let text = '';
    let phoneNumberId = null;

    if (isBaileysPayload) {
      messageId = payload.messageId;
      from = payload.from;
      text = payload.text;
    } else {
      const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;
      if (messages && messages.length > 0) {
        messageId = messages[0].id;
        from = messages[0].from;
        text = messages[0].text?.body || '';
      }
      phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || null;
    }

    await webhookQueue.add('inbound-message', {
      messageId,
      from,
      text,
      timestamp: new Date().toISOString(),
      phoneNumberId,
      tenantId,
      rawPayload: payload,
      payload
    }, {
      jobId: messageId !== 'unknown' ? messageId : undefined,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error: any) {
    console.error('[webhook] Processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  const verifyToken =
    process.env.META_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN ?? '';

  if (!verifyToken) {
    console.error('[webhook] META_VERIFY_TOKEN / WHATSAPP_VERIFY_TOKEN not set');
    return NextResponse.json({ error: 'Webhook verify not configured' }, { status: 503 });
  }

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
