import { NextRequest, NextResponse } from 'next/server';
import { requireAuthApi } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const { user, supabase, error } = await requireAuthApi(request);
  if (error) return error;

  try {
    const { leadId, content, messageType = 'text', mediaUrl = null, mimeType = null, fileName = null, replyToId = null, replyToContent = null, replyToSender = null } = await request.json();

    const msgMetadata = (replyToId && replyToContent && replyToSender) ? {
      reply_to: {
        id: replyToId,
        content: replyToContent,
        sender_type: replyToSender
      }
    } : null;

    if (!leadId || (!content && !mediaUrl)) {
      return NextResponse.json({ error: 'Payload missing required fields: leadId, content/mediaUrl' }, { status: 400 });
    }

    // 1. Fetch the lead to acquire its phone and contact_id
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, contact_id, phone, name')
      .eq('id', leadId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Target lead context unavailable.' }, { status: 404 });
    }

    const phoneNumber = lead.phone;
    let contactId = lead.contact_id;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Lead has no registered phone credentials to contact.' }, { status: 400 });
    }

    // 2. Fallback: If contactId doesn't exist on the lead, find or create a Contact
    if (!contactId) {
      // Search contact by phone
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const plusPhone = `+${cleanPhone}`;
      const { data: existingContact } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', user.tenant_id)
        .or(`phone_number.eq.${cleanPhone},phone_number.eq.${plusPhone}`)
        .maybeSingle();

      if (existingContact) {
        contactId = existingContact.id;
        // Link back to lead for future integrity
        await supabase.from('leads').update({ contact_id: contactId }).eq('id', leadId);
      } else {
        // Create contact
        const { data: newContact, error: contactErr } = await supabase
          .from('contacts')
          .insert({
            tenant_id: user.tenant_id,
            phone_number: phoneNumber,
            name: lead.name,
          })
          .select('id')
          .single();
        
        if (contactErr) throw contactErr;
        contactId = newContact.id;
        await supabase.from('leads').update({ contact_id: contactId }).eq('id', leadId);
      }
    }

    // 3. Secure the matching Conversation record
    let conversationId = null;

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('tenant_id', user.tenant_id)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      // Create a fresh conversation record so the Express backend will accept the send payload
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          tenant_id: user.tenant_id,
          contact_id: contactId,
          status: 'open',
          mode: 'manual', // Flip to manual mode as agent is communicating directly
          ai_enabled: false
        })
        .select('id')
        .single();

      if (convErr) throw convErr;
      conversationId = newConv.id;
    }

    // 4. Check for active connected QR sessions
    const { data: qrSession } = await supabase
      .from('whatsapp_qr_sessions')
      .select('id, status')
      .eq('tenant_id', user.tenant_id)
      .eq('status', 'connected')
      .maybeSingle();

    if (qrSession) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:5000';
      const internalKey = process.env.INTERNAL_API_KEY || '';
      const formattedJid = `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`;
      
      const backendResponse = await fetch(`${apiUrl}/api/internal/baileys/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Key': internalKey,
        },
        body: JSON.stringify({
          tenantId: user.tenant_id,
          sessionId: qrSession.id,
          jid: formattedJid,
          text: content,
          messageType,
          mediaUrl,
          mimeType,
          fileName
        }),
      });

      if (!backendResponse.ok) {
        const errorData = await backendResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Baileys send gateway fault (HTTP ${backendResponse.status})`);
      }

      const backendResult = await backendResponse.json();
      const sentMsgId = backendResult.messageId || null;

      let insertedMsg = null;
      
      const fullInsert = await supabase
        .from('messages')
        .insert({
          tenant_id: user.tenant_id,
          conversation_id: conversationId,
          sender_type: 'agent', // Manual message sent by agent
          content: content || (messageType === 'image' ? '[image]' : messageType === 'audio' ? '[audio]' : '[document]'),
          message_type: messageType,
          media_url: mediaUrl,
          delivery_status: 'delivered',
          wa_message_id: sentMsgId,
          metadata: msgMetadata
        })
        .select()
        .maybeSingle();

      if (fullInsert.error) {
        logger.warn({ error: fullInsert.error }, 'Fallback: media message insert failed, falling back to safe basic insert');
        
        // Fallback: safe basic insert
        const safeInsert = await supabase
          .from('messages')
          .insert({
            tenant_id: user.tenant_id,
            conversation_id: conversationId,
            sender_type: 'agent',
            content: content || (messageType === 'image' ? '[image]' : messageType === 'audio' ? '[audio]' : '[document]'),
            delivery_status: 'delivered',
            wa_message_id: sentMsgId
          })
          .select()
          .single();
          
        if (safeInsert.error) throw safeInsert.error;
        insertedMsg = safeInsert.data;
      } else {
        insertedMsg = fullInsert.data;
      }

      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      if (insertedMsg) {
        const { broadcastMessageToRealtime } = await import('@/lib/realtime-broadcast');
        await broadcastMessageToRealtime(user.tenant_id, conversationId, {
          ...insertedMsg,
          conversation_id: conversationId,
        });
      }

      return NextResponse.json({ 
        success: true, 
        conversationId, 
        message: insertedMsg || { sender_type: 'agent', content, created_at: new Date().toISOString() } 
      });
    }

    // 5. Hand over to the active Express ecosystem via proxying (Meta Cloud API fallback)
    const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/whatsapp/send`;
    
    // Re-authorize with the user's incoming token structure to keep security chains unbroken
    const authHeader = request.headers.get('Authorization') || '';

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        conversationId,
        phoneNumber,
        content: content || (messageType === 'image' ? '[image]' : '[document]'),
        messageType,
        mediaUrl
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      throw new Error(errorData.error || `Gateway routing fault (HTTP ${backendResponse.status})`);
    }

    const backendResult = await backendResponse.json();
    
    // Immediately insert into logs optimistically to refresh UI quickly
    // The worker does this as well, but we insert to ensure instant reflection on agent send
    let insertedMsg = null;
    
    // Try full media insert first
    const fullInsert = await supabase
      .from('messages')
      .insert({
        tenant_id: user.tenant_id,
        conversation_id: conversationId,
        sender_type: 'agent',
        content: content || (messageType === 'image' ? '[image]' : messageType === 'audio' ? '[audio]' : '[document]'),
        message_type: messageType,
        media_url: mediaUrl,
        delivery_status: 'pending',
        metadata: msgMetadata
      })
      .select()
      .maybeSingle();

    if (fullInsert.error) {
      logger.warn({ error: fullInsert.error }, 'Fallback: media message insert failed, falling back to safe basic insert');
      
      // Fallback: safe basic insert
      const safeInsert = await supabase
        .from('messages')
        .insert({
          tenant_id: user.tenant_id,
          conversation_id: conversationId,
          sender_type: 'agent',
          content: content || (messageType === 'image' ? '[image]' : messageType === 'audio' ? '[audio]' : '[document]'),
          delivery_status: 'pending'
        })
        .select()
        .single();
        
      if (safeInsert.error) {
        logger.error({ error: safeInsert.error }, 'Fallback insert also failed');
      } else {
        insertedMsg = safeInsert.data;
      }
    } else {
      insertedMsg = fullInsert.data;
    }

    if (insertedMsg) {
      const { broadcastMessageToRealtime } = await import('@/lib/realtime-broadcast');
      await broadcastMessageToRealtime(user.tenant_id, conversationId, {
        ...insertedMsg,
        conversation_id: conversationId,
      });
    }

    return NextResponse.json({ 
      success: true, 
      conversationId, 
      message: insertedMsg || { sender_type: 'agent', content, created_at: new Date().toISOString() } 
    });

  } catch (err: any) {
    logger.error({ userId: user.id }, 'POST /api/conversations/send failed', err);
    return NextResponse.json({ error: 'Dispatch execution pipeline crashed.', details: err.message }, { status: 500 });
  }
}
