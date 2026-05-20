/**
 * Persist WhatsApp QR (Baileys) messages into Supabase for the unified inbox.
 *
 * Agent sends via /api/conversations/send write directly from Next.js.
 * Customer inbound previously relied on Express + BullMQ only — if Redis/Express
 * were down, inbound never appeared. This module runs in the Next.js process so
 * the inbox always updates.
 */
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

export interface PersistBaileysMessageInput {
  tenantId: string;
  messageId: string;
  phone: string;
  rawJid: string;
  sendJid?: string;
  sessionId?: string;
  pushName?: string | null;
  text: string;
  fromMe: boolean;
  rawMessage?: any;
}

function isPlaceholderContactName(name?: string | null): boolean {
  if (!name) return true;
  const clean = name.trim().toLowerCase();
  return (
    clean === 'unknown' ||
    clean === 'anonymous' ||
    /^\+?\d{8,15}$/.test(clean) ||
    clean.includes('whatsapp user')
  );
}

function resolveContactDisplayName(opts: {
  pushName?: string | null;
  existingName?: string | null;
}): string {
  if (opts.existingName && !isPlaceholderContactName(opts.existingName)) {
    return opts.existingName;
  }
  if (opts.pushName && !isPlaceholderContactName(opts.pushName)) {
    return opts.pushName;
  }
  return 'WhatsApp User';
}

function normalizePhoneVariants(phone: string): string[] {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return [];
  const variants = new Set<string>([clean, `+${clean}`]);
  return [...variants];
}

async function linkLeadsToContact(
  tenantId: string,
  contactId: string,
  phone: string,
  name: string
): Promise<void> {
  const db = getSupabaseAdmin() as any;
  const variants = normalizePhoneVariants(phone);

  const { data: existing } = await db
    .from('leads')
    .select('id, phone, contact_id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (existing) {
    const patch: { phone?: string; name?: string } = {};
    if (!existing.phone) patch.phone = phone;
    if (name && !isPlaceholderContactName(name)) patch.name = name;
    if (Object.keys(patch).length > 0) {
      await db.from('leads').update(patch).eq('id', existing.id);
    }
    return;
  }

  for (const variant of variants) {
    const { data: byPhone } = await db
      .from('leads')
      .select('id, contact_id')
      .eq('tenant_id', tenantId)
      .eq('phone', variant)
      .maybeSingle();

    if (byPhone) {
      const leadPatch: { contact_id: string; name?: string } = { contact_id: contactId };
      if (!byPhone.contact_id) leadPatch.name = name;
      await db.from('leads').update(leadPatch).eq('id', byPhone.id);
      return;
    }
  }

  await db.from('leads').insert({
    tenant_id: tenantId,
    contact_id: contactId,
    stage: 'new',
    phone,
    name,
    ai_active: true,
  });
}

/**
 * Idempotent insert of a Baileys message + contact + conversation + lead link.
 */
