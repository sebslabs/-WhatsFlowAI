"use client";

/**
 * Global listener: toast + bell dropdown + browser notification for inbound WhatsApp messages and new leads.
 */
import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useNotificationsContext } from "@/context/NotificationsContext";
import { toast } from "@/hooks/use-toast";
import {
  useInboxRealtime,
  fetchClientTenantId,
  type RealtimeMessage,
} from "@/lib/hooks/use-inbox-realtime";
import { createClient } from "@/lib/supabase/client";
import {
  isIncomingWhatsAppMessage,
  shouldNotifyForMessage,
  shouldSuppressNotification,
  showBrowserNotification,
  requestBrowserNotificationPermission,
  playNotificationSound,
} from "@/lib/whatsapp-notifications";

async function resolveLeadForConversation(
  conversationId: string
): Promise<{ leadId?: string; leadName?: string }> {
  const supabase = createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("contact_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conv?.contact_id) return {};

  const { data: contact } = await supabase
    .from("contacts")
    .select("name")
    .eq("id", conv.contact_id)
    .maybeSingle();

  const { data: lead } = await supabase
    .from("leads")
    .select("id")
    .eq("contact_id", conv.contact_id)
    .maybeSingle();

  return {
    leadId: lead?.id || undefined,
    leadName: contact?.name || undefined,
  };
}

async function resolveContactForLead(
  contactId: string
): Promise<{ contactName?: string; contactPhone?: string }> {
  const supabase = createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone_number")
    .eq("id", contactId)
    .maybeSingle();

  return {
    contactName: contact?.name || undefined,
    contactPhone: contact?.phone_number || undefined,
  };
}

export function WhatsAppNotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const { addNotification } = useNotificationsContext();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const pathnameRef = useRef(pathname);

  pathnameRef.current = pathname;

  useEffect(() => {
    void requestBrowserNotificationPermission();
    void fetchClientTenantId().then(setTenantId);
  }, []);

  const handleIncoming = useCallback(
    async (msg: RealtimeMessage) => {
      if (!isIncomingWhatsAppMessage(msg.sender_type)) return;
      if (!shouldNotifyForMessage(msg.id)) return;
      if (shouldSuppressNotification(msg.conversation_id)) return;

      const preview = String(msg.content ?? "").trim() || "New message";
      const { leadId, leadName } = await resolveLeadForConversation(msg.conversation_id);
      const displayName = leadName || "WhatsApp contact";

      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      addNotification({
        type: "whatsapp_message",
        title: `New message from ${displayName}`,
        body: preview,
        time,
        read: false,
        actionLeadId: leadId,
      });

      // Play gorgeous digital notification chime
      playNotificationSound();

      toast(
        `${displayName}: ${preview.slice(0, 80)}${preview.length > 80 ? "…" : ""}`,
        "info"
      );

      const openConversation = () => {
        if (leadId) {
          router.push(`/dashboard/conversations?leadId=${leadId}`);
        } else {
          router.push("/dashboard/conversations");
        }
      };

      if (
        typeof document !== "undefined" &&
        (document.visibilityState !== "visible" ||
          !pathnameRef.current.startsWith("/dashboard/conversations"))
      ) {
        showBrowserNotification(
          "New WhatsApp message",
          `${displayName}: ${preview}`,
          openConversation
        );
      }
    },
    [addNotification, router]
  );

  // Subscribes to Socket.IO and Supabase for real-time messages
  useInboxRealtime({
    tenantId,
    conversationId: null,
    enabled: !!tenantId,
    onNewMessage: handleIncoming,
  });

  // Real-time subscription for newly created leads
  useEffect(() => {
    if (!tenantId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`inbox-leads:${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: `tenant_id=eq.${tenantId}`,
        },
        async (payload) => {
          const newLead = payload.new as { id: string; contact_id: string };
          if (!newLead?.id || !newLead.contact_id) return;

          // Resolve contact details (name and phone)
          const { contactName, contactPhone } = await resolveContactForLead(newLead.contact_id);
          const displayName = contactName || "New Lead";
          const displayPhone = contactPhone ? ` (${contactPhone})` : "";

          const time = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          addNotification({
            type: "whatsapp_message",
            title: `New Lead Created`,
            body: `${displayName}${displayPhone} has been added as a lead.`,
            time,
            read: false,
            actionLeadId: newLead.id,
          });

          // Play gorgeous digital notification chime
          playNotificationSound();

          toast(`New Lead: ${displayName}${displayPhone}`, "info");

          const openConversation = () => {
            router.push(`/dashboard/conversations?leadId=${newLead.id}`);
          };

          if (
            typeof document !== "undefined" &&
            (document.visibilityState !== "visible" ||
              !pathnameRef.current.startsWith("/dashboard/conversations"))
          ) {
            showBrowserNotification(
              "New Lead Created",
              `${displayName}${displayPhone} is ready for follow up.`,
              openConversation
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantId, addNotification, router]);

  return null;
}
