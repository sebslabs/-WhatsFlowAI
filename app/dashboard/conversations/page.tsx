"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, User, RefreshCw, ChevronDown, Search, Send, Loader2,
  Zap, AlertTriangle, CheckCheck, Clock, Smile, Frown, Meh,
  TrendingUp, MessageSquare, ArrowUpRight, Phone, Paperclip, X, Image as ImageIcon,
  Database, Copy, Check, Mic, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { apiFetch } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { setActiveConversationId } from "@/lib/whatsapp-notifications";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  conversationId: string | null;
  leadName: string;
  phone: string;
  stage: string;
  lastMessage: string;
  lastMessageTime: string;
  aiActive: boolean;
  unreadCount: number;
  sentiment?: "positive" | "neutral" | "negative" | "escalated";
  metadata?: any;
}

interface Message {
  id: string;
  content: string;
  sender_type: "user" | "customer" | "ai" | "agent";
  created_at: string;
  is_ai_generated?: boolean;
  ai_model?: string;
  delivery_status?: "sent" | "delivered" | "read" | null;
  sentiment?: string | null;
  suggested_replies?: string[] | null;
  media_url?: string | null;
  message_type?: string;
}

/** Map API message shape (leads conversation route) to inbox UI model */
function mapApiMessage(raw: Record<string, unknown>): Message {
  const senderType = String(raw.sender_type ?? "customer");
  const side = raw.side as string | undefined;
  const incoming =
    side === "left" ||
    ["contact", "lead", "user", "customer"].includes(senderType);
  return {
    id: String(raw.id ?? `msg-${Date.now()}`),
    content: String(raw.content ?? ""),
    sender_type: incoming
      ? "customer"
      : senderType === "ai" || senderType === "bot"
        ? "ai"
        : "agent",
    created_at: String(raw.timestamp ?? raw.created_at ?? new Date().toISOString()),
    message_type: raw.message_type as string | undefined,
    media_url: (raw.media_url as string | null) ?? null,
    delivery_status: raw.delivery_status as Message["delivery_status"],
    sentiment: raw.sentiment as string | null | undefined,
    suggested_replies: raw.suggested_replies as string[] | null | undefined,
  };
}

// ── Sentiment icon helper ─────────────────────────────────────────────────────