export async function persistBaileysMessage(
  input: PersistBaileysMessageInput
): Promise<{ conversationId: string; messageId: string; contactId: string } | null> {
  const { tenantId, messageId, phone, rawJid, sendJid, sessionId, pushName, text, fromMe, rawMessage } = input;
  const db = getSupabaseAdmin() as any;

  const { data: existingWa } = await db
    .from('messages')
    .select('id, conversation_id')
    .eq('wa_message_id', messageId)
    .maybeSingle();

  if (existingWa) {
    const { data: convRow } = await db
      .from('conversations')
      .select('contact_id')
      .eq('id', existingWa.conversation_id)
      .maybeSingle();
    return {
      conversationId: existingWa.conversation_id as string,
      messageId: existingWa.id as string,
      contactId: convRow?.contact_id as string,
    };
  }

  const idempotencyKey = `qr-${messageId}`;
  const { data: duplicateEvent } = await db
    .from('webhook_events')
    .select('id')
    .eq('external_event_id', idempotencyKey)
    .maybeSingle();

  if (duplicateEvent) return null;

  await db.from('webhook_events').insert({
    external_event_id: idempotencyKey,
    payload: { messageId, phone, raw_jid: rawJid, pushName, text, fromMe },
    tenant_id: tenantId,
  });

  const { data: existingContact } = await db
    .from('contacts')
    .select('id, name, metadata')
    .eq('tenant_id', tenantId)
    .eq('phone_number', phone)
    .maybeSingle();

  const contactName = resolveContactDisplayName({
    pushName,
    existingName: existingContact?.name,
  });

  const contactMetadata = {
    whatsapp_raw_jid: rawJid,
    ...(pushName ? { whatsapp_push_name: pushName } : {}),
  };

  let contactId: string;

  if (existingContact) {
    contactId = existingContact.id;
    await db
      .from('contacts')
      .update({
        metadata: {
          ...(typeof existingContact.metadata === 'object' && existingContact.metadata !== null
            ? existingContact.metadata
            : {}),
          ...contactMetadata,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);
  } else {
    const { data: newContact, error: contactErr } = await db
      .from('contacts')
      .insert({
        tenant_id: tenantId,
        phone_number: phone,
        name: contactName,
        metadata: contactMetadata,
      })
      .select('id')
      .single();

    if (contactErr || !newContact) throw contactErr ?? new Error('Failed to create contact');
    contactId = newContact.id;
  }

  await linkLeadsToContact(tenantId, contactId, phone, contactName);

  const { data: existingConv } = await db
    .from('conversations')
    .select('id, unread_count')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .maybeSingle();

  let conversationId: string;
  let unreadCount = 0;

  if (existingConv) {
    conversationId = existingConv.id;
    unreadCount = existingConv.unread_count ?? 0;
  } else {
    const { data: newConv, error: convErr } = await db
      .from('conversations')
      .insert({
        tenant_id: tenantId,
        contact_id: contactId,
        status: 'open',
        mode: 'bot',
        ai_enabled: true,
        unread_count: 0,
      })
      .select('id')
      .single();

    if (convErr || !newConv) throw convErr ?? new Error('Failed to create conversation');
    conversationId = newConv.id;
  }

  // DB enum: user = customer inbound, agent = outbound
  const senderType = fromMe ? 'agent' : 'user';

  // Process incoming Baileys media if present
  let mediaUrl: string | null = null;
  let messageType = 'text';
  let contentText = text;
  let mediaError: string | null = null;

  if (rawMessage && !fromMe) {
    let msgContent = rawMessage;
    if (msgContent.ephemeralMessage?.message) msgContent = msgContent.ephemeralMessage.message;
    if (msgContent.viewOnceMessage?.message) msgContent = msgContent.viewOnceMessage.message;
    if (msgContent.viewOnceMessageV2?.message) msgContent = msgContent.viewOnceMessageV2.message;
    if (msgContent.documentWithCaptionMessage?.message) msgContent = msgContent.documentWithCaptionMessage.message;

    let mediaMessage = null;
    let typeKey: 'image' | 'video' | 'audio' | 'document' | null = null;
    let extension = '';

    if (msgContent.imageMessage) {
      mediaMessage = msgContent.imageMessage;
      typeKey = 'image';
      extension = 'jpg';
    } else if (msgContent.videoMessage) {
      mediaMessage = msgContent.videoMessage;
      typeKey = 'video';
      extension = 'mp4';
    } else if (msgContent.audioMessage) {
      mediaMessage = msgContent.audioMessage;
      typeKey = 'audio';
      extension = 'ogg';
    } else if (msgContent.documentMessage) {
      mediaMessage = msgContent.documentMessage;
      typeKey = 'document';
      extension = msgContent.documentMessage.mimetype?.split('/')?.[1] || 'bin';
    }

    if (mediaMessage && typeKey) {
      messageType = typeKey;
      try {
        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(mediaMessage, typeKey);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }
        
        const randName = `${Math.random().toString(36).substring(2)}.${extension}`;
        const { data, error } = await db.storage.from('media').upload(`chat/${randName}`, buffer, {
          contentType: mediaMessage.mimetype || 'application/octet-stream',
        });
        
        if (error) {
          mediaError = `Storage upload error: ${error.message}`;
        } else if (data) {
          const { data: { publicUrl } } = db.storage.from('media').getPublicUrl(`chat/${randName}`);
          mediaUrl = publicUrl;
          contentText = mediaMessage.caption || `[${typeKey}]`;
        }
      } catch (err: any) {
        mediaError = `Download content error: ${err.message || String(err)}`;
        console.error('[inbox-persist] Failed to download/upload incoming Baileys media:', err);
      }
    }
  }

  const { data: insertedMsg, error: insertErr } = await db
    .from('messages')
    .insert({
      tenant_id: tenantId,
      conversation_id: conversationId,
      sender_type: senderType,
      content: contentText,
      message_type: messageType,
      media_url: mediaUrl,
      wa_message_id: messageId,
      metadata: { phone, raw_jid: rawJid, contact_name: contactName, media_error: mediaError },
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') return null;
    throw insertErr;
  }

  await db
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      unread_count: fromMe ? unreadCount : unreadCount + 1,
    })
    .eq('id', conversationId);

  try {
    const { broadcastMessageToRealtime } = await import('@/lib/realtime-broadcast');
    await broadcastMessageToRealtime(tenantId, conversationId, {
      id: insertedMsg.id,
      conversation_id: conversationId,
      sender_type: senderType,
      content: text,
      created_at: new Date().toISOString(),
    });
  } catch (broadcastErr) {
    logger.warn({ broadcastErr }, '[inbox-persist] Realtime broadcast failed (non-fatal)');
  }

  if (!fromMe && text.trim()) {
    const { scheduleAiAutoReply } = await import('@/lib/ai-auto-reply');
    const { data: session } = await db
      .from('whatsapp_qr_sessions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'connected')
      .order('last_connected_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    scheduleAiAutoReply({
      tenantId,
      conversationId,
      contactId,
      phone,
      rawJid,
      sendJid: sendJid || `${phone.replace(/\D/g, '')}@s.whatsapp.net`,
      inboundText: text,
      userMessageId: insertedMsg.id,
      sessionId: sessionId || session?.id,
    });
  }

  return { conversationId, messageId: insertedMsg.id, contactId };
}
