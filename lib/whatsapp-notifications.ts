/** Shared helpers for WhatsApp inbound message notifications */

const INCOMING_SENDER_TYPES = new Set(['user', 'customer', 'contact', 'lead']);

export function isIncomingWhatsAppMessage(senderType: string | undefined | null): boolean {
  if (!senderType) return false;
  return INCOMING_SENDER_TYPES.has(senderType.toLowerCase());
}

const seenMessageIds = new Set<string>();
const SEEN_CAP = 300;

/** Dedupe notifications when realtime fires twice (Socket.IO + Supabase). */
export function shouldNotifyForMessage(messageId: string): boolean {
  if (!messageId || seenMessageIds.has(messageId)) return false;
  seenMessageIds.add(messageId);
  if (seenMessageIds.size > SEEN_CAP) {
    const oldest = seenMessageIds.values().next().value;
    if (oldest) seenMessageIds.delete(oldest);
  }
  return true;
}

let activeConversationId: string | null = null;

/** Set from Conversations page so we skip alerts for the open thread. */
export function setActiveConversationId(conversationId: string | null): void {
  activeConversationId = conversationId;
}

export function getActiveConversationId(): string | null {
  return activeConversationId;
}

export function shouldSuppressNotification(conversationId: string): boolean {
  if (!activeConversationId || activeConversationId !== conversationId) return false;
  return typeof document !== 'undefined' && document.hasFocus();
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export function showBrowserNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const notification = new Notification(title, {
      body: body.slice(0, 200),
      icon: '/favicon.ico',
      tag: `whatsflow-wa-${Date.now()}`,
    });

    notification.onclick = () => {
      window.focus();
      onClick?.();
      notification.close();
    };
  } catch {
    /* Safari / restricted contexts */
  }
}

/** Plays a premium, pleasant dual-tone SaaS chime using browser Web Audio API */
export function playNotificationSound(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Pleasant dual-tone digital chime
    const now = ctx.currentTime;
    
    // First tone (higher pitch, soft synth)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second tone (slightly offset, harmonic warmth)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(440.00, now + 0.04); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.16); // E5
    
    gain2.gain.setValueAtTime(0.08, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.35);
    osc2.start(now + 0.04);
    osc2.stop(now + 0.5);
  } catch (error) {
    console.warn("Audio chime failed to initialize:", error);
  }
}
