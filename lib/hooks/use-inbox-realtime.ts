'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeMessage {
  id: string;
  conversation_id: string;
  sender_type: string;
  content: string;
  created_at: string;
  [key: string]: unknown;
}

export interface InboxUpdate {
  conversationId: string;
  preview: string;
  timestamp?: string;
  sender_type?: string;
  unread_delta?: number;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:5000';

export function useInboxRealtime(options: {
  tenantId: string | null;
  conversationId: string | null;
  onNewMessage: (msg: RealtimeMessage) => void;
  onInboxUpdate?: (update: InboxUpdate) => void;
  enabled?: boolean;
}) {
  const { tenantId, conversationId, onNewMessage, onInboxUpdate, enabled = true } = options;

  const socketRef = useRef<Socket | null>(null);
  const supabaseChannelRef = useRef<RealtimeChannel | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const onNewMessageRef = useRef(onNewMessage);
  const onInboxUpdateRef = useRef(onInboxUpdate);
  const tenantIdRef = useRef(tenantId);
  const conversationIdRef = useRef(conversationId);

  onNewMessageRef.current = onNewMessage;
  onInboxUpdateRef.current = onInboxUpdate;
  tenantIdRef.current = tenantId;
  conversationIdRef.current = conversationId;

  const joinRooms = useCallback((socket: Socket) => {
    const t = tenantIdRef.current;
    const c = conversationIdRef.current;
    if (!t) return;

    socket.emit('join', {
      tenant_id: t,
      conversation_id: c ?? undefined,
    });

    if (c) {
      socket.emit('join_conversation', c);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !tenantId) return;

    let cancelled = false;

    async function connectSocket() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token || cancelled) {
        console.warn('[useInboxRealtime] No auth session — skipping Socket.IO');
        return;
      }

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      const socket = io(WS_URL, {
        auth: { token: session.access_token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[useInboxRealtime] Socket.IO connected', socket.id);
        setSocketConnected(true);
        joinRooms(socket);
      });

      socket.on('disconnect', () => {
        setSocketConnected(false);
      });

      socket.io.on('reconnect', () => {
        joinRooms(socket);
      });

      socket.on('new_message', (msg: RealtimeMessage) => {
        onNewMessageRef.current(msg);
      });

      socket.on('inbox_update', (update: InboxUpdate) => {
        onInboxUpdateRef.current?.(update);
      });

      socket.on('connect_error', (err) => {
        setSocketConnected(false);
        console.error(
          '[useInboxRealtime] Socket.IO connect_error — using Supabase Realtime fallback.',
          err.message,
          'Ensure Express is running on',
          WS_URL,
          'and ALLOWED_ORIGIN includes your Next.js URL.'
        );
      });
    }

    async function subscribeSupabaseRealtime() {
      const supabase = createClient();
      if (supabaseChannelRef.current) {
        await supabase.removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }

      const channel = supabase
        .channel(`inbox-messages:${tenantId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `tenant_id=eq.${tenantId}`,
          },
          (payload) => {
            const row = payload.new as RealtimeMessage;
            if (!row?.id || !row.conversation_id) return;
            onNewMessageRef.current(row);
            onInboxUpdateRef.current?.({
              conversationId: row.conversation_id as string,
              preview: String(row.content ?? '').slice(0, 100),
              timestamp: (row.created_at as string) ?? new Date().toISOString(),
              sender_type: row.sender_type as string,
              unread_delta: row.sender_type === 'user' ? 1 : 0,
            });
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[useInboxRealtime] Supabase Realtime subscribed for messages');
          }
          if (status === 'CHANNEL_ERROR') {
            console.error('[useInboxRealtime] Supabase Realtime channel error');
          }
        });

      supabaseChannelRef.current = channel;
    }

    connectSocket();
    subscribeSupabaseRealtime();

    return () => {
      cancelled = true;
      setSocketConnected(false);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      if (supabaseChannelRef.current) {
        void createClient().removeChannel(supabaseChannelRef.current);
        supabaseChannelRef.current = null;
      }
    };
  }, [tenantId, enabled, joinRooms]);

  // Re-join conversation room when active thread changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !tenantId) return;

    joinRooms(socket);

    return () => {
      if (socket.connected && conversationId) {
        socket.emit('leave_conversation', conversationId);
      }
    };
  }, [conversationId, tenantId, joinRooms]);

  return { socket: socketRef.current, socketConnected };
}

/** Resolve tenant id for the logged-in user (client-side). */
export async function fetchClientTenantId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (member?.tenant_id) return member.tenant_id as string;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();

  return (profile?.organization_id as string) ?? null;
}
