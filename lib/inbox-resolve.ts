/**
 * Resolve all conversation IDs for a lead (contact_id + phone fallbacks).
 * Fixes split threads when lead.contact_id was not linked to Baileys contact.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export function normalizePhoneVariants(phone: string): string[] {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return [];
  return [clean, `+${clean}`];
}

export async function resolveConversationIdsForLead(
  supabase: SupabaseClient,
  tenantId: string,
  lead: { contact_id?: string | null; phone?: string | null }
): Promise<string[]> {
  const ids = new Set<string>();

  if (lead.contact_id) {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('contact_id', lead.contact_id)
      .maybeSingle();

    if (conv?.id) ids.add(conv.id);
  }

  if (lead.phone) {
    const variants = normalizePhoneVariants(lead.phone);

    for (const variant of variants) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('phone_number', variant);

      for (const contact of contacts ?? []) {
        const { data: convs } = await supabase
          .from('conversations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('contact_id', contact.id);

        for (const c of convs ?? []) {
          if (c.id) ids.add(c.id);
        }
      }
    }
  }

  return [...ids];
}