function SentimentIcon({ sentiment }: { sentiment?: string | null }) {
  if (!sentiment) return null;
  if (sentiment === "positive") return <Smile className="w-3 h-3 text-green-500" />;
  if (sentiment === "negative") return <Frown className="w-3 h-3 text-red-500" />;
  if (sentiment === "escalated") return <AlertTriangle className="w-3 h-3 text-amber-500" />;
  return <Meh className="w-3 h-3 text-gray-400" />;
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, isTyping }: { msg?: Message; isTyping?: boolean }) {
  if (isTyping) {
    return (
      <div className="flex items-end gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
          <Bot className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="bg-white dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D] rounded-2xl rounded-bl-sm px-4 py-3">
          <div className="flex items-center gap-1">
            {[0, 0.2, 0.4].map(delay => (
              <span
                key={delay}
                className="w-1.5 h-1.5 bg-[#22C55E] rounded-full animate-bounce"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (!msg) return null;
  // Outgoing = agent/AI (right); incoming = customer (left)
  const isOutgoing = msg.sender_type === "agent" || msg.sender_type === "ai";
  const isAI = msg.sender_type === "ai";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex items-end gap-2", isOutgoing ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold",
        isOutgoing
          ? isAI
            ? "bg-gradient-to-br from-violet-500 to-purple-600"
            : "bg-gradient-to-br from-[#22C55E] to-[#16A34A]"
          : "bg-[#22C55E]/15 backdrop-blur-md border border-[#22C55E]/30 text-[#059669] dark:text-[#34D399] shadow-[0_2px_8px_rgba(34,197,94,0.15)]"
      )}>
        {isOutgoing ? (isAI ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />) : <Phone className="w-3.5 h-3.5" />}
      </div>

      <div className={cn("flex flex-col gap-1 max-w-[72%]", isOutgoing && "items-end")}>
        {/* AI badge */}
        {isAI && (
          <span className="text-[9px] font-bold text-violet-500 flex items-center gap-1 px-1">
            <Zap className="w-2.5 h-2.5" /> AI Generated
            {msg.ai_model && <span className="opacity-60">· {msg.ai_model}</span>}
          </span>
        )}

        {/* Bubble */}
        <div className={cn(
          "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
          isOutgoing
            ? isAI
              ? "bg-white dark:bg-[#161B22] border border-violet-200 dark:border-violet-900/30 text-[#111827] dark:text-[#F9FAFB] rounded-br-sm"
              : "bg-gradient-to-br from-[#22C55E] to-[#16A34A] text-white rounded-br-sm"
            : "bg-[#E5E7EB] dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-bl-sm"
        )}>
          {msg.media_url && (
            <div className="mb-2 overflow-hidden rounded-lg max-w-[240px]">
              {msg.message_type === "image" || msg.media_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                <img src={msg.media_url} alt="Media" className="w-full h-auto object-cover" />
              ) : msg.message_type === "video" || msg.media_url.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={msg.media_url} controls className="w-full h-auto" />
              ) : msg.message_type === "audio" || msg.media_url.match(/\.(mp3|wav|ogg)$/i) ? (
                <audio src={msg.media_url} controls className="w-full" />
              ) : (
                <a href={msg.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-black/10 dark:bg-white/10 rounded-md hover:bg-black/20 dark:hover:bg-white/20 transition-colors">
                  <Paperclip className="w-4 h-4 shrink-0" />
                  <span className="truncate text-xs font-bold">View Document</span>
                </a>
              )}
            </div>
          )}
          
          {(!msg.content.match(/^\[(media|image|document|video|audio)\]$/i) || !msg.media_url) && (
             <span>{msg.content}</span>
          )}
        </div>

        {/* Meta row */}
        <div className={cn("flex items-center gap-2 text-[10px] text-[#9CA3AF] px-1", isOutgoing && "flex-row-reverse")}>
          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          {isOutgoing && msg.delivery_status === "read" && <CheckCheck className="w-3 h-3 text-[#22C55E]" />}
          {isOutgoing && msg.delivery_status === "delivered" && <CheckCheck className="w-3 h-3" />}
          {msg.sentiment && <SentimentIcon sentiment={msg.sentiment} />}
        </div>

        {/* Suggested replies */}
        {isAI && msg.suggested_replies?.length && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {msg.suggested_replies.map((r, i) => (
              <button
                key={i}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100 transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ConversationsContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlLeadId = searchParams.get("leadId");
  const supabase = useMemo(() => createClient(), []);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<Conversation | null>(null);
  const [messages, setMessages]           = useState<Message[]>([]);
  const [replyText, setReplyText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [loadingList, setLoadingList]     = useState(true);
  const [typingAI, setTypingAI]           = useState(false);
  const [search, setSearch]               = useState("");
  const [showEmoji, setShowEmoji]         = useState(false);
  const [attachment, setAttachment]       = useState<File | null>(null);
  const [showKB, setShowKB]               = useState(false);
  const [kbSources, setKbSources]         = useState<any[]>([]);
  const [loadingKb, setLoadingKb]         = useState(false);
  const [kbSearch, setKbSearch]           = useState("");
  const [copiedId, setCopiedId]           = useState<string | null>(null);
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  
  // AI Agent Dropdown states & logic
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [isSelectingAgent, setIsSelectingAgent] = useState(false);

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const data = await apiFetch("/api/ai-agents");
      if (Array.isArray(data)) {
        setAgents(data);
      }
    } catch (err) {
      console.error("Failed to load AI agents:", err);
    } finally {
      setLoadingAgents(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const selectAgent = async (agentId: string | null) => {
    if (!selected || isSelectingAgent) return;
    setIsSelectingAgent(true);
    try {
      const res = await apiFetch("/api/conversations/select-agent", {
        method: "POST",
        body: JSON.stringify({ leadId: selected.id, agentId }),
      });
      if (res?.success) {
        setSelected((s) => s ? { ...s, metadata: { ...s.metadata, selected_agent_id: agentId } } : s);
        setConversations((prev) =>
          prev.map((c) => c.id === selected.id ? { ...c, metadata: { ...c.metadata, selected_agent_id: agentId } } : c)
        );
        const agentName = agentId ? (agents.find(a => a.id === agentId)?.name || "Selected Agent") : "Default Auto Agent";
        toast(`Conversation AI routing updated to: ${agentName}`, "success");
      }
    } catch (err: any) {
      toast(err.message || "Failed to update AI agent selection", "error");
    } finally {
      setIsSelectingAgent(false);
    }
  };

  const bottomRef = useRef<HTMLDivElement>(null);

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
  
  // Track selected conversation to prevent background polling from leaking into another chat feed
  const selectedRef = useRef<Conversation | null>(null);
  selectedRef.current = selected;

  // Track initial URL selection to prevent polling/reloads from hijacking user thread changes
  const hasSelectedFromUrlRef = useRef(false);

  const loadKbSources = useCallback(async () => {
    setLoadingKb(true);
    try {
      const data = await apiFetch("/api/knowledge");
      setKbSources(data ?? []);
    } catch (err) {
      console.error("Failed to load KB sources:", err);
    } finally {
      setLoadingKb(false);
    }
  }, []);

  useEffect(() => {
    if (showKB) {
      loadKbSources();
    }
  }, [showKB, loadKbSources]);
  const inputRef  = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const EMOJI_CATEGORIES = useMemo(() => [
    {
      name: "Smileys",
      icon: "😀",
      emojis: [
        { char: "😀", name: "grinning face", tags: ["happy", "smile", "joy"] },
        { char: "😃", name: "grinning face with big eyes", tags: ["happy", "smile", "joy"] },
        { char: "😄", name: "grinning face with smiling eyes", tags: ["happy", "smile", "joy"] },
        { char: "😁", name: "beaming face with smiling eyes", tags: ["happy", "smile", "grin"] },
        { char: "😆", name: "grinning squinting face", tags: ["happy", "laugh", "lol"] },
        { char: "😅", name: "grinning face with sweat", tags: ["happy", "sweat", "relieved"] },
        { char: "🤣", name: "rolling on the floor laughing", tags: ["laugh", "lol", "rofl"] },
        { char: "😂", name: "face with tears of joy", tags: ["laugh", "lol", "tear"] },
        { char: "🙂", name: "slightly smiling face", tags: ["happy", "smile"] },
        { char: "🙃", name: "upside-down face", tags: ["silly", "sarcasm"] },
        { char: "😉", name: "winking face", tags: ["wink", "playful"] },
        { char: "😊", name: "smiling face with smiling eyes", tags: ["happy", "smile", "blush"] },
        { char: "😇", name: "smiling face with halo", tags: ["angel", "good", "innocent"] },
        { char: "🥰", name: "smiling face with hearts", tags: ["love", "hearts"] },
        { char: "😍", name: "smiling face with heart-eyes", tags: ["love", "adore"] },
        { char: "🤩", name: "star-struck", tags: ["wow", "amazing", "star"] },
        { char: "😘", name: "face blowing a kiss", tags: ["love", "kiss"] },
        { char: "😗", name: "kissing face", tags: ["kiss"] },
        { char: "😚", name: "kissing face with closed eyes", tags: ["kiss", "love"] },
        { char: "😋", name: "face savoring food", tags: ["yum", "hungry", "tongue"] },
        { char: "😛", name: "face with tongue", tags: ["tongue", "silly"] },
        { char: "😜", name: "winking face with tongue", tags: ["tongue", "silly", "wink"] },
        { char: "🤪", name: "zany face", tags: ["silly", "crazy"] },
        { char: "😝", name: "squinting face with tongue", tags: ["tongue", "silly"] },
        { char: "🤑", name: "money-mouth face", tags: ["money", "rich"] },
        { char: "🤗", name: "hugging face", tags: ["hug", "welcome"] },
        { char: "🫣", name: "face with peeking eye", tags: ["hide", "scared"] },
        { char: "🤭", name: "face with hand over mouth", tags: ["giggle", "secret"] },
        { char: "🤫", name: "shushing face", tags: ["quiet", "silence", "shh"] },
        { char: "🤔", name: "thinking face", tags: ["think", "wonder"] },
        { char: "🤐", name: "zipper-mouth face", tags: ["silent", "secret"] },
        { char: "🤨", name: "face with raised eyebrow", tags: ["skeptical", "doubt"] },
        { char: "😐", name: "neutral face", tags: ["neutral", "meh"] },
        { char: "😑", name: "expressionless face", tags: ["flat", "meh"] },
        { char: "😶", name: "face without mouth", tags: ["silent", "speechless"] },
        { char: "😏", name: "smirking face", tags: ["smirk", "sarcasm"] },
        { char: "😒", name: "unamused face", tags: ["meh", "bored"] },
        { char: "🙄", name: "face with rolling eyes", tags: ["roll", "annoyed"] },
        { char: "😬", name: "grimacing face", tags: ["grimace", "awkward"] },
        { char: "🤥", name: "lying face", tags: ["lie", "false"] },
        { char: "😌", name: "relieved face", tags: ["relieved", "calm"] },
        { char: "😔", name: "pensive face", tags: ["sad", "sorry"] },
        { char: "😪", name: "sleepy face", tags: ["tired", "sleepy"] },
        { char: "🤤", name: "drooling face", tags: ["drool", "hungry"] },
        { char: "😴", name: "sleeping face", tags: ["sleep", "zzz"] },
        { char: "😷", name: "face with medical mask", tags: ["sick", "mask"] },
        { char: "🤒", name: "face with thermometer", tags: ["sick", "fever"] },
        { char: "🤕", name: "face with head-bandage", tags: ["sick", "hurt"] },
        { char: "🤢", name: "nauseated face", tags: ["sick", "gross"] },
        { char: "🤮", name: "face vomiting", tags: ["sick", "puke"] },
        { char: "🤧", name: "sneezing face", tags: ["sick", "sneeze"] },
        { char: "🥵", name: "hot face", tags: ["hot", "sweat"] },
        { char: "🥶", name: "cold face", tags: ["cold", "freeze"] },
        { char: "🥴", name: "woozy face", tags: ["dizzy", "drunk"] },
        { char: "😵", name: "face with crossed-out eyes", tags: ["dizzy", "dead"] },
        { char: "🤯", name: "exploding head", tags: ["mindblown", "wow"] },
        { char: "🤠", name: "cowboy hat face", tags: ["cowboy", "yeehaw"] },
        { char: "🥳", name: "partying face", tags: ["party", "celebrate"] },
        { char: "😎", name: "smiling face with sunglasses", tags: ["cool", "glasses"] },
        { char: "🤓", name: "nerd face", tags: ["nerd", "smart"] },
        { char: "🧐", name: "face with monocle", tags: ["smart", "inspect"] },
        { char: "😕", name: "confused face", tags: ["confused"] },
        { char: "😟", name: "worried face", tags: ["worry", "nervous"] },
        { char: "🙁", name: "slightly frowning face", tags: ["sad", "frown"] },
        { char: "😮", name: "face with open mouth", tags: ["surprise", "shock"] },
        { char: "😲", name: "astonished face", tags: ["surprise", "wow"] },
        { char: "😳", name: "flushed face", tags: ["blush", "embarrassed"] },
        { char: "🥺", name: "pleading face", tags: ["please", "beg", "cute"] },
        { char: "🥹", name: "face holding back tears", tags: ["cute", "tears"] },
        { char: "😱", name: "face screaming in fear", tags: ["scared", "fear", "scream"] },
        { char: "😭", name: "loudly crying face", tags: ["sad", "cry", "sob", "tears"] },
        { char: "😤", name: "face with steam from nose", tags: ["frustrated", "steam"] },
        { char: "😡", name: "enraged face", tags: ["angry", "mad", "rage"] },
        { char: "😠", name: "angry face", tags: ["angry", "mad"] },
        { char: "🤬", name: "face with symbols on mouth", tags: ["swearing", "cuss"] },
        { char: "😈", name: "smiling face with horns", tags: ["devil", "mischief"] },
        { char: "👿", name: "angry face with horns", tags: ["devil", "angry"] },
        { char: "💀", name: "skull", tags: ["dead", "skeleton", "death"] },
        { char: "💩", name: "pile of poo", tags: ["poop", "funny"] },
        { char: "🤡", name: "clown face", tags: ["clown", "funny"] },
        { char: "🤖", name: "robot", tags: ["robot", "bot"] }
      ]
    },
    {
      name: "Hands",
      icon: "👍",
      emojis: [
        { char: "👋", name: "waving hand", tags: ["hello", "hi", "bye"] },
        { char: "✋", name: "raised hand", tags: ["stop", "five"] },
        { char: "🖖", name: "vulcan salute", tags: ["spock", "alien"] },
        { char: "👌", name: "OK hand", tags: ["ok", "perfect"] },
        { char: "🤌", name: "pinched fingers", tags: ["what", "italian"] },
        { char: "🤏", name: "pinching hand", tags: ["small", "little"] },
        { char: "✌️", name: "victory hand", tags: ["victory", "peace", "two"] },
        { char: "🤞", name: "crossed fingers", tags: ["luck", "hope"] },
        { char: "🤟", name: "love-you gesture", tags: ["love", "gesture"] },
        { char: "🤘", name: "sign of the horns", tags: ["rockon", "metal"] },
        { char: "🤙", name: "call me hand", tags: ["phone", "call"] },
        { char: "👈", name: "pointing left", tags: ["point", "left"] },
        { char: "👉", name: "pointing right", tags: ["point", "right"] },
        { char: "👆", name: "pointing up", tags: ["point", "up"] },
        { char: "👇", name: "pointing down", tags: ["point", "down"] },
        { char: "👍", name: "thumbs up", tags: ["like", "yes", "agree"] },
        { char: "👎", name: "thumbs down", tags: ["dislike", "no"] },
        { char: "✊", name: "raised fist", tags: ["fist", "power"] },
        { char: "👊", name: "oncoming fist", tags: ["punch", "bump"] },
        { char: "👏", name: "clapping hands", tags: ["clap", "applause"] },
        { char: "🙌", name: "raising hands", tags: ["celebrate", "praise"] },
        { char: "👐", name: "open hands", tags: ["open", "welcome"] },
        { char: "🤝", name: "handshake", tags: ["deal", "agreement", "shake"] },
        { char: "🙏", name: "folded hands", tags: ["please", "thankyou", "pray"] },
        { char: "💪", name: "flexed biceps", tags: ["strong", "power", "muscle"] }
      ]
    },
    {
      name: "Hearts",
      icon: "❤️",
      emojis: [
        { char: "❤️", name: "red heart", tags: ["love", "heart"] },
        { char: "🧡", name: "orange heart", tags: ["love", "heart"] },
        { char: "💛", name: "yellow heart", tags: ["love", "friendship"] },
        { char: "💚", name: "green heart", tags: ["love", "nature"] },
        { char: "💙", name: "blue heart", tags: ["love", "trust"] },
        { char: "💜", name: "purple heart", tags: ["love", "heart"] },
        { char: "🖤", name: "black heart", tags: ["love", "dark"] },
        { char: "🤍", name: "white heart", tags: ["love", "peace"] },
        { char: "💔", name: "broken heart", tags: ["sad", "breakup"] },
        { char: "❤️‍🔥", name: "heart on fire", tags: ["passion", "burn"] },
        { char: "❣️", name: "heart exclamation", tags: ["love"] },
        { char: "💕", name: "two hearts", tags: ["love"] },
        { char: "💞", name: "revolving hearts", tags: ["love"] },
        { char: "💓", name: "beating heart", tags: ["love", "beat"] },
        { char: "💗", name: "growing heart", tags: ["love", "grow"] },
        { char: "💖", name: "sparkling heart", tags: ["love", "sparkle"] },
        { char: "💘", name: "heart with arrow", tags: ["love", "cupid"] },
        { char: "💝", name: "heart with ribbon", tags: ["love", "gift"] },
        { char: "💟", name: "heart decoration", tags: ["love"] }
      ]
    },
    {
      name: "Animals",
      icon: "🐶",
      emojis: [
        { char: "🐶", name: "dog face", tags: ["dog", "puppy", "pet"] },
        { char: "🐱", name: "cat face", tags: ["cat", "kitten", "pet"] },
        { char: "🐭", name: "mouse face", tags: ["mouse", "pet"] },
        { char: "🐹", name: "hamster face", tags: ["hamster", "pet"] },
        { char: "🐰", name: "rabbit face", tags: ["rabbit", "bunny"] },
        { char: "🦊", name: "fox face", tags: ["fox", "nature"] },
        { char: "🐻", name: "bear face", tags: ["bear", "nature"] },
        { char: "🐼", name: "panda face", tags: ["panda"] },
        { char: "🐨", name: "koala", tags: ["koala"] },
        { char: "🐯", name: "tiger face", tags: ["tiger"] },
        { char: "🦁", name: "lion face", tags: ["lion"] },
        { char: "🐮", name: "cow face", tags: ["cow"] },
        { char: "🐷", name: "pig face", tags: ["pig"] },
        { char: "🐸", name: "frog face", tags: ["frog"] },
        { char: "🐵", name: "monkey face", tags: ["monkey"] },
        { char: "🐔", name: "chicken", tags: ["chicken", "bird"] },
        { char: "🐧", name: "penguin", tags: ["penguin", "bird"] },
        { char: "🐦", name: "bird", tags: ["bird"] },
        { char: "🦉", name: "owl", tags: ["owl", "bird"] },
        { char: "🐝", name: "honeybee", tags: ["bee", "bug"] },
        { char: "🦋", name: "butterfly", tags: ["butterfly", "bug"] },
        { char: "🐢", name: "turtle", tags: ["turtle", "nature"] },
        { char: "🐍", name: "snake", tags: ["snake"] },
        { char: "🐬", name: "dolphin", tags: ["dolphin", "sea"] },
        { char: "🐳", name: "spouting whale", tags: ["whale", "sea"] },
        { char: "🌵", name: "cactus", tags: ["cactus", "nature"] },
        { char: "🌲", name: "evergreen tree", tags: ["tree", "nature"] },
        { char: "🌱", name: "seedling", tags: ["plant", "nature"] },
        { char: "☘️", name: "shamrock", tags: ["clover", "luck"] },
        { char: "🍀", name: "four leaf clover", tags: ["clover", "luck"] }
      ]
    },
    {
      name: "Food",
      icon: "🍎",
      emojis: [
        { char: "🍎", name: "red apple", tags: ["apple", "fruit"] },
        { char: "🍊", name: "tangerine", tags: ["orange", "fruit"] },
        { char: "🍌", name: "banana", tags: ["banana", "fruit"] },
        { char: "🍉", name: "watermelon", tags: ["watermelon", "fruit"] },
        { char: "🍇", name: "grapes", tags: ["grapes", "fruit"] },
        { char: "🍓", name: "strawberry", tags: ["strawberry", "fruit"] },
        { char: "🍒", name: "cherries", tags: ["cherry", "fruit"] },
        { char: "🍍", name: "pineapple", tags: ["pineapple", "fruit"] },
        { char: "🥑", name: "avocado", tags: ["avocado", "food"] },
        { char: "🍞", name: "bread", tags: ["bread", "food"] },
        { char: "🍳", name: "cooking", tags: ["egg", "food"] },
        { char: "🍔", name: "hamburger", tags: ["burger", "food"] },
        { char: "🍟", name: "french fries", tags: ["fries", "food"] },
        { char: "🍕", name: "pizza", tags: ["pizza", "food"] },
        { char: "🥗", name: "green salad", tags: ["salad", "food"] },
        { char: "🍝", name: "spaghetti", tags: ["pasta", "food"] },
        { char: "🍰", name: "shortcake", tags: ["cake", "sweet"] },
        { char: "🍩", name: "donut", tags: ["donut", "sweet"] },
        { char: "🍫", name: "chocolate bar", tags: ["chocolate", "sweet"] },
        { char: "☕", name: "hot beverage", tags: ["coffee", "drink"] },
        { char: "🍵", name: "teacup without handle", tags: ["tea", "drink"] },
        { char: "🍺", name: "beer mug", tags: ["beer", "drink"] }
      ]
    },
    {
      name: "Objects",
      icon: "💡",
      emojis: [
        { char: "🔥", name: "fire", tags: ["hot", "cool", "lit"] },
        { char: "✨", name: "sparkles", tags: ["sparkle", "magic"] },
        { char: "⭐", name: "star", tags: ["star", "gold"] },
        { char: "⚡", name: "high voltage", tags: ["lightning", "thunder"] },
        { char: "💥", name: "collision", tags: ["boom", "explosion"] },
        { char: "💯", name: "hundred points", tags: ["perfect", "100"] },
        { char: "💡", name: "light bulb", tags: ["idea", "smart"] },
        { char: "🎉", name: "party popper", tags: ["party", "celebrate"] },
        { char: "🎁", name: "wrapped gift", tags: ["gift", "present"] },
        { char: "✅", name: "check mark", tags: ["yes", "done", "correct"] },
        { char: "❌", name: "cross mark", tags: ["no", "cancel", "wrong"] },
        { char: "⚠️", name: "warning", tags: ["warning", "alert"] },
        { char: "🚀", name: "rocket", tags: ["rocket", "space", "fast"] },
        { char: "💻", name: "laptop", tags: ["computer", "tech"] },
        { char: "📱", name: "mobile phone", tags: ["phone", "tech"] },
        { char: "📅", name: "calendar", tags: ["date", "calendar"] },
        { char: "✉️", name: "envelope", tags: ["mail", "letter"] },
        { char: "📞", name: "telephone receiver", tags: ["call", "phone"] },
        { char: "🔒", name: "locked", tags: ["lock", "secure"] },
        { char: "🔑", name: "key", tags: ["key", "unlock"] }
      ]
    }
  ], []);

  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState("Smileys");
  const [emojiSearch, setEmojiSearch] = useState("");

  const filteredEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      const query = emojiSearch.toLowerCase().trim();
      const all: { char: string; name: string; tags: string[] }[] = [];
      EMOJI_CATEGORIES.forEach((cat) => {
        cat.emojis.forEach((emoji) => {
          if (
            emoji.name.toLowerCase().includes(query) ||
            emoji.tags.some((t) => t.toLowerCase().includes(query))
          ) {
            all.push(emoji);
          }
        });
      });
      return all;
    }

    const cat = EMOJI_CATEGORIES.find((c) => c.name === selectedEmojiCategory);
    return cat ? cat.emojis : [];
  }, [selectedEmojiCategory, emojiSearch, EMOJI_CATEGORIES]);

  // ── Load conversation list ────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const data = await apiFetch("/api/conversations");
      const rawList = (data ?? []) as Conversation[];
      const list = rawList.map((c) => {
        if (selectedRef.current && c.id === selectedRef.current.id) {
          return { ...c, unreadCount: 0 };
        }
        return c;
      });
      setConversations(list);
      setSelected((current) => {
        // Only select from URL on initial load to prevent query params from hijacking user chat switches
        if (urlLeadId && !hasSelectedFromUrlRef.current) {
          const fromUrl = list.find((c) => c.id === urlLeadId);
          if (fromUrl) {
            hasSelectedFromUrlRef.current = true;
            return fromUrl;
          }
        }
        if (current) {
          return list.find((c) => c.id === current.id) ?? current;
        }
        return list.length > 0 ? list[0] : null;
      });
    } catch { /* ignore */ }
    finally { setLoadingList(false); }
  }, [urlLeadId]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Load messages for selected conversation ───────────────────────────────

  const loadMessages = useCallback(async (conv: Conversation, silent = false) => {
    if (!silent) {
      setLoadingMsgs(true);
      setMessages([]); // Instantly empty messages to prevent flashing!
    }
    try {
      const data = await apiFetch(`/api/leads/${conv.id}/conversation?page=1&pageSize=50`);
      if (selectedRef.current?.id !== conv.id) return;

      const list = Array.isArray(data) ? data : (data?.messages ?? []);
      const mappedList = Array.isArray(list) ? list.map((m) => mapApiMessage(m as Record<string, unknown>)) : [];
      setMessages(mappedList);

      if (conv.aiActive && mappedList.length > 0) {
        const lastMsg = mappedList[mappedList.length - 1];
        if (lastMsg.sender_type === "customer") {
          const diffMs = Date.now() - new Date(lastMsg.created_at).getTime();
          setTypingAI(diffMs < 45000); // Show typing if the customer message is less than 45s old
        } else {
          setTypingAI(false);
        }
      } else {
        setTypingAI(false);
      }

      const resolvedConvId = (data as { conversationId?: string })?.conversationId;
      if (resolvedConvId && resolvedConvId !== conv.conversationId) {
        setSelected((s) => (s?.id === conv.id ? { ...s, conversationId: resolvedConvId } : s));
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, conversationId: resolvedConvId } : c))
        );
      }

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      if (!silent && selectedRef.current?.id === conv.id) setMessages([]);
    } finally {
      if (!silent && selectedRef.current?.id === conv.id) setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      loadMessages(selected);
      inputRef.current?.focus();

      // Clear local unread count instantly
      setConversations((prev) =>
        prev.map((c) => (c.id === selected.id ? { ...c, unreadCount: 0 } : c))
      );

      // Clear unread count in database
      if (selected.conversationId) {
        supabase
          .from("conversations")
          .update({ unread_count: 0 })
          .eq("id", selected.conversationId)
          .then(({ error }) => {
            if (error) console.error("Failed to reset unread count in DB:", error);
          });
      }
    } else {
      setMessages([]);
    }
  }, [selected?.id, selected?.conversationId, loadMessages, supabase]);

  useEffect(() => {
    setActiveConversationId(selected?.conversationId ?? null);
    return () => setActiveConversationId(null);
  }, [selected?.conversationId]);

  // Poll for new customer messages (QR path may not always trigger realtime)
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      loadMessages(selected, true);
      loadConversations();
    }, 5000);
    return () => clearInterval(interval);
  }, [selected, loadMessages, loadConversations]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!selected?.conversationId) return;
    const channel = supabase
      .channel(`conv:${selected.conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${selected.conversationId}`,
      }, payload => {
        const newMsg = mapApiMessage(payload.new as Record<string, unknown>);
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        
        if (selected.aiActive && newMsg.sender_type === "customer") {
          setTypingAI(true);
        } else if (newMsg.sender_type === "ai" || newMsg.sender_type === "agent") {
          setTypingAI(false);
        }
        
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selected?.conversationId, supabase]);

  // Clear "AI typing" if no AI reply appears (avoids infinite dots when backend fails)
  useEffect(() => {
    if (!typingAI) return;
    const t = setTimeout(() => setTypingAI(false), 45000);
    return () => clearTimeout(t);
  }, [typingAI]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if ((!replyText.trim() && !attachment) || !selected || sending) return;
    const text = replyText.trim();
    setReplyText("");
    setShowEmoji(false);
    setSending(true);

    let mediaUrl = null;
    let messageType = "text";
    let mimeType = null;
    let fileName = null;

    if (attachment) {
      // Optimistically show it in UI
      messageType = attachment.type.startsWith("image/") ? "image" : "document";
      mimeType = attachment.type;
      fileName = attachment.name;
      
      // Try uploading to Supabase
      try {
        const fileExt = attachment.name.split('.').pop();
        const randName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { data, error } = await supabase.storage.from('media').upload(`chat/${randName}`, attachment);
        
        if (error) {
          console.error("Upload error:", error);
          toast("Please ensure you have created a public 'media' bucket in your Supabase Storage.", "error");
          setSending(false);
          return;
        }
        
        if (data) {
          const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(`chat/${randName}`);
          mediaUrl = publicUrl;
        }
      } catch (err) {
        console.error("Upload exception:", err);
        toast("An unexpected error occurred during upload. Check Supabase config.", "error");
        setSending(false);
        return;
      }
      setAttachment(null);
    }

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: text || `[${messageType}]`,
      sender_type: "agent",
      created_at: new Date().toISOString(),
      delivery_status: "sent",
      media_url: mediaUrl,
      message_type: messageType,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await apiFetch(`/api/conversations/send`, {
        method: "POST",
        body: JSON.stringify({
          leadId: selected.id,
          content: text,
          mediaUrl,
          messageType,
          mimeType,
          fileName
        }),
      });

      if (res?.conversationId) {
        const convId = res.conversationId as string;
        setSelected((s) => (s ? { ...s, conversationId: convId } : s));
        setConversations((prev) =>
          prev.map((c) => (c.id === selected.id ? { ...c, conversationId: convId } : c))
        );
      }

      await loadMessages(
        { ...selected, conversationId: (res?.conversationId as string) ?? selected.conversationId },
        true
      );

      if (res?.message) {
        const serverMsg = mapApiMessage(res.message as Record<string, unknown>);
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId);
          if (without.some((m) => m.id === serverMsg.id)) return without;
          return [...without, serverMsg];
        });
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === selected.id
            ? { ...c, lastMessage: text, lastMessageTime: new Date().toISOString() }
            : c
        )
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send";
      toast(message, "error");
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setReplyText(text);
    } finally {
      setSending(false);
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
    
    toast("Voice message was deleted.", "info");
  };

  const sendVoiceMessage = async (file: File) => {
    if (!selected || sending) return;
    setSending(true);

    let mediaUrl = null;
    const messageType = "audio";
    const mimeType = file.type || "audio/ogg; codecs=opus";
    const fileName = file.name;

    try {
      const fileExt = "ogg";
      const randName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { data, error } = await supabase.storage.from("media").upload(`chat/${randName}`, file);
      
      if (error) {
        console.error("Upload error:", error);
        toast("Please ensure you have created a public 'media' bucket in your Supabase Storage.", "error");
        setSending(false);
        return;
      }
      
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(`chat/${randName}`);
        mediaUrl = publicUrl;
      }
    } catch (err) {
      console.error("Upload exception:", err);
      toast("An unexpected error occurred during upload. Check Supabase config.", "error");
      setSending(false);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempMsg: Message = {
      id: tempId,
      content: `[audio]`,
      sender_type: "agent",
      created_at: new Date().toISOString(),
      delivery_status: "sent",
      media_url: mediaUrl,
      message_type: messageType,
    };
    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await apiFetch(`/api/conversations/send`, {
        method: "POST",
        body: JSON.stringify({
          leadId: selected.id,
          content: "",
          mediaUrl,
          messageType,
          mimeType,
          fileName
        }),
      });

      if (res?.conversationId) {
        const convId = res.conversationId as string;
        setSelected((s) => (s ? { ...s, conversationId: convId } : s));
        setConversations((prev) =>
          prev.map((c) => (c.id === selected.id ? { ...c, conversationId: convId } : c))
        );
      }

      await loadMessages(
        { ...selected, conversationId: (res?.conversationId as string) ?? selected.conversationId },
        true
      );

      if (res?.message) {
        const serverMsg = mapApiMessage(res.message as Record<string, unknown>);
        setMessages((prev) => {
          const without = prev.filter((m) => m.id !== tempId);
          if (without.some((m) => m.id === serverMsg.id)) return without;
          return [...without, serverMsg];
        });
      }
    } catch (err) {
      console.error("Send voice note error:", err);
    } finally {
      setSending(false);
    }
  };

  // ── Toggle AI ─────────────────────────────────────────────────────────────

  const toggleAI = async () => {
    if (!selected) return;
    const newMode = selected.aiActive ? "manual" : "ai";
    try {
      const res = await apiFetch(`/api/conversations/toggle-ai`, {
        method: "POST",
        body: JSON.stringify({ leadId: selected.id, mode: newMode }),
      });
      if (res?.success) {
        setSelected(s => s ? { ...s, aiActive: newMode === "ai" } : s);
        setConversations(prev =>
          prev.map(c => c.id === selected.id ? { ...c, aiActive: newMode === "ai" } : c)
        );
        toast(`AI ${newMode === "ai" ? "enabled" : "paused"} for this conversation`, "success");
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to toggle AI", "error");
    }
  };

  const filtered = conversations.filter(c =>
    c.leadName.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  // ── Sentiment chip ────────────────────────────────────────────────────────

  const SentimentChip = ({ s }: { s?: string }) => {
    if (!s || s === "neutral") return null;
    const map: Record<string, { color: string; label: string }> = {
      positive:  { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",  label: "😊 Positive" },
      negative:  { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",          label: "😞 Negative" },
      escalated: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  label: "⚠️ Escalated" },
    };
    const cfg = map[s];
    if (!cfg) return null;
    return (
      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", cfg.color)}>
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col">
      <div className="mb-4 shrink-0">
        <PageHeading
          title="Conversations"
          description="Real-time inbox powered by AI — respond instantly or let your agents handle it."
        />
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

        {/* ── Left sidebar ── */}
        <div className="w-full max-w-xs shrink-0 flex flex-col bg-white dark:bg-[#0D1117] rounded-2xl border border-[#E5E7EB] dark:border-[#21262D] overflow-hidden shadow-sm">
          {/* Search */}
          <div className="p-3 border-b border-[#E5E7EB] dark:border-[#21262D]">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="pl-9 h-9 text-xs bg-[#F9FAFB] dark:bg-[#161B22] border-transparent"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-[#22C55E]" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageSquare className="w-8 h-8 text-[#6B7280] mb-3" />
                <p className="text-sm font-bold text-[#6B7280]">No conversations yet</p>
                <p className="text-xs text-[#9CA3AF] mt-1">Messages will appear here when customers reach out.</p>
              </div>
            ) : (
              filtered.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => {
                    hasSelectedFromUrlRef.current = true;
                    setSelected(conv);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3.5 flex items-start gap-3 transition-colors border-b border-[#F3F4F6] dark:border-[#21262D] last:border-0",
                    selected?.id === conv.id
                      ? "bg-[#22C55E]/5 dark:bg-[#22C55E]/10"
                      : "hover:bg-[#F9FAFB] dark:hover:bg-[#161B22]"
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-[#22C55E]/15 backdrop-blur-md border border-[#22C55E]/30 flex items-center justify-center text-[#059669] dark:text-[#34D399] text-sm font-bold shadow-[0_2px_8px_rgba(34,197,94,0.15)]">
                      {conv.leadName[0]?.toUpperCase() ?? "?"}
                    </div>
                    {conv.aiActive && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-500 border-2 border-white dark:border-[#0D1117] flex items-center justify-center">
                        <Bot className="w-2 h-2 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                        {conv.leadName}
                      </span>
                      <span className="text-[9px] text-[#9CA3AF] shrink-0">
                        {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{conv.lastMessage}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <SentimentChip s={conv.sentiment} />
                      {conv.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-[#22C55E] text-white text-[9px] font-bold flex items-center justify-center">
                          {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 flex flex-col bg-white dark:bg-[#0D1117] rounded-2xl border border-[#E5E7EB] dark:border-[#21262D] overflow-hidden shadow-sm min-w-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-[#22C55E]" />
              </div>
              <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Select a conversation</h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Choose a contact from the left to start messaging.</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB] dark:border-[#21262D] bg-white dark:bg-[#0D1117] shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#22C55E]/15 backdrop-blur-md border border-[#22C55E]/30 flex items-center justify-center text-[#059669] dark:text-[#34D399] text-sm font-bold shadow-[0_2px_8px_rgba(34,197,94,0.15)]">
                    {selected.leadName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{selected.leadName}</p>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                      {selected.phone} · {selected.stage}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleAI}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all",
                      selected.aiActive
                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200"
                        : "bg-[#F3F4F6] dark:bg-[#161B22] text-[#6B7280] hover:bg-[#E5E7EB]"
                    )}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {selected.aiActive ? "AI On" : "AI Off"}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#22C55E]/10 hover:bg-[#22C55E]/20 text-[#22C55E] transition-all ml-1"
                        disabled={isSelectingAgent}
                      >
                        <Bot className="w-3.5 h-3.5" />
                        <span>
                          {selected.metadata?.selected_agent_id
                            ? (agents.find(a => a.id === selected.metadata?.selected_agent_id)?.name || "Loading Agent...")
                            : "Default Auto Agent"}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-1 bg-white dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D]">
                      <DropdownMenuItem
                        onClick={() => selectAgent(null)}
                        className={cn(
                          "flex items-center justify-between text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors focus:bg-[#F3F4F6] dark:focus:bg-[#1F2937] outline-none text-[#111827] dark:text-[#F9FAFB]",
                          !selected.metadata?.selected_agent_id
                            ? "bg-[#22C55E]/10 !text-[#22C55E] font-bold"
                            : "hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                        )}
                      >
                        <span className={cn(!selected.metadata?.selected_agent_id ? "" : "text-[#111827] dark:text-[#F9FAFB]")}>Default Auto Agent</span>
                        {!selected.metadata?.selected_agent_id && <Check className="w-3.5 h-3.5" />}
                      </DropdownMenuItem>
                      {agents.map((agent) => (
                        <DropdownMenuItem
                          key={agent.id}
                          onClick={() => selectAgent(agent.id)}
                          className={cn(
                            "flex items-center justify-between text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors focus:bg-[#F3F4F6] dark:focus:bg-[#1F2937] outline-none text-[#111827] dark:text-[#F9FAFB]",
                            selected.metadata?.selected_agent_id === agent.id
                              ? "bg-[#22C55E]/10 !text-[#22C55E] font-bold"
                              : "hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className={cn("font-semibold", selected.metadata?.selected_agent_id === agent.id ? "text-[#22C55E]" : "text-[#111827] dark:text-[#F9FAFB]")}>{agent.name}</span>
                            <span className={cn("text-[10px] opacity-60", selected.metadata?.selected_agent_id === agent.id ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]")}>{agent.model}</span>
                          </div>
                          {selected.metadata?.selected_agent_id === agent.id && <Check className="w-3.5 h-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadMessages(selected)}
                    className="h-8 w-8 p-0 rounded-xl"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FAFAFA] dark:bg-[#0B0F17]">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-5 h-5 animate-spin text-[#22C55E]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-sm text-[#9CA3AF]">No messages yet. Send the first one!</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map(msg => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))}
                    {typingAI && <MessageBubble isTyping />}
                  </AnimatePresence>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-[#E5E7EB] dark:border-[#21262D] bg-white dark:bg-[#0D1117] shrink-0 relative">
                
                {/* Emoji Popover */}
                <AnimatePresence>
                  {showEmoji && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute bottom-20 left-4 bg-white dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D] rounded-2xl shadow-2xl w-80 z-50 flex flex-col overflow-hidden"
                    >
                      {/* Search Bar */}
                      <div className="p-3 border-b border-[#E5E7EB] dark:border-[#21262D] bg-white dark:bg-[#161B22]">
                        <input
                          type="text"
                          value={emojiSearch}
                          onChange={(e) => setEmojiSearch(e.target.value)}
                          placeholder="Search emojis..."
                          className="w-full h-8 px-3 text-xs bg-[#F9FAFB] dark:bg-[#0D1117] border border-[#E5E7EB] dark:border-[#21262D] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#22C55E]"
                        />
                      </div>

                      {/* Category Switcher Tabs */}
                      <div className="flex items-center gap-1 p-2 bg-[#F9FAFB] dark:bg-[#0D1117] border-b border-[#E5E7EB] dark:border-[#21262D] overflow-x-auto shrink-0 scrollbar-none">
                        {EMOJI_CATEGORIES.map((cat) => (
                          <button
                            key={cat.name}
                            onClick={() => {
                              setSelectedEmojiCategory(cat.name);
                              setEmojiSearch(""); // Clear search when switching tabs
                            }}
                            className={cn(
                              "flex-1 min-w-[32px] h-8 flex items-center justify-center rounded-lg text-sm transition-all hover:bg-white dark:hover:bg-[#161B22]",
                              selectedEmojiCategory === cat.name
                                ? "bg-white dark:bg-[#161B22] shadow-sm scale-105 border border-[#E5E7EB] dark:border-[#21262D] text-[#22C55E]"
                                : "text-gray-500"
                            )}
                            title={cat.name}
                          >
                            {cat.icon}
                          </button>
                        ))}
                      </div>

                      {/* Emojis Grid */}
                      <div className="p-3 max-h-60 overflow-y-auto grid grid-cols-6 gap-1 bg-white dark:bg-[#161B22] scrollbar-thin">
                        {filteredEmojis.length === 0 ? (
                          <div className="col-span-6 py-8 text-center text-[11px] text-gray-400">
                            No emojis found
                          </div>
                        ) : (
                          filteredEmojis.map((emoji) => (
                            <button
                              key={emoji.char}
                              onClick={() => {
                                setReplyText((prev) => prev + emoji.char);
                                inputRef.current?.focus();
                              }}
                              className="w-10 h-10 flex items-center justify-center hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] active:scale-90 rounded-lg text-2xl transition-all"
                              title={emoji.name}
                            >
                              {emoji.char}
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attachment Preview */}
                {attachment && (
                  <div className="mb-3 flex items-center gap-3 bg-[#F9FAFB] dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D] rounded-xl p-2 w-fit pr-4">
                    <div className="w-10 h-10 rounded-lg bg-[#E5E7EB] dark:bg-[#21262D] flex items-center justify-center shrink-0">
                      {attachment.type.startsWith("image/") ? (
                        <img src={URL.createObjectURL(attachment)} alt="preview" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-[#6B7280]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate max-w-[200px]">{attachment.name}</p>
                      <p className="text-[10px] text-[#6B7280]">{(attachment.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={() => setAttachment(null)} className="p-1 rounded-full hover:bg-[#E5E7EB] dark:hover:bg-[#374151] text-[#6B7280]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file && file.size > 10 * 1024 * 1024) {
                        toast("File size exceeds the 10MB upload limit", "error");
                        if (e.target) e.target.value = "";
                        return;
                      }
                      setAttachment(file || null);
                    }}
                    accept="image/*,video/*,application/pdf"
                  />
                  {isRecording ? (
                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 p-2 rounded-xl flex-1 h-11">
                      <div className="flex items-center gap-2 flex-1 px-2">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shrink-0" />
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          Recording Voice Note… {formatDuration(recordingDuration)}
                        </span>
                      </div>
                      <Button
                        onClick={cancelRecording}
                        variant="ghost"
                        type="button"
                        className="h-8 px-3 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-100/50 dark:hover:bg-red-950/40 flex items-center gap-1.5 text-xs font-semibold transition-all"
                      >
                        <Trash2 className="w-4 h-4" /> Discard
                      </Button>
                      <Button
                        onClick={stopRecording}
                        type="button"
                        className="h-8 px-4 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold transition-all shadow-md active:scale-95 animate-pulse"
                      >
                        <Send className="w-3.5 h-3.5" /> Send
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Button 
                        onClick={() => fileInputRef.current?.click()}
                        variant="ghost" 
                        className="h-11 w-11 p-0 rounded-xl text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
                      >
                        <Paperclip className="w-5 h-5" />
                      </Button>
                      <Button 
                        onClick={() => setShowEmoji(!showEmoji)}
                        variant="ghost" 
                        className={cn("h-11 w-11 p-0 rounded-xl transition-colors", showEmoji ? "text-[#22C55E] bg-[#22C55E]/10" : "text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F9FAFB]")}
                      >
                        <Smile className="w-5 h-5" />
                      </Button>
                      <Input
                        ref={inputRef}
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder="Type a message…"
                        className="flex-1 h-11 bg-[#F9FAFB] dark:bg-[#161B22] border-[#E5E7EB] dark:border-[#21262D] rounded-xl text-sm"
                      />
                      <Button
                        onClick={startRecording}
                        variant="ghost"
                        type="button"
                        className="h-11 w-11 p-0 rounded-xl text-[#6B7280] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
                      >
                        <Mic className="w-5 h-5" />
                      </Button>
                      <Button
                        onClick={sendMessage}
                        disabled={sending || (!replyText.trim() && !attachment)}
                        className="h-11 w-11 p-0 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl shrink-0 transition-all active:scale-95"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </>
                  )}
                </div>
                {selected.aiActive && (
                  <p className="text-[10px] text-violet-500 flex items-center gap-1 mt-2 px-1">
                    <Bot className="w-3 h-3" /> AI is auto-responding to this conversation
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {/* ── Knowledge Base Right Drawer ── */}
      <Sheet open={showKB} onOpenChange={setShowKB}>
        <SheetContent side="right" className="sm:max-w-[460px] w-full p-0 flex flex-col h-full bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#1F2937] shadow-xl">
          <SheetHeader className="p-6 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937] shrink-0">
            <div className="flex items-center gap-2 mt-4">
              <Database className="w-5 h-5 text-[#22C55E]" />
              <SheetTitle className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
                Knowledge Base Lookup
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-1">
              Browse, search, and quickly insert trained knowledge into your active conversation response.
            </SheetDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              <Input
                value={kbSearch}
                onChange={e => setKbSearch(e.target.value)}
                placeholder="Search assets (e.g. SEBS, quotation...)"
                className="pl-9 h-10 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-sm focus:ring-2 focus:ring-[#22C55E]/20 transition-all font-medium"
              />
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            {loadingKb ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#22C55E]" />
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">Loading knowledge assets...</p>
              </div>
            ) : kbSources.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] font-medium">No assets synced yet.</p>
              </div>
            ) : (() => {
              const query = kbSearch.toLowerCase().trim();
              const filtered = kbSources.filter(item => 
                item.title?.toLowerCase().includes(query) || 
                item.content?.toLowerCase().includes(query) || 
                item.type?.toLowerCase().includes(query)
              );

              if (filtered.length === 0) {
                return (
                  <div className="text-center py-20">
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] font-medium">No matching assets found.</p>
                  </div>
                );
              }

              return filtered.map(source => {
                const isExpanded = expandedSourceId === source.id;
                return (
                  <div 
                    key={source.id} 
                    className="border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl bg-white dark:bg-[#0B0F1A]/40 p-4 transition-all hover:border-[#22C55E]/30"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-[#111827] dark:text-[#F9FAFB] truncate">
                          {source.title}
                        </h4>
                        <span className="text-[9px] font-bold text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded-lg uppercase tracking-wider inline-block mt-1">
                          {source.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">
                        {source.size || "Processed"}
                      </span>
                    </div>

                    <div 
                      onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                      className={cn(
                        "text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed cursor-pointer hover:text-[#111827] dark:hover:text-[#F9FAFB] transition-all whitespace-pre-wrap rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] p-3",
                        isExpanded ? "" : "line-clamp-4"
                      )}
                    >
                      {source.content}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#1F2937]">
                      <button
                        onClick={() => setExpandedSourceId(isExpanded ? null : source.id)}
                        className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]"
                      >
                        {isExpanded ? "Collapse ▴" : "Expand ▾"}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(source.content);
                            setCopiedId(source.id);
                            setTimeout(() => setCopiedId(null), 2000);
                            toast("Copied to clipboard!", "success");
                          }}
                          className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] bg-[#F3F4F6] dark:bg-[#161B22] px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all active:scale-95 shrink-0"
                        >
                          {copiedId === source.id ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
                          {copiedId === source.id ? "Copied" : "Copy"}
                        </button>
                        <button
                          onClick={() => {
                            setReplyText(prev => prev ? `${prev}\n${source.content}` : source.content);
                            setShowKB(false);
                            toast("Inserted into message box!", "success");
                          }}
                          className="text-[10px] font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] px-3 py-1 rounded-lg transition-all active:scale-95 shrink-0"
                        >
                          Use in Reply
                        </button>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#0d1117] text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#22c55e]" />
      </div>
    }>
      <ConversationsContent />
    </Suspense>
  );
}
