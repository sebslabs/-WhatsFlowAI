import type { proto, WASocket } from '@whiskeysockets/baileys';

export const UNKNOWN_CONTACT_NAME = 'Unknown Contact';

const PLACEHOLDER_NAME_RE = /^WhatsApp Contact \d{4}$/i;

/** Unwrap ephemeral / view-once wrappers and extract display text from a Baileys message. */
export function extractBaileysMessageText(message: proto.IMessage | null | undefined): string {
  if (!message) return '';

  let msgContent = message;
  if (msgContent.ephemeralMessage?.message) {
    msgContent = msgContent.ephemeralMessage.message;
  }
  if (msgContent.viewOnceMessage?.message) {
    msgContent = msgContent.viewOnceMessage.message;
  }
  if (msgContent.viewOnceMessageV2?.message) {
    msgContent = msgContent.viewOnceMessageV2.message;
  }
  if (msgContent.documentWithCaptionMessage?.message) {
    msgContent = msgContent.documentWithCaptionMessage.message;
  }

  const text =
    msgContent.conversation ||
    msgContent.extendedTextMessage?.text ||
    msgContent.imageMessage?.caption ||
    msgContent.videoMessage?.caption ||
    msgContent.buttonsResponseMessage?.selectedDisplayText ||
    msgContent.listResponseMessage?.title ||
    '';

  if (text) return text;

  if (
    msgContent.imageMessage ||
    msgContent.videoMessage ||
    msgContent.audioMessage ||
    msgContent.documentMessage ||
    msgContent.stickerMessage
  ) {
    return '[media]';
  }

  return '';
}

/**
 * Extract E.164-style digits from a personal WhatsApp JID (`...@s.whatsapp.net` only).
 * Returns null for groups, status, LID-only, or invalid JIDs.
 */
export function extractPhoneNumber(remoteJid: string | null | undefined): string | null {
  if (!remoteJid) return null;

  if (remoteJid.includes('@s.whatsapp.net')) {
    const userPart = remoteJid.split('@')[0].split(':')[0];
    return userPart || null;
  }

  return null;
}

/** Skip status broadcasts, groups, and other non-DM JIDs. */
export function shouldIgnoreWhatsAppJid(remoteJid: string | null | undefined): boolean {
  if (!remoteJid) return true;
  if (remoteJid === 'status@broadcast') return true;
  if (remoteJid.includes('@g.us')) return true;
  if (remoteJid.endsWith('@broadcast')) return true;
  return false;
}

/** Normalize for DB lookup/storage: digits only, strip device suffix. */
export function normalizeStoredPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export type ResolvedInboundMessage = {
  rawJid: string;
  phone: string;
  sendJid: string;
};

/**
 * Resolve phone + raw JID from a Baileys message key.
 * Uses remoteJidAlt when primary is @lid (Baileys v7).
 */
export function resolveInboundMessageJid(msg: {
  key: {
    remoteJid?: string | null;
    remoteJidAlt?: string | null;
  };
}): ResolvedInboundMessage | null {
  const remoteJid = msg.key.remoteJid;
  if (shouldIgnoreWhatsAppJid(remoteJid)) return null;

  const rawJid = remoteJid!;

  const extracted =
    extractPhoneNumber(remoteJid) ?? extractPhoneNumber(msg.key.remoteJidAlt ?? undefined);

  const phone = normalizeStoredPhone(extracted);
  if (!phone) return null;

  const sendJid =
    extractPhoneNumber(remoteJid) !== null
      ? remoteJid!
      : phoneToJid(phone);

  return { rawJid, phone, sendJid };
}

/** @deprecated Use extractPhoneNumber + normalizeStoredPhone */
export function jidToPhone(jid: string): string {
  return extractPhoneNumber(jid) ?? jid.split('@')[0].split(':')[0];
}

export function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

/** @deprecated Use shouldIgnoreWhatsAppJid */
export function isPersonalChatJid(jid: string | null | undefined): boolean {
  if (!jid) return false;
  if (shouldIgnoreWhatsAppJid(jid)) return false;
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid');
}

/** WhatsApp display name from an inbound message (`pushName`). */
export function extractPushName(
  msg: { pushName?: string | null },
  fromMe: boolean
): string | null {
  if (fromMe) return null;
  const name = msg.pushName?.trim();
  return name || null;
}

export function isPlaceholderContactName(name: string | null | undefined): boolean {
  if (!name?.trim()) return true;
  const n = name.trim();
  return (
    n === UNKNOWN_CONTACT_NAME ||
    n === 'Unknown' ||
    PLACEHOLDER_NAME_RE.test(n)
  );
}

/**
 * Resolve CRM display name: pushName → WhatsApp lookup → existing DB name → default.
 */
export function resolveContactDisplayName(options: {
  pushName?: string | null;
  existingName?: string | null;
  whatsAppLookupName?: string | null;
}): string {
  const push = options.pushName?.trim();
  if (push) return push;

  const wa = options.whatsAppLookupName?.trim();
  if (wa) return wa;

  const existing = options.existingName?.trim();
  if (existing && !isPlaceholderContactName(existing)) return existing;

  return UNKNOWN_CONTACT_NAME;
}

/**
 * Optional: resolve name from Baileys contact store or verify JID exists on WhatsApp.
 * `onWhatsApp` does not return profile names — store contacts are used when synced.
 */
export async function fetchWhatsAppContactName(
  sock: WASocket,
  phone: string,
  sendJid: string
): Promise<string | null> {
  try {
    const store = (sock as WASocket & { store?: { contacts?: Record<string, { name?: string; notify?: string }> } })
      .store;
    const jid = sendJid.includes('@') ? sendJid : phoneToJid(phone);
    const stored = store?.contacts?.[jid] ?? store?.contacts?.[phoneToJid(phone)];
    const fromStore = stored?.name?.trim() || stored?.notify?.trim();
    if (fromStore) return fromStore;

    const results = await sock.onWhatsApp(phoneToJid(phone));
    const entry = results?.[0];
    if (!entry?.exists) return null;

    const businessSock = sock as WASocket & {
      getBusinessProfile?: (jid: string) => Promise<{ description?: string } | void>;
    };
    if (typeof businessSock.getBusinessProfile === 'function') {
      const profile = await businessSock.getBusinessProfile(jid);
      const desc = profile?.description?.trim();
      if (desc && desc.length <= 80) return desc;
    }
  } catch {
    /* non-fatal */
  }
  return null;
}

/** AI auto-reply when conversation is in bot/ai mode and not manually paused. */
export function isConversationAiEnabled(conversation: {
  ai_enabled?: boolean | null;
  mode?: string | null;
}): boolean {
  if (conversation.ai_enabled === false) return false;
  if (conversation.mode === 'manual') return false;
  return true;
}
