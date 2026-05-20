"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, Pause, Play, ChevronRight, X, Loader2, Send, MessageSquare, MessagesSquare, FileText, Download, Image, Smile, Paperclip, CornerUpLeft, Trash2, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api-config";
import { timeAgo, formatTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import {
  useInboxRealtime,
  fetchClientTenantId,
  type RealtimeMessage,
  type InboxUpdate,
} from "@/lib/hooks/use-inbox-realtime";
import { setActiveConversationId } from "@/lib/whatsapp-notifications";

export type LeadStage = "New" | "Contacted" | "Qualifying" | "Qualified" | "Proposal" | "Booked" | "Lost";

export interface ConversationMessage {
  id: string;
  sender: "user" | "contact" | "ai" | "system";
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  conversationId?: string;
  leadName?: string;
  phone?: string;
  stage: LeadStage;
  lastMessage?: string;
  lastMessageTime: string;
  aiActive?: boolean;
  unreadCount?: number;
}

function StageBadge({ stage, onChange }: { stage: LeadStage; onChange?: (s: LeadStage) => void }) {
  const config: Record<string, { variant: "success" | "blue" | "gray" | "destructive" | "warning"; label: string }> = {
    Booked: { variant: "success", label: "Booked" },
    Qualified: { variant: "blue", label: "Qualified" },
    Qualifying: { variant: "warning", label: "Qualifying" },
    New: { variant: "gray", label: "New" },
    Lost: { variant: "destructive", label: "Lost" },
  };

  const norm = stage?.toLowerCase() || "";
  let item = config.New;
  if (norm === "booked") item = config.Booked;
  else if (norm === "qualified") item = config.Qualified;
  else if (norm === "qualifying") item = config.Qualifying;
  else if (norm === "new") item = config.New;
  else if (norm === "lost") item = config.Lost;

  const { variant, label } = item;

  const badge = (
    <Badge variant={variant as any} className={cn("rounded-lg", onChange && "cursor-pointer hover:opacity-80 transition-opacity")}>
      {label}
    </Badge>
  );

  if (!onChange) return badge;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {Object.keys(config).map((key) => (
          <DropdownMenuItem key={key} onClick={() => onChange(key as LeadStage)}>
            {config[key].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    name: "Smileys & Emotion",
    icon: "😊",
    emojis: [
      "😊", "😂", "🥰", "😍", "😘", "😜", "😎", "🤩", "🥳", "🤔", 
      "😅", "😉", "😌", "🤤", "😴", "🙄", "😭", "😢", "😡", "😱",
      "🤫", "😬", "😐", "😷", "🤠", "😈", "👻", "💩", "👽", "🤖"
    ]
  },
  {
    id: "people",
    name: "Gestures & People",
    icon: "👍",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👋", "👏", "🙌", 
      "🙏", "🤝", "💪", "✍️", "🤳", "🙋", "💁", "🤦", "🤷", "👑",
      "👨", "👩", "👦", "👧", "👶", "👵", "👴", "👮", "👷", "🧑‍💻"
    ]
  },
  {
    id: "symbols",
    name: "Hearts & Symbols",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💗",
      "🔥", "✨", "🌟", "💥", "💯", "🎉", "🎈", "🎁", "🎂", "🎄",
      "⭐", "✅", "❌", "🚫", "⚠️", "🌀", "🎵", "💬", "💭", "✉️"
    ]
  },
  {
    id: "objects",
    name: "Work & Objects",
    icon: "💼",
    emojis: [
      "💡", "🚀", "💻", "📱", "📊", "📈", "📅", "📌", "💼", "💰", 
      "🔍", "🛒", "🛠️", "⚙️", "📣", "🔔", "🔑", "🔒", "✏️", "💵",
      "✈️", "🚗", "🏠", "🏢", "☕", "🍕", "🍺", "🍷", "🍎", "🌍"
    ]
  }
];

const EMOJI_NAMES: Record<string, string> = {
  "😊": "smile happy good warm", "😂": "laugh cry lol tears funny", "🥰": "love heart happy warm", "😍": "love eye hearts cute", 
  "😘": "kiss blow love heart", "😜": "wink tongue crazy playful", "😎": "cool sunglasses chill confident", "🤩": "star eyes excited cool",
  "🥳": "party celebrate birthday", "🤔": "think question doubt wonder", "😅": "sweat laugh funny relieved", "😉": "wink play flirt",
  "😌": "relieved calm peace", "🤤": "drool delicious want", "😴": "sleep tired lazy nap", "🙄": "eye roll annoying",
  "😭": "cry sob sad pain loud", "😢": "sad cry tear down", "😡": "angry mad upset", "😱": "scared shock gasp scream",
  "🤫": "shh quiet silence whisper", "😬": "grimace awkward teeth tense", "😐": "neutral blank meh face", "😷": "mask sick hospital cold",
  "🤠": "cowboy hat west country", "😈": "devil evil purple smile", "👻": "ghost spooky halloween scary", "💩": "poop dump funny brown",
  "👽": "alien space ufo monster", "🤖": "robot bot machine tech",
  "👍": "like thumbsup yes good ok", "👎": "dislike thumbsdown no bad", "👌": "ok perfect hand zero correct", "✌️": "peace victory two",
  "🤞": "cross fingers luck hope promise", "🤟": "love sign hand you", "🤘": "rock metal horn hand", "👋": "wave hello goodbye hi",
  "👏": "clap praise good job", "🙌": "hooray praise celebrate success", "🙏": "pray thank please hands hope", "🤝": "shake hands deal business",
  "💪": "muscle flex strength strong", "✍️": "write pencil pen note draft", "🤳": "selfie photo camera smartphone", "🙋": "hand up ask question check",
  "💁": "help desk service support guide", "🤦": "facepalm error mistake oop", "🤷": "shrug dunno confuse", "👑": "king queen crown gold power",
  "👨": "man male guy", "👩": "woman female lady", "👦": "boy young kid male", "👧": "girl young kid female",
  "👶": "baby infant child cute", "👵": "grandma grandmother old female", "👴": "grandpa grandfather old male", "👮": "police cop law security",
  "👷": "worker helmet builder industry", "🧑‍💻": "coder developer programming laptop tech",
  "❤️": "love heart red beautiful", "🧡": "love heart orange", "💛": "love heart yellow", "💚": "love heart green",
  "💙": "love heart blue", "💜": "love heart purple", "🖤": "love heart black", "🤍": "love heart white",
  "💖": "love heart sparkle shiny", "💗": "love heart grow heart beat", "🔥": "fire hot flame match popular trend", "✨": "sparkle shine glow magical stars",
  "🌟": "star glow bright yellow", "💥": "collision explosion bang", "💯": "hundred percent perfect core", "🎉": "tada celebrate party win balloon",
  "🎈": "balloon celebrate party fun", "🎁": "gift present box package birthday", "🎂": "cake birthday candle sweet", "🎄": "christmas tree holiday celebration",
  "⭐": "star yellow favorite rate", "✅": "check correct green tick ok", "❌": "cross wrong delete error no red", "🚫": "ban stop restricted no",
  "⚠️": "warning alert danger caution yellow", "🌀": "cyclone vortex wave breeze", "🎵": "music note sound song melody", "💬": "chat bubble conversation text talk",
  "💭": "thought bubble dream think idea", "✉️": "email envelope mail letter post",
  "💡": "idea bulb lamp light genius creative", "🚀": "rocket launch start grow space tech", "💻": "computer laptop screen work developer", "📱": "phone smartphone mobile call device",
  "📊": "bar chart graph stats progress data", "📈": "graph up growth scale rise success", "📅": "calendar date schedule event day", "📌": "pushpin pin mark map note",
  "💼": "briefcase work business portfolio job", "💰": "money bag cash gold rich rich dollars", "🔍": "search magnifying glass find lookup zoom", "🛒": "cart shopping store market buy",
  "🛠️": "tools hammer wrench repair fix construct", "⚙️": "gear settings options configure mechanism", "📣": "megaphone announce broadcast news volume", "🔔": "bell alert notification ring sound",
  "🔑": "key open lock access secure", "🔒": "lock secure closed safe key", "✏️": "pencil write draw sketch note", "💵": "dollar banknote cash money paper",
  "✈️": "airplane fly travel trip holiday sky", "🚗": "car drive auto transport road travel", "🏠": "house home building family live", "🏢": "office business corporate work building",
  "☕": "coffee cup tea warm breakfast drink", "🍕": "pizza slice cheese food fast", "🍺": "beer glass drink bar alcohol celebrate", "🍷": "wine glass drink bar alcohol grape",
  "🍎": "apple fruit red sweet healthy food", "🌍": "earth globe world planet continent travel"
};

export function ConversationViewer() {
  const searchParams = useSearchParams();
  const urlLeadId = searchParams.get("leadId");
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Active chat stream state
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typedMessage, setTypedMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isTogglingAI, setIsTogglingAI] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  
  // Custom attachment & emoji picker states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState("smileys");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Track user-initiated clicks to prevent race conditions on initial load
  const hasClickedRef = useRef(false);

  const handleDeleteMessage = async (messageId: string) => {
    const previousMessages = [...messages];
    setMessages(prev => prev.filter(m => m.id !== messageId));
    
    try {
      const res = await apiFetch(`/api/conversations/messages/${messageId}`, {
        method: 'DELETE'
      });
      
      if (!res.success) {
        throw new Error("API rejection");
      }
      toast("Message deleted successfully.", "success");
    } catch (err: any) {
      toast("Failed to delete message.", "error");
      setMessages(previousMessages);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setTypedMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    setEmojiSearch("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("File size exceeds the 10MB upload limit", "error");
      if (e.target) e.target.value = "";
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const conversationsRef = useRef(conversations);

  activeIdRef.current = activeId;
  conversationsRef.current = conversations;

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const formatRealtimeMessage = useCallback((newMsg: RealtimeMessage) => ({
    id: newMsg.id,
    side: ['user', 'customer', 'contact', 'lead'].includes(newMsg.sender_type) ? 'left' : 'right',
    content: newMsg.content,
    timestamp: newMsg.created_at,
    sender_type: newMsg.sender_type,
  }), []);

  const refreshConversationList = useCallback(async () => {
    try {
      const data = await apiFetch('/api/conversations');
      setConversations(data);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  }, []);

  const handleRealtimeMessage = useCallback((newMsg: RealtimeMessage) => {
    const convs = conversationsRef.current;
    const currentActiveId = activeIdRef.current;
    const activeConv = convs.find((c) => c.id === currentActiveId);
    const activeConvId = activeConv?.conversationId;

    const inList = convs.some((c) => c.conversationId === newMsg.conversation_id);

    if (activeConvId && newMsg.conversation_id === activeConvId) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsg.id)) return prev;
        return [...prev, formatRealtimeMessage(newMsg)];
      });

      // The user is currently viewing this open chat. Reset the database unread count immediately
      // so it stays cleared upon next polls/loads!
      const supabaseClient = createClient();
      supabaseClient
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', activeConvId)
        .then(({ error }) => {
          if (error) console.error('Failed to reset live unread count:', error);
        });
    }

    if (!inList) {
      void refreshConversationList();
    } else {
      setConversations((prev) =>
        prev.map((c) =>
          c.conversationId === newMsg.conversation_id
            ? {
                ...c,
                lastMessage: newMsg.content,
                lastMessageTime: newMsg.created_at,
                unreadCount:
                  activeConvId === newMsg.conversation_id
                    ? 0
                    : ['user', 'customer'].includes(newMsg.sender_type)
                      ? (c.unreadCount || 0) + 1
                      : c.unreadCount,
              }
            : c
        )
      );
    }
  }, [formatRealtimeMessage, refreshConversationList]);

  const handleInboxUpdate = useCallback((update: InboxUpdate) => {
    const activeConvId = conversationsRef.current.find((c) => c.id === activeIdRef.current)
      ?.conversationId;

    setConversations((prev) => {
      const exists = prev.some((c) => c.conversationId === update.conversationId);
      if (!exists) {
        void refreshConversationList();
        return prev;
      }

      return prev.map((c) => {
        const isCurrentActive = c.conversationId === activeConvId;
        if (isCurrentActive && (update.unread_delta || 0) > 0) {
          // If we receive an unread update for the currently active conversation, reset it in Supabase
          const supabaseClient = createClient();
          supabaseClient
            .from('conversations')
            .update({ unread_count: 0 })
            .eq('id', activeConvId)
            .then(({ error }) => {
              if (error) console.error('Failed to reset live unread count from update:', error);
            });
        }

        return c.conversationId === update.conversationId
          ? {
              ...c,
              lastMessage: update.preview,
              lastMessageTime: update.timestamp || c.lastMessageTime,
              unreadCount: isCurrentActive ? 0 : (c.unreadCount || 0) + (update.unread_delta || 0),
            }
          : c;
      });
    });
  }, [refreshConversationList]);

  useEffect(() => {
    fetchClientTenantId().then(setTenantId);
  }, []);

  const activeConversationId =
    conversations.find((c) => c.id === activeId)?.conversationId ?? null;

  const { socketConnected } = useInboxRealtime({
    tenantId,
    conversationId: activeConversationId,
    onNewMessage: handleRealtimeMessage,
    onInboxUpdate: handleInboxUpdate,
    enabled: !!tenantId,
  });

  // Fallback poll when Socket.IO is down (Express/Redis not running) or as safety net
  useEffect(() => {
    if (!activeId) return;

    let active = true;
    const pollMs = socketConnected ? 15_000 : 5_000;

    const refreshMessages = async () => {
      try {
        const data = await apiFetch(`/api/leads/${activeId}/conversation?page=1&pageSize=50`);
        if (!active) return;

        const list = Array.isArray(data) ? data : (data?.messages ?? []);
        if (!Array.isArray(list)) return;
        setMessages((prev) => {
          if (prev.length === list.length && prev[prev.length - 1]?.id === list[list.length - 1]?.id) {
            return prev;
          }
          return list;
        });
      } catch {
        /* ignore transient poll errors */
      }
    };

    const interval = setInterval(refreshMessages, pollMs);
    
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeId, socketConnected]);

  // Load conversation list once (Socket.IO handles live updates)
  useEffect(() => {
    async function loadConversations() {
      try {
        const data = await apiFetch('/api/conversations');
        setConversations(data);
        
        if (urlLeadId && data.some((c: Conversation) => c.id === urlLeadId)) {
          setActiveId(urlLeadId);
        } else if (data.length > 0) {
          // Use functional updater to read the current activeId safely
          // and avoid resetting it if it has already been set by a user action.
          setActiveId((prev) => {
            if (prev || hasClickedRef.current) return prev;
            return data[0].id;
          });
        }
      } catch (err) {
        console.error("Failed to load conversations:", err);
      } finally {
        setLoading(false);
      }
    }
    loadConversations();
  }, [urlLeadId]);

  // Initial history load when switching threads (Socket.IO handles live updates)
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    // Instantly clear old messages to prevent flashing before new ones load
    setMessages([]);

    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, unreadCount: 0 } : c))
    );

    setActiveConversationId(activeConversationId ?? null);

    if (activeConversationId) {
      const supabaseClient = createClient();
      supabaseClient
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', activeConversationId)
        .then(({ error }) => {
          if (error) console.error('Failed to reset unread count:', error);
        });
    }

    let cancelled = false;

    async function loadMessages() {
      setLoadingMessages(true);
      try {
        const data = await apiFetch(`/api/leads/${activeId}/conversation?page=1&pageSize=50`);
        const list = Array.isArray(data) ? data : (data?.messages ?? []);
        if (!cancelled && Array.isArray(list)) {
          setMessages(list);
        }
      } catch (err) {
        console.error('Trace loading failure.', err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
      setActiveConversationId(null);
    };
  }, [activeId, activeConversationId]);

  // WhatsApp-style auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0 && !loadingMessages) {
      scrollToBottom();
    }
  }, [messages, loadingMessages, scrollToBottom]);

  // Trigger manual direct send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const hasFile = !!selectedFile;
    if (!typedMessage.trim() && !hasFile) return;
    if (!activeId || isSending || isUploading) return;

    const msgContent = typedMessage.trim();
    setTypedMessage("");
    
    // Capture and clear replyTo state
    const currentReplyTo = replyTo;
    setReplyTo(null);

    // Clear attachment state locally
    const originalFile = selectedFile;
    const originalPreview = filePreview;
    clearSelectedFile();

    setIsSending(true);

    // Optimistic display update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      side: 'right', // manual agent
      content: hasFile ? (originalFile!.name) : msgContent,
      timestamp: new Date().toISOString(),
      isPending: true,
      message_type: hasFile ? (originalFile!.type.startsWith('image/') ? 'image' : 'document') : 'text',
      media_url: originalPreview,
      metadata: currentReplyTo ? {
        reply_to: {
          id: currentReplyTo.id,
          content: currentReplyTo.content,
          sender_type: currentReplyTo.sender_type
        }
      } : null
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      let uploadedMediaUrl = null;
      let uploadedFileType = 'text';
      let uploadedMimeType = '';
      let originalName = '';

      if (hasFile) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', originalFile!);

          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          const headers: Record<string, string> = session?.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {};

          const uploadResponse = await fetch('/api/conversations/upload', {
            method: 'POST',
            headers,
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errData = await uploadResponse.json().catch(() => ({}));
            throw new Error(errData.error || 'Upload failed');
          }

          const uploadData = await uploadResponse.json();
          uploadedMediaUrl = uploadData.url;
          uploadedFileType = uploadData.type.startsWith('image/') ? 'image' : 'document';
          uploadedMimeType = uploadData.type;
          originalName = uploadData.name;
        } finally {
          setIsUploading(false);
        }
      }

      const res = await apiFetch('/api/conversations/send', {
        method: 'POST',
        body: JSON.stringify({
          leadId: activeId,
          content: hasFile ? originalName : msgContent,
          messageType: uploadedFileType,
          mediaUrl: uploadedMediaUrl,
          mimeType: uploadedMimeType,
          fileName: originalName,
          replyToId: currentReplyTo?.id || null,
          replyToContent: currentReplyTo?.content || null,
          replyToSender: currentReplyTo?.sender_type || null
        })
      });

      if (res.success) {
        const serverMsg = res.message;
        if (serverMsg?.id) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempId);
            if (withoutTemp.some((m) => m.id === serverMsg.id)) return withoutTemp;
            return [
              ...withoutTemp,
              {
                id: serverMsg.id,
                side: 'right',
                content: serverMsg.content ?? (hasFile ? originalName : msgContent),
                timestamp: serverMsg.created_at ?? new Date().toISOString(),
                sender_type: serverMsg.sender_type ?? 'agent',
                message_type: serverMsg.message_type ?? uploadedFileType,
                media_url: serverMsg.media_url ?? uploadedMediaUrl,
                metadata: serverMsg.metadata ?? (currentReplyTo ? {
                  reply_to: {
                    id: currentReplyTo.id,
                    content: currentReplyTo.content,
                    sender_type: currentReplyTo.sender_type
                  }
                } : null)
              },
            ];
          });
        } else {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, isPending: false, media_url: uploadedMediaUrl } : m))
          );
        }
      } else {
        throw new Error("Gateway rejection.");
      }
    } catch (err: any) {
      toast("Message delivery failed.", "error");
      // Keep in log but tag with error
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, isError: true } : m));
    } finally {
      setIsSending(false);
    }
  };

  // ── Voice Recording Logic ──────────────────────────────────────────────────

  const startRecording = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices) {
      toast("Audio recording is not supported in this browser.", "error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/ogg; codecs=opus" });
        const voiceFile = new File([audioBlob], `voice-note-${Date.now()}.ogg`, {
          type: "audio/ogg; codecs=opus",
        });

        await sendVoiceMessage(voiceFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start audio recording:", err);
      toast("Please allow microphone access to record voice messages.", "error");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (!mediaRecorderRef.current) return;
    
    mediaRecorderRef.current.onstop = () => {
      const stream = mediaRecorderRef.current?.stream;
      stream?.getTracks().forEach((track) => track.stop());
    };

    mediaRecorderRef.current.stop();
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    toast("Voice note discarded.", "info");
  };

  const sendVoiceMessage = async (file: File) => {
    if (!activeId || isSending) return;
    setIsSending(true);

    const currentReplyTo = replyTo;
    setReplyTo(null);

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      side: 'right',
      content: "[voice note]",
      timestamp: new Date().toISOString(),
      isPending: true,
      message_type: 'audio',
      media_url: '',
      metadata: currentReplyTo ? {
        reply_to: {
          id: currentReplyTo.id,
          content: currentReplyTo.content,
          sender_type: currentReplyTo.sender_type
        }
      } : null
    };
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      let uploadedMediaUrl = null;
      let uploadedFileType = 'audio';
      let uploadedMimeType = file.type || "audio/ogg; codecs=opus";
      let originalName = file.name;

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};

        const uploadResponse = await fetch('/api/conversations/upload', {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errData = await uploadResponse.json().catch(() => ({}));
          throw new Error(errData.error || 'Upload failed');
        }

        const uploadData = await uploadResponse.json();
        uploadedMediaUrl = uploadData.url;
        uploadedMimeType = uploadData.type;
        originalName = uploadData.name;
      } finally {
        setIsUploading(false);
      }

      const res = await apiFetch('/api/conversations/send', {
        method: 'POST',
        body: JSON.stringify({
          leadId: activeId,
          content: "",
          messageType: uploadedFileType,
          mediaUrl: uploadedMediaUrl,
          mimeType: uploadedMimeType,
          fileName: originalName,
          replyToId: currentReplyTo?.id || null,
          replyToContent: currentReplyTo?.content || null,
          replyToSender: currentReplyTo?.sender_type || null
        })
      });

      if (res.success) {
        const serverMsg = res.message;
        if (serverMsg?.id) {
          setMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempId);
            if (withoutTemp.some((m) => m.id === serverMsg.id)) return withoutTemp;
            return [
              ...withoutTemp,
              {
                id: serverMsg.id,
                side: 'right',
                content: serverMsg.content ?? "[voice note]",
                timestamp: serverMsg.created_at ?? new Date().toISOString(),
                sender_type: serverMsg.sender_type ?? 'agent',
                message_type: serverMsg.message_type ?? uploadedFileType,
                media_url: serverMsg.media_url ?? uploadedMediaUrl,
                metadata: serverMsg.metadata ?? (currentReplyTo ? {
                  reply_to: {
                    id: currentReplyTo.id,
                    content: currentReplyTo.content,
                    sender_type: currentReplyTo.sender_type
                  }
                } : null)
              }
            ];
          });
        }
      }
    } catch (err: any) {
      console.error("Failed to send voice message:", err);
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast(err.message || "Failed to send voice message", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleAI = async () => {
    if (!activeId || isTogglingAI) return;
    
    const targetMode = active?.aiActive ? "manual" : "ai";
    setIsTogglingAI(true);

    try {
      const res = await apiFetch('/api/conversations/toggle-ai', {
        method: 'POST',
        body: JSON.stringify({
          leadId: activeId,
          mode: targetMode
        })
      });

      if (res.success) {
        // Optimistically update active configuration inside collection
        setConversations(prev => prev.map(c => 
          c.id === activeId ? { ...c, aiActive: targetMode === "ai" } : c
        ));
        toast(`AI autonomy ${targetMode === "ai" ? "engaged" : "paused"}.`, "success");
      }
    } catch (err: any) {
      toast(err.message || "Failed toggling autonomous system mode.", "error");
    } finally {
      setIsTogglingAI(false);
    }
  };

  const handleStageChange = async (newStage: LeadStage) => {
    if (!activeId || !active) return;
    const oldStage = active.stage;
    
    // Optimistic update
    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, stage: newStage } : c));
    
    try {
      const res = await apiFetch('/api/leads', {
        method: 'PATCH',
        body: JSON.stringify({ id: activeId, stage: newStage })
      });
      if (res && res.error) throw new Error(res.error);
      toast("Lead stage updated successfully", "success");
    } catch (err: any) {
      // Revert on fail
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, stage: oldStage } : c));
      toast(err.message || "Failed to update lead stage", "error");
    }
  };

  const active = conversations.find((c) => c.id === activeId);
  
  // Search / Filter implementations
  const [searchTerm, setSearchTerm] = useState("");
  const filters = ["All", "New", "Contacted", "Qualifying", "Qualified", "Proposal", "Booked", "Lost"];
  
  const filteredConversations = conversations.filter((c) => {
    const matchesSearch = (c.leadName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (c.phone || '').includes(searchTerm);
                         
    if (!matchesSearch) return false;
    
    if (filter === "all") return true;
    return c.stage?.toLowerCase() === filter.toLowerCase();
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-[#111827] shadow-lg shadow-slate-100/40 dark:shadow-none transition-colors duration-300">
      {/* Left panel: Threads */}
      <div className="w-80 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-white dark:bg-[#111827]">
        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 focus:border-[#22C55E] transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide bg-white dark:bg-[#111827]">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={cn(
                "text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl whitespace-nowrap transition-all duration-200",
                filter === f.toLowerCase()
                  ? "bg-gradient-to-r from-[#22C55E] to-[#10B981] text-white shadow-sm shadow-emerald-500/15"
                  : "bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto bg-white dark:bg-[#111827] p-2 space-y-1.5 scrollbar-thin">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center justify-center h-48 text-slate-400 dark:text-slate-500">
              <MessageSquare className="w-8 h-8 opacity-30 mb-2" />
              <p className="text-xs font-bold">No conversations match filter.</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  hasClickedRef.current = true;
                  setActiveId(conv.id);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-xl border border-transparent transition-all duration-200 relative",
                  activeId === conv.id
                    ? "bg-gradient-to-r from-[#22C55E]/10 to-[#10B981]/5 dark:from-[#22C55E]/10 dark:to-transparent border-[#22C55E]/20 shadow-sm"
                    : "hover:bg-slate-50 dark:hover:bg-slate-850/40"
                )}
              >
                {/* Active Indicator Line */}
                {activeId === conv.id && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#22C55E] rounded-r-full" />
                )}
                
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22C55E] to-[#10B981] text-white flex items-center justify-center shadow-sm font-black text-xs tracking-wider">
                      {conv.leadName?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "?"}
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-[#111827]",
                        conv.aiActive ? "bg-[#22C55E]" : "bg-amber-500"
                      )}
                      title={conv.aiActive ? "AI Mode Active" : "Manual Mode Active"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-850 dark:text-slate-100 truncate">
                        {conv.leadName || "New Lead"}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold shrink-0 ml-1">
                        {timeAgo(conv.lastMessageTime)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate font-semibold leading-normal flex-1">
                        {conv.lastMessage || "Click to start communication"}
                      </p>
                      {conv.unreadCount !== undefined && conv.unreadCount > 0 && (
                        <span className="shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-gradient-to-r from-[#22C55E] to-[#10B981] px-1 text-[9px] font-black text-white shadow-sm shadow-[#22C55E]/30 animate-pulse">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel: Selected Chat Log */}
      {active ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFC] dark:bg-[#090D16] bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] dark:bg-[radial-gradient(#1e293b_1.5px,transparent_1.5px)] [background-size:24px_24px]">
          {/* Chat header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/85 dark:bg-[#111827]/85 backdrop-blur-md shrink-0 sticky top-0 z-30 shadow-sm transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22C55E] to-[#10B981] text-white flex items-center justify-center shadow-md shadow-emerald-500/10 font-bold text-sm">
                {active.leadName?.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase() || "?"}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                    {active.leadName || "New Lead"}
                  </p>
                  <StageBadge stage={active.stage} onChange={handleStageChange} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  <span>{active.phone}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-350 dark:bg-slate-700" />
                  <span className="flex items-center gap-1">
                    <span className={cn("w-1.5 h-1.5 rounded-full", active.aiActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
                    {active.aiActive ? "AI Copilot Active" : "Manual Override"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleAI}
                disabled={isTogglingAI}
                className={cn(
                  "h-9 px-4 text-xs font-black uppercase tracking-wider rounded-xl active:scale-95 transition-all shadow-sm border-none flex items-center gap-1.5",
                  active.aiActive
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-650 text-white shadow-md shadow-amber-500/15"
                    : "bg-gradient-to-r from-[#22C55E] to-[#10B981] hover:from-[#16A34A] hover:to-[#059669] text-white shadow-md shadow-emerald-500/15"
                )}
              >
                {isTogglingAI ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : active.aiActive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pause AI Autopilot</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Resume AI Autopilot</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 flex flex-col">
            {loadingMessages && messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center h-full gap-2 opacity-60">
                <MessageSquare className="w-9 h-9 text-slate-400" />
                <p className="text-xs font-black text-slate-750 dark:text-slate-200">Initialize conversation with {active.leadName || 'Lead'}</p>
                <p className="text-[10px] font-bold text-slate-400 max-w-[240px] text-center leading-relaxed">Type an outgoing message below to connect with this lead on WhatsApp.</p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const isAgent = msg.sender_type === 'agent';
                  const isOutgoing = isAgent || msg.sender_type === 'ai' || msg.side === 'right';
                  
                  // Check for media
                  const hasMedia = !!msg.media_url;
                  const isImage = hasMedia && (msg.message_type === 'image' || /\.(jpeg|jpg|gif|png|webp)/i.test(msg.media_url));
                  const isDoc = hasMedia && !isImage;

                  // Check for reply metadata
                  const replyContext = msg.metadata?.reply_to;

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex",
                        isOutgoing ? "justify-end" : "justify-start"
                      )}
                    >
                      {/* Main Message Bubble content */}
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-4 py-3 relative group flex flex-col gap-1.5 transition-all duration-200 shadow-sm border",
                          isOutgoing
                            ? "bg-gradient-to-br from-[#22C55E] to-[#16A34A] border-none text-white rounded-tr-none shadow-md shadow-emerald-500/5 dark:shadow-none"
                            : "bg-white/95 dark:bg-[#1E293B]/95 border-slate-200/80 dark:border-slate-800 shadow-sm rounded-tl-none text-[#1E293B] dark:text-[#F8FAFC] backdrop-blur-sm"
                        )}
                      >
                        {/* Hover Actions Toolbar */}
                        <div
                          className={cn(
                            "absolute -top-3 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center gap-1 px-1 py-0.5 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-xl shadow-md z-20",
                            isOutgoing ? "right-4" : "left-4"
                          )}
                        >
                          {/* Reply trigger button */}
                          <button
                            type="button"
                            onClick={() => setReplyTo({
                              id: msg.id,
                              content: msg.content,
                              sender_type: msg.sender_type,
                              side: isOutgoing ? 'right' : 'left'
                            })}
                            className="text-slate-400 hover:text-[#22C55E] dark:hover:text-[#22C55E] transition-all p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                            title="Reply to message"
                          >
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete trigger button */}
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-slate-400 hover:text-red-500 transition-all p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                            title="Delete message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Render quoted reply box inside bubble if replying to another message */}
                        {replyContext && (
                          <div className={cn(
                            "rounded-lg px-2.5 py-1.5 text-[11px] max-w-full flex flex-col gap-0.5 mb-1 select-none border-l-[3px]",
                            isOutgoing 
                              ? "bg-white/10 border-white/60 text-white/90" 
                              : "bg-slate-50 dark:bg-slate-900/50 border-[#22C55E] text-slate-600 dark:text-gray-300"
                          )}>
                            <span className={cn("font-bold text-[9px] uppercase tracking-wide", isOutgoing ? "text-white" : "text-[#22C55E]")}>
                              {replyContext.sender_type === 'agent' || replyContext.sender_type === 'ai' ? 'AI Copilot' : 'Customer'}
                            </span>
                            <span className="line-clamp-2 leading-snug font-semibold">
                              {replyContext.content}
                            </span>
                          </div>
                        )}

                        {/* Message body rendering */}
                        {isImage && (
                          <div className="rounded-xl overflow-hidden max-w-xs border border-black/5 shadow-sm bg-black/5 dark:bg-black/20">
                            <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="block relative hover:opacity-90 transition-opacity">
                              <img src={msg.media_url} alt="Attached image" className="object-cover max-h-52 w-full select-none" />
                            </a>
                            {msg.content && msg.content !== '[image]' && (
                              <p className={cn("p-2.5 text-[13px] font-bold leading-relaxed border-t", isOutgoing ? "border-white/10 text-white" : "border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100")}>
                                {msg.content}
                              </p>
                            )}
                          </div>
                        )}

                        {isDoc && (
                          <div className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl max-w-xs transition-all border",
                            isOutgoing 
                              ? "bg-white/10 hover:bg-white/15 border-white/10" 
                              : "bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-900 border-slate-200 dark:border-slate-800"
                          )}>
                            <FileText className={cn("w-8 h-8 shrink-0", isOutgoing ? "text-white" : "text-[#22C55E]")} />
                            <div className="flex flex-col min-w-0 flex-1 text-left">
                              <span className={cn("text-[12px] font-bold truncate", isOutgoing ? "text-white" : "text-slate-700 dark:text-slate-200")}>
                                {msg.content || 'Document Attachment'}
                              </span>
                              <span className={cn("text-[10px]", isOutgoing ? "text-white/60" : "text-slate-400")}>
                                Document
                              </span>
                            </div>
                            <a
                              href={msg.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "w-8 h-8 flex items-center justify-center rounded-lg shadow-sm transition-all border",
                                isOutgoing 
                                  ? "bg-white/20 hover:bg-white/30 border-white/10 text-white" 
                                  : "bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300"
                              )}
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        )}

                        {!isImage && !isDoc && (
                          <p className="text-[13px] font-bold leading-relaxed whitespace-pre-wrap text-left">
                            {msg.content}
                          </p>
                        )}

                        <div className={cn("flex items-center justify-end gap-1.5 mt-1 opacity-80", isOutgoing ? "text-white/80" : "text-slate-450 dark:text-slate-500")}>
                          <span className="text-[9px] font-black uppercase tracking-wider">
                            {formatTime(msg.timestamp)}
                          </span>
                          {msg.isPending && (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          )}
                          {msg.isError && (
                            <span className="text-red-400 font-bold text-[9px] animate-bounce">Failed</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
                {/* Anchor point for smooth scroll to end */}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Bottom managed input bar */}
          <div className="mx-6 my-4 bg-white/95 dark:bg-[#111827]/95 border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-100/50 dark:shadow-none rounded-2xl p-4 shrink-0 relative backdrop-blur-md transition-all duration-300">
            {/* Reply Quote Preview */}
            {replyTo && (
              <div className="mb-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start gap-2 border-l-3 border-[#22C55E] pl-3 py-0.5">
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] font-black text-[#22C55E] uppercase tracking-wider">
                      Replying to {replyTo.side === 'right' ? 'AI / Agent' : 'Customer'}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 line-clamp-1 max-w-md">
                      {replyTo.content}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Selected file preview */}
            {selectedFile && (
              <div className="mb-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                {filePreview ? (
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                    <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-[#22C55E] flex items-center justify-center shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-black truncate text-slate-800 dark:text-slate-100">{selectedFile.name}</p>
                  <p className="text-[10px] font-bold text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <Button
                  type="button"
                  onClick={clearSelectedFile}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              {isRecording ? (
                <div className="flex-1 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 px-4 py-3 flex items-center justify-between gap-3 transition-all duration-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                      Recording Voice Note… {formatDuration(recordingDuration)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={cancelRecording}
                      variant="ghost"
                      type="button"
                      size="sm"
                      className="h-8 px-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-100/50 dark:hover:bg-red-950/40 flex items-center gap-1.5 text-xs font-semibold transition-all"
                    >
                      <Trash2 className="w-4 h-4" /> Discard
                    </Button>
                    <Button
                      onClick={stopRecording}
                      type="button"
                      size="sm"
                      className="h-8 px-4 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all shadow-md active:scale-95 animate-pulse"
                    >
                      <Send className="w-3.5 h-3.5" /> Send
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3 focus-within:ring-2 focus-within:ring-[#22C55E]/20 transition-all duration-200">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  />
                  
                  {/* Attachment trigger */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isUploading}
                    className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition-colors p-1"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  {/* Text input */}
                  <input
                    type="text"
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    disabled={isSending || isUploading}
                    placeholder={
                      isUploading 
                        ? "Uploading media asset..." 
                        : `Message ${active.leadName || 'lead'} via WhatsApp...`
                    }
                    className="flex-1 bg-transparent border-none focus:outline-none text-sm font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400"
                  />

                  {/* Emoji Picker trigger */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        if (showEmojiPicker) setEmojiSearch("");
                      }}
                      disabled={isSending || isUploading}
                      className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition-colors p-1"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    
                    {showEmojiPicker && (
                      <div className="absolute bottom-14 right-0 z-50 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl shadow-2xl w-72 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                        
                        {/* Search Bar */}
                        <div className="p-2 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                          <input
                            type="text"
                            placeholder="Search emojis..."
                            value={emojiSearch}
                            onChange={(e) => setEmojiSearch(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#22C55E]"
                          />
                        </div>

                        {/* Category Selector Tabs */}
                        {!emojiSearch && (
                          <div className="flex border-b border-[#E5E7EB] dark:border-[#1F2937] bg-gray-50/50 dark:bg-gray-900/30">
                            {EMOJI_CATEGORIES.map((cat) => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                  "flex-1 py-2 text-center text-sm transition-all hover:bg-gray-100 dark:hover:bg-gray-800/50",
                                  activeCategory === cat.id 
                                    ? "border-b-2 border-[#22C55E] text-[#22C55E]" 
                                    : "text-gray-400"
                                )}
                                title={cat.name}
                              >
                                {cat.icon}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Emojis Grid List */}
                        <div className="p-2.5 max-h-48 overflow-y-auto grid grid-cols-6 gap-1 bg-white dark:bg-[#111827]">
                          {(() => {
                            if (emojiSearch) {
                              const searchLower = emojiSearch.toLowerCase();
                              const allMatched: string[] = [];
                              EMOJI_CATEGORIES.forEach(cat => {
                                cat.emojis.forEach(emoji => {
                                  const name = EMOJI_NAMES[emoji] || "";
                                  if (name.includes(searchLower) || emoji.includes(emojiSearch)) {
                                    allMatched.push(emoji);
                                  }
                                });
                              });
                              
                              if (allMatched.length === 0) {
                                return (
                                  <div className="col-span-6 py-6 text-center text-xs text-gray-400">
                                    No matching emojis
                                  </div>
                                );
                              }
                              
                              return allMatched.map(emoji => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleEmojiClick(emoji)}
                                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all hover:scale-110 active:scale-90"
                                >
                                  {emoji}
                                </button>
                              ));
                            }
                            
                            const currentCat = EMOJI_CATEGORIES.find(c => c.id === activeCategory);
                            return currentCat?.emojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleEmojiClick(emoji)}
                                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all hover:scale-110 active:scale-90"
                              >
                                {emoji}
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Microphone trigger */}
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={isSending || isUploading}
                    className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-250 transition-colors p-1"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                </div>
              )}

              {!isRecording && (
                <Button
                  type="submit"
                  disabled={(!typedMessage.trim() && !selectedFile) || isSending || isUploading}
                  size="sm"
                  className="h-11 w-11 p-0 bg-gradient-to-r from-[#22C55E] to-[#10B981] hover:from-[#16A34A] hover:to-[#059669] text-white rounded-xl shrink-0 active:scale-95 transition-all shadow-md shadow-emerald-500/15 disabled:opacity-50"
                >
                  {isSending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              )}
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#090D16] opacity-75">
          <MessagesSquare className="w-12 h-12 text-slate-400 mb-4 animate-bounce duration-1000" />
          <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">Select a conversation</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">Choose a lead from the left panel to open their chat history.</p>
        </div>
      )}

      {/* Lead details context sidebar */}
      {active && (
        <div className="hidden xl:flex w-72 border-l border-slate-200 dark:border-slate-800 flex-col bg-white dark:bg-[#111827] shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Contextual Dashboard</h4>
          </div>
          
          <div className="p-5 flex-1 overflow-y-auto space-y-5 scrollbar-thin">
            {/* Pulsing AI Mode Card */}
            <div className={cn(
              "p-4 rounded-2xl border text-left flex flex-col gap-2 relative overflow-hidden shadow-sm",
              active.aiActive 
                ? "bg-gradient-to-br from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/5 dark:to-transparent border-emerald-500/20" 
                : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800"
            )}>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    active.aiActive ? "bg-emerald-400" : "bg-amber-400"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2.5 w-2.5",
                    active.aiActive ? "bg-emerald-500" : "bg-amber-500"
                  )}></span>
                </span>
                <span className="text-xs font-black uppercase tracking-wider text-slate-850 dark:text-slate-100">
                  {active.aiActive ? "AI Copilot Online" : "Manual Override Mode"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                {active.aiActive 
                  ? "AI agent handles messaging automatically based on knowledge base definitions." 
                  : "AI autopilot is paused. Agent must manually reply to incoming messages."
                }
              </p>
            </div>

            {/* Context Fields */}
            <div className="space-y-4">
              {[
                { label: "Registered Identity", value: active.leadName || "New Lead", type: "text" },
                { label: "Contact Phone", value: active.phone, type: "text" },
                { label: "Lifecycle Stage", value: active.stage, type: "badge" },
              ].map((item) => (
                <div key={item.label} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-850/80 bg-slate-50/30 dark:bg-slate-900/10 space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    {item.label}
                  </p>
                  {item.type === "badge" ? (
                    <div className="pt-1 text-left">
                      <StageBadge stage={item.value as LeadStage} onChange={handleStageChange} />
                    </div>
                  ) : (
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-relaxed">
                      {item.value}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
