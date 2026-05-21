/**
 * Conversation Repository
 * All DB operations for `conversations` and `contacts` tables.
 * Ensures a conversation always exists before messages are inserted.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, Conversation } from '../types/db.types.js'

export class ConversationRepository {
  constructor(private readonly db: SupabaseClient) {}

  /**
   * Find existing contact by phone number (tenant-scoped).
   * The unique constraint is: (tenant_id, phone)
   */
  async findContactByPhone(tenantId: string, phone: string): Promise<Contact | null> {
    // MEDIUM FIX (#5): Explicit column list — avoids over-fetching unused contact columns.
    const { data, error } = await this.db
      .from('contacts')
      .select('id, tenant_id, phone, name, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('phone', phone)
      .maybeSingle()

    if (error) throw new Error(`[ConversationRepository.findContactByPhone] ${error.message}`)
    return data as Contact | null
  }

  /**
   * Create a new contact. On conflict (tenant_id, phone), returns the existing row.
   */
  async upsertContact(tenantId: string, phone: string, name = 'New Contact'): Promise<Contact> {
    const { data, error } = await this.db
      .from('contacts')
      .upsert(
        { tenant_id: tenantId, phone, name },
        { onConflict: 'tenant_id,phone', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw new Error(`[ConversationRepository.upsertContact] ${error.message}`)
    return data as Contact
  }

  /**
   * Find conversation for a contact (1 contact → 1 conversation per tenant, enforced by unique constraint).
   */
  async findByContact(tenantId: string, contactId: string): Promise<Conversation | null> {
    // MEDIUM FIX (#5): Explicit column list — avoids over-fetching unused conversation columns.
    const { data, error } = await this.db
      .from('conversations')
      .select('id, tenant_id, contact_id, status, mode, last_message_at, unread_count, created_at, updated_at')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .maybeSingle()

    if (error) throw new Error(`[ConversationRepository.findByContact] ${error.message}`)
    return data as Conversation | null
  }

  /**
   * Create a conversation for a contact.
   * On conflict (tenant_id, contact_id) returns the existing row.
   */
  async upsertConversation(tenantId: string, contactId: string): Promise<Conversation> {
    const { data, error } = await this.db
      .from('conversations')
      .upsert(
        {
          tenant_id: tenantId,
          contact_id: contactId,
          status: 'open',
          mode: 'ai',
        },
        { onConflict: 'tenant_id,contact_id', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) throw new Error(`[ConversationRepository.upsertConversation] ${error.message}`)
    return data as Conversation
  }

  /**
   * Touch last_message_at and increment unread_count atomically.
   */
  async touchLastMessage(conversationId: string): Promise<void> {
    const { error } = await this.db.rpc('increment_unread_and_touch', {
      p_conversation_id: conversationId,
    })

    // If RPC doesn't exist yet, fall back to explicit update
    if (error) {
      await this.db
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId)
    }
  }

  /**
   * Switch conversation mode (ai → manual on human handover).
   */
  async setMode(
    tenantId: string,
    conversationId: string,
    mode: 'ai' | 'manual' | 'flow'
  ): Promise<void> {
    const { error } = await this.db
      .from('conversations')
      .update({ mode })
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)

    if (error) throw new Error(`[ConversationRepository.setMode] ${error.message}`)
  }
}
