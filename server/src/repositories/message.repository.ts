/**
 * Message Repository
 * All DB operations for `messages` table.
 * Uses correct schema field names (conversation_id, sender_type, wa_message_id, created_at).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Message, MsgSenderType } from '../types/db.types.js'

export interface InsertMessageDTO {
  tenant_id: string
  conversation_id: string
  sender_type: MsgSenderType
  content: string
  message_type?: string
  media_url?: string
  wa_message_id?: string
}

export class MessageRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Insert a new message. If wa_message_id is present, duplicate inserts
   * are silently ignored via the UNIQUE constraint.
   */
  async insert(dto: InsertMessageDTO): Promise<Message | null> {
    const { data, error } = await this.db
      .from('messages')
      .insert({
        tenant_id: dto.tenant_id,
        conversation_id: dto.conversation_id,
        sender_type: dto.sender_type,
        content: dto.content,
        message_type: dto.message_type ?? 'text',
        media_url: dto.media_url ?? null,
        wa_message_id: dto.wa_message_id ?? null,
      })
      .select()
      .single()

    // 23505 = unique_violation — duplicate wa_message_id, safe to ignore
    if (error) {
      if (error.code === '23505') return null
      throw new Error(`[MessageRepository.insert] ${error.message}`)
    }

    return data as Message
  }

  /** Fetch messages for a conversation, ordered chronologically. */
  async findByConversation(conversationId: string, limit = 50): Promise<Message[]> {
    // MEDIUM FIX (#5): Explicit column list — only fetch columns the Message type and
    // consumers actually use. Excludes any future heavy JSONB metadata columns.
    const { data, error } = await this.db
      .from('messages')
      .select('id, tenant_id, conversation_id, sender_type, content, message_type, media_url, wa_message_id, delivery_status, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) throw new Error(`[MessageRepository.findByConversation] ${error.message}`)
    return (data ?? []) as Message[]
  }

  /** Update delivery status for a sent message. */
  async updateDeliveryStatus(
    waMessageId: string,
    status: 'delivered' | 'read' | 'failed'
  ): Promise<void> {
    const { error } = await this.db
      .from('messages')
      .update({ delivery_status: status })
      .eq('wa_message_id', waMessageId)

    if (error) throw new Error(`[MessageRepository.updateDeliveryStatus] ${error.message}`)
  }
}
