import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  initAuthCreds,
  BufferJSON,
  proto,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { createClient } from '@supabase/supabase-js';
import { mkdir, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import pino from 'pino';
import {
  extractBaileysMessageText,
  extractPushName,
  phoneToJid,
  resolveInboundMessageJid,
} from '@/lib/whatsapp-message-utils';

const globalForBaileys = global as unknown as {
  baileysSessions?: Map<string, WASocket>;
};

const sessions = globalForBaileys.baileysSessions ?? new Map<string, WASocket>();
globalForBaileys.baileysSessions = sessions;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sessionHadQr = new Map<string, boolean>();
let authStoreBackend: 'supabase' | 'filesystem' | null = null;

function getBaileysAuthDir(sessionId: string): string {
  const base =
    process.env.BAILEYS_AUTH_DIR ||
    path.join(os.tmpdir(), 'whatsflow-baileys-auth');
  return path.join(base, sessionId);
}

async function verifyBaileysAuthTableExist(): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_baileys_auth_states')
    .select('session_id')
    .limit(1);

  if (
    error &&
    (error.message.includes('Could not find the table') ||
      error.code === 'PGRST205' ||
      error.code === '42P01')
  ) {
    const errorMsg = 
      'CRITICAL: The required database table "whatsapp_baileys_auth_states" is missing. ' +
      'Please run database migrations (e.g. 20260518000003_add_baileys_auth_states.sql) to set up QR pairing persistence. ' +
      'Filesystem fallback is disabled in production to prevent data loss in multi-instance environments.';

    if (process.env.NODE_ENV === 'production') {
      console.error(`[Baileys-QR] [CRITICAL] ${errorMsg}`);
      throw new Error(errorMsg);
    } else {
      console.warn(`[Baileys-QR] [WARNING] ${errorMsg}`);
    }
  } else if (error) {
    console.error('[Baileys-QR] Database health check error:', error.message);
  }
}

async function resolveAuthStoreBackend(): Promise<'supabase' | 'filesystem'> {
  if (authStoreBackend) return authStoreBackend;

  const { error } = await supabase
    .from('whatsapp_baileys_auth_states')
    .select('session_id')
    .limit(1);

  if (
    error &&
    (error.message.includes('Could not find the table') ||
      error.code === 'PGRST205' ||
      error.code === '42P01')
  ) {
    if (process.env.NODE_ENV === 'production') {
      const errorMsg = 'CRITICAL: "whatsapp_baileys_auth_states" table is missing in production!';
      console.error(`[Baileys-QR] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    console.warn(
      '[Baileys-QR] whatsapp_baileys_auth_states table missing — using local filesystem auth. ' +
        'Apply migration: supabase/migrations/20260518000003_add_baileys_auth_states.sql'
    );
    authStoreBackend = 'filesystem';
  } else if (error) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Baileys-QR] Supabase auth store check failed in production:', error.message);
      throw new Error(`CRITICAL: Supabase auth store check failed: ${error.message}`);
    }
    console.warn('[Baileys-QR] Supabase auth store unavailable, using filesystem:', error.message);
    authStoreBackend = 'filesystem';
  } else {
    authStoreBackend = 'supabase';
  }

  return authStoreBackend;
}

async function resolveAuthState(sessionId: string) {
  const backend = await resolveAuthStoreBackend();
  if (backend === 'supabase') {
    return useSupabaseAuthState(supabase, sessionId);
  }
  const authDir = getBaileysAuthDir(sessionId);
  await mkdir(authDir, { recursive: true });
  return useMultiFileAuthState(authDir);
}

async function clearAuthState(sessionId: string): Promise<void> {
  try {
    await supabase.from('whatsapp_baileys_auth_states').delete().eq('session_id', sessionId);
  } catch {
    /* table may not exist yet */
  }
  try {
    await rm(getBaileysAuthDir(sessionId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

/** One listener per socket — rebound only when a new socket is created after reconnect. */
function bindMessageListener(sock: WASocket, tenantId: string, sessionId: string): void {
  sock.ev.on('messages.upsert', async (m) => {
    const { messages } = m;
    if (!messages?.length) return;

    for (const msg of messages) {
      try {
        if (!msg.message) continue;

        const remoteJid = msg.key.remoteJid;

        // Ignore system / group messages
        if (
          !remoteJid ||
          remoteJid === 'status@broadcast' ||
          remoteJid.includes('@g.us')
        ) {
          continue;
        }

        const resolved = resolveInboundMessageJid(msg);
        if (!resolved) continue;

        const messageId = msg.key.id;
        if (!messageId) continue;

        const fromMe = !!msg.key.fromMe;
        const text = extractBaileysMessageText(msg.message);
        if (!text) continue;

        const { rawJid, phone, sendJid } = resolved;
        const pushName = extractPushName(msg, fromMe);

        const payload = {
          wa_message_id: messageId,
          phone,
          raw_jid: rawJid,
          name: pushName || 'Unknown',
          content: text,
          sender_type: fromMe ? 'agent' : 'customer',
        };
        console.log('[Baileys-QR] Dispatching message payload to background queue:', payload);

        // INBOX FIX: Persist in Next.js immediately so customer messages appear even if
        // Express/Redis/BullMQ is offline. Express queue still handles AI auto-reply.
        import('@/lib/inbox-persist')
          .then(({ persistBaileysMessage }) =>
            persistBaileysMessage({
              tenantId,
              messageId,
              phone,
              rawJid,
              sendJid,
              sessionId,
              pushName,
              text,
              fromMe,
              rawMessage: msg.message,
            })
          )
          .catch((err) =>
            console.error('[Baileys-QR] Inbox persist failed:', err)
          );

        dispatchIncomingMessageToQueue(
          tenantId,
          sessionId,
          sendJid,
          rawJid,
          messageId,
          phone,
          pushName,
          text,
          fromMe,
          msg.message
        ).catch((err) => console.error('[Baileys-QR] Queue dispatch failed:', err));
      } catch (err) {
        console.error('[Baileys-QR] messages.upsert loop error:', err);
      }
    }
  });
}

/** Custom Supabase database-backed Baileys multi-instance auth state store */
async function useSupabaseAuthState(supabaseClient: typeof supabase, sessionId: string) {
  const readKey = async (key: string) => {
    try {
      const { data, error } = await supabaseClient
        .from('whatsapp_baileys_auth_states')
        .select('data_value')
        .eq('session_id', sessionId)
        .eq('data_key', key)
        .maybeSingle();

      if (error || !data) return null;
      return JSON.parse(JSON.stringify(data.data_value), BufferJSON.reviver);
    } catch {
      return null;
    }
  };

  const writeKey = async (key: string, value: any) => {
    try {
      const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
      await supabaseClient
        .from('whatsapp_baileys_auth_states')
        .upsert(
          {
            session_id: sessionId,
            data_key: key,
            data_value: serialized,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'session_id,data_key' }
        );
    } catch (err) {
      console.error('[useSupabaseAuthState] writeKey error:', err);
    }
  };

  const deleteKey = async (key: string) => {
    try {
      await supabaseClient
        .from('whatsapp_baileys_auth_states')
        .delete()
        .eq('session_id', sessionId)
        .eq('data_key', key);
    } catch (err) {
      console.error('[useSupabaseAuthState] deleteKey error:', err);
    }
  };

  let creds = await readKey('creds');
  if (!creds) {
    creds = initAuthCreds();
    await writeKey('creds', creds);
  }

  const state = {
    creds,
    keys: {
      get: async (type: string, ids: string[]) => {
        const data: { [id: string]: any } = {};
        await Promise.all(
          ids.map(async (id) => {
            const key = `${type}-${id}`;
            let value = await readKey(key);
            if (type === 'app-state-sync-key' && value) {
              value = proto.Message.AppStateSyncKeyData.fromObject(value);
            }
            data[id] = value;
          })
        );
        return data;
      },
      set: async (data: any) => {
        const tasks: Promise<void>[] = [];
        for (const category in data) {
          for (const id in data[category]) {
            const key = `${category}-${id}`;
            const value = data[category][id];
            if (value) {
              tasks.push(writeKey(key, value));
            } else {
              tasks.push(deleteKey(key));
            }
          }
        }
        await Promise.all(tasks);
      },
    },
  };

  const saveCreds = async () => {
    await writeKey('creds', state.creds);
  };

  return {
    state,
    saveCreds,
  };
}

async function markSessionError(sessionId: string, message: string): Promise<void> {
  await supabase
    .from('whatsapp_qr_sessions')
    .update({
      status: 'error',
      error_message: message.slice(0, 500),
      qr_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

/** Poll DB until Baileys writes a QR image or the session reaches a terminal state. */
export async function waitForSessionQr(
  sessionId: string,
  timeoutMs = 45_000
): Promise<{ status: string; qr_code: string | null; error_message?: string | null }> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('whatsapp_qr_sessions')
      .select('status, qr_code, error_message')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error('Session not found');

    if (data.status === 'connected' || (data.status === 'qr_ready' && data.qr_code)) {
      return data;
    }
    if (data.status === 'error' || data.status === 'disconnected') {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Timed out waiting for WhatsApp QR code. Please try again.');
}

export async function getBaileysSession(tenantId: string, sessionId: string): Promise<WASocket> {
  const existing = sessions.get(sessionId);
  if (existing) return existing;

  await supabase
    .from('whatsapp_qr_sessions')
    .update({ status: 'connecting', error_message: null, updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  sessionHadQr.set(sessionId, false);

  const { state, saveCreds } = await resolveAuthState(sessionId);

  let version: [number, number, number];
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (err) {
    console.warn('[Baileys-QR] fetchLatestBaileysVersion failed, using default:', err);
    version = [2, 3000, 0];
  }

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }) as any,
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        sessionHadQr.set(sessionId, true);
        const qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 256 });
        const { error: qrUpdateErr } = await supabase
          .from('whatsapp_qr_sessions')
          .update({ status: 'qr_ready', qr_code: qrCodeDataUrl, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (qrUpdateErr) {
          console.error('[Baileys-QR] Failed to persist QR to DB:', qrUpdateErr.message);
        }
      } catch (err) {
        console.error('[Baileys-QR] QR failed', err);
        await markSessionError(sessionId, 'Failed to generate QR image');
      }
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
        ?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      const gotQr = sessionHadQr.get(sessionId);
      const wasLoggedIn = !!sock.user?.id;

      if (!wasLoggedIn && !gotQr && !shouldReconnect) {
        const reason =
          (lastDisconnect?.error as Error | undefined)?.message ||
          `WhatsApp closed the connection (code ${statusCode ?? 'unknown'})`;
        await markSessionError(sessionId, reason);
      }

      sessions.delete(sessionId);
      try {
        sock.end(undefined);
      } catch {
        /* ignore */
      }

      if (shouldReconnect) {
        setTimeout(() => getBaileysSession(tenantId, sessionId).catch(console.error), 3000);
      } else {
        await supabase
          .from('whatsapp_qr_sessions')
          .update({ status: 'disconnected', qr_code: null })
          .eq('id', sessionId);
      }
    } else if (connection === 'open') {
      const phoneNumber = sock.user?.id?.split(':')[0];
      await supabase
        .from('whatsapp_qr_sessions')
        .update({
          status: 'connected',
          qr_code: null,
          phone_number: phoneNumber,
          last_connected_at: new Date().toISOString(),
        })
        .eq('id', sessionId);
    }
  });

  bindMessageListener(sock, tenantId, sessionId);
  sessions.set(sessionId, sock);
  return sock;
}

export async function startBaileysSession(tenantId: string, sessionId: string): Promise<WASocket> {
  try {
    return await getBaileysSession(tenantId, sessionId);
  } catch (err: any) {
    await markSessionError(sessionId, err?.message || 'Failed to start WhatsApp session');
    throw err;
  }
}

export async function disconnectBaileysSession(sessionId: string): Promise<void> {
  const sock = sessions.get(sessionId);
  if (sock) {
    try {
      await sock.logout();
    } catch {
      /* ignore */
    }
    sessions.delete(sessionId);
  }
  sessionHadQr.delete(sessionId);
  await clearAuthState(sessionId);
  await supabase
    .from('whatsapp_qr_sessions')
    .update({ status: 'disconnected', qr_code: null })
    .eq('id', sessionId);
}

export async function initActiveSessions(): Promise<void> {
  // Startup database health check
  await verifyBaileysAuthTableExist();

  const { data: activeSessions, error } = await supabase
    .from('whatsapp_qr_sessions')
    .select('id, tenant_id')
    .eq('status', 'connected');

  if (error) return;

  for (const s of activeSessions ?? []) {
    if (!sessions.has(s.id)) {
      getBaileysSession(s.tenant_id, s.id).catch(console.error);
    }
  }
}

export async function getConnectedSession(
  tenantId: string,
  sessionId?: string
): Promise<{ id: string; sock: WASocket } | null> {
  if (sessionId) {
    const sock = sessions.get(sessionId) ?? (await getBaileysSession(tenantId, sessionId));
    return sock ? { id: sessionId, sock } : null;
  }

  const { data: rows } = await supabase
    .from('whatsapp_qr_sessions')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'connected')
    .order('last_connected_at', { ascending: false })
    .limit(1);

  const row = rows?.[0];
  if (!row) return null;

  return { id: row.id, sock: await getBaileysSession(tenantId, row.id) };
}// ── dispatch incoming message → Express background BullMQ queue ──────────────

async function dispatchIncomingMessageToQueue(
  tenantId: string,
  sessionId: string,
  sendJid: string,
  rawJid: string,
  messageId: string,
  phone: string,
  pushName: string | null,
  text: string,
  fromMe: boolean,
  rawMessage?: any
): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  const internalKey = process.env.INTERNAL_API_KEY;

  if (!internalKey) {
    console.error(
      '[Baileys-QR] INTERNAL_API_KEY is not set — messages will NOT appear in the inbox. ' +
        'Set the same INTERNAL_API_KEY in .env.local (Next.js) and server/.env, then run the Express server (port 5000) and Redis.'
    );
    return;
  }

  try {
    const res = await fetch(`${apiUrl}/api/internal/baileys/enqueue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': internalKey,
      },
      body: JSON.stringify({
        tenantId,
        sessionId,
        sendJid,
        rawJid,
        messageId,
        phone,
        pushName,
        text,
        fromMe,
        rawMessage,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[Baileys-QR] Queue dispatch failed (${res.status}). Inbox will not update until Express + Redis are running. ${body}`
      );
    } else {
      console.log('[Baileys-QR] Message successfully dispatched to background BullMQ queue', {
        messageId,
        phone,
      });
    }
  } catch (err: any) {
    console.error('[Baileys-QR] Failed to connect to Express enqueue endpoint:', err.message);
  }
}

export { phoneToJid };
