"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Plus, Trash2, Save, MessageSquare, HelpCircle,
  MousePointer, Tag, Bell, Calendar, Clock,
  Zap, Settings2, Users, Hash,
  MoreHorizontal, ChevronDown, ChevronUp, X, Copy, GripVertical,
  GitBranch, ImageIcon, StopCircle, ArrowLeft, LayoutGrid, Check,
  CreditCard, Sparkles, Webhook, DollarSign, Brain,
  List, Headset, FileSpreadsheet, UserCheck, Menu, Workflow,
  Loader2, Activity,
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { AutomationToggle } from "@/components/dashboard/AutomationToggle";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { useTheme } from "next-themes";

// ─── Types ───────────────────────────────────────────────────────────────────

type TriggerType = "first_message" | "keyword" | "any_message" | "button_reply" | "ai_handoff" | "tag_added" | "lead_stage_changed";
type StepType = "message" | "question" | "buttons" | "tag" | "notify" | "booking" | "delay" | "condition" | "media" | "payment" | "ai_agent" | "webhook" | "list" | "handover" | "sheets" | "end";

interface ButtonOption { id: string; label: string }

interface FlowStep {
  id: string;
  type: StepType;
  message?: string;
  variableName?: string;
  buttons?: ButtonOption[];
  tagName?: string;
  notifyNote?: string;
  bookingUrl?: string;
  delayMinutes?: number;
  // condition
  conditionVariable?: string;
  conditionOperator?: string;
  conditionValue?: string;
  conditionFalseAction?: "end" | "skip_next" | "jump_to";
  conditionFalseTargetId?: string;
  // media
  mediaType?: "image" | "video" | "document";
  mediaUrl?: string;
  mediaCaption?: string;
  // end
  endMessage?: string;
  endLeadStage?: string;
  // payment
  paymentAmount?: string;
  paymentCurrency?: string;
  paymentDescription?: string;
  // ai agent
  aiPrompt?: string;
  // webhook
  webhookUrl?: string;
  webhookPayload?: string;
  // interactive list
  listTitle?: string;
  listItems?: { id: string; title: string; desc?: string }[];
  // handover
  handoverNote?: string;
  // google sheets
  spreadsheetId?: string;
  sheetName?: string;
}

interface Flow {
  id: string;
  name: string;
  active: boolean;
  triggerType: TriggerType;
  triggerKeyword?: string;
  steps: FlowStep[];
}

interface Settings {
  ai_enabled: boolean;
  ai_auto_pipeline: boolean;
  business_name: string;
  industry: string;
  ai_tone: string;
  escalation_threshold: number;
  questions: { id: string; text: string }[];
  reengagement_enabled: boolean;
  reengagement_window: string;
  reengagement_message: string;
  reengagement_cap: number;
  followup_enabled: boolean;
  followup_window: string;
  followup_stages: string[];
  followup_message: string;
  booking_url: string;
  qualification_gate: number;
  confirmation_message: string;
  working_hours_enabled: boolean;
  working_hours: Record<string, { start: string; end: string; active: boolean }>;
  ooo_message: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const STEP_META: Record<StepType, { icon: React.ElementType; label: string; color: string; bg: string; border: string; darkBg: string; darkBorder: string }> = {
  message: { icon: MessageSquare, label: "Send Message", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", darkBg: "#0F1F3D", darkBorder: "#1E3A6E" },
  question: { icon: HelpCircle, label: "Ask Question", color: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE", darkBg: "#1A1033", darkBorder: "#3B1F6E" },
  buttons: { icon: MousePointer, label: "Quick Replies", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", darkBg: "#0C1F14", darkBorder: "#1C4A2E" },
  tag: { icon: Tag, label: "Tag Lead", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", darkBg: "#1F1608", darkBorder: "#4A3410" },
  notify: { icon: Bell, label: "Notify Team", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", darkBg: "#1F0A0A", darkBorder: "#4A1515" },
  booking: { icon: Calendar, label: "Send Booking Link", color: "#0D9488", bg: "#F0FDFA", border: "#99F6E4", darkBg: "#051F1D", darkBorder: "#0F4A44" },
  delay: { icon: Clock, label: "Wait / Delay", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB", darkBg: "#1A1F2E", darkBorder: "#2D3748" },
  condition: { icon: GitBranch, label: "Condition", color: "#9333EA", bg: "#FAF5FF", border: "#E9D5FF", darkBg: "#1A0D33", darkBorder: "#3D1F6E" },
  media: { icon: ImageIcon, label: "Send Media", color: "#0EA5E9", bg: "#F0F9FF", border: "#BAE6FD", darkBg: "#051929", darkBorder: "#0A3A5E" },
  payment: { icon: DollarSign, label: "Request Payment", color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", darkBg: "#0C1F14", darkBorder: "#1C4A2E" },
  ai_agent: { icon: Sparkles, label: "AI Agent Query", color: "#F59E0B", bg: "#FFFBEB", border: "#FEF3C7", darkBg: "#1F1A05", darkBorder: "#4A3F0A" },
  webhook: { icon: Webhook, label: "Trigger Webhook", color: "#6366F1", bg: "#EEF2FF", border: "#E0E7FF", darkBg: "#0F1033", darkBorder: "#252766" },
  list: { icon: List, label: "Interactive List", color: "#EC4899", bg: "#FDF2F8", border: "#FBCFE8", darkBg: "#1F0A16", darkBorder: "#4A1530" },
  handover: { icon: Headset, label: "Human Handover", color: "#F43F5E", bg: "#FFF1F2", border: "#FECDD3", darkBg: "#1F0810", darkBorder: "#4A1222" },
  sheets: { icon: FileSpreadsheet, label: "Google Sheets", color: "#10B981", bg: "#ECFDF5", border: "#A7F3D0", darkBg: "#05201A", darkBorder: "#0A4A3A" },
  end: { icon: StopCircle, label: "End Flow", color: "#475569", bg: "#F8FAFC", border: "#CBD5E1", darkBg: "#141C26", darkBorder: "#2D3748" },
};

const TRIGGER_META: Record<TriggerType, { label: string; icon: React.ElementType; desc: string }> = {
  first_message: { label: "First Message", icon: Users, desc: "Triggers when a brand-new contact messages for the first time" },
  keyword: { label: "Keyword Match", icon: Hash, desc: "Triggers when the message contains a specific word" },
  any_message: { label: "Any Incoming Message", icon: MessageSquare, desc: "Triggers for every incoming WhatsApp message" },
  button_reply: { label: "Button Tap", icon: MousePointer, desc: "Triggers when a lead taps one of your quick reply buttons" },
  ai_handoff: { label: "AI Handover", icon: Headset, desc: "Triggers when AI assistant cannot answer or requests human intervention" },
  tag_added: { label: "Tag Added", icon: Tag, desc: "Triggers when a specific tag is attached to a lead" },
  lead_stage_changed: { label: "Pipeline Stage Changed", icon: Activity, desc: "Triggers when a lead moves to a new pipeline stage" },
};

// ─── Sample Data ─────────────────────────────────────────────────────────────

const INITIAL_FLOWS: Flow[] = [
  {
    id: "f1", name: "Welcome & Qualify", active: true, triggerType: "first_message",
    steps: [
      { id: "s1", type: "message", message: "👋 Hi {name}! Welcome to SmilePlus Dental. I'm your AI assistant here to help you book an appointment or answer any questions." },
      {
        id: "s2", type: "buttons", message: "What brings you in today?", buttons: [
          { id: "b1", label: "📅 Book Appointment" },
          { id: "b2", label: "❓ Ask a Question" },
          { id: "b3", label: "💰 View Pricing" },
        ]
      },
    ],
  },
  {
    id: "f2", name: "Appointment Booking", active: true, triggerType: "keyword", triggerKeyword: "book",
    steps: [
      { id: "s1", type: "question", message: "What service are you looking for?", variableName: "service" },
      { id: "s2", type: "question", message: "When are you looking to come in?", variableName: "preferred_date" },
      { id: "s3", type: "question", message: "Have you visited us before?", variableName: "is_returning" },
      { id: "s4", type: "booking", message: "Perfect! Here's your booking link 📅", bookingUrl: "https://calendly.com/smileplus-dental" },
    ],
  },
  {
    id: "f3", name: "After Hours Reply", active: false, triggerType: "any_message",
    steps: [
      { id: "s1", type: "message", message: "Thanks for reaching out! 🙏 We're currently closed. We'll get back to you first thing in the morning!" },
      { id: "s2", type: "tag", tagName: "after-hours" },
      { id: "s3", type: "notify", notifyNote: "Lead messaged after hours — follow up tomorrow morning." },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() { return Math.random().toString(36).slice(2, 9); }

function stepPreview(step: FlowStep): string {
  const trim = (s?: string, n = 55) => s ? (s.length > n ? s.slice(0, n) + "…" : s) : "";
  switch (step.type) {
    case "message": return trim(step.message);
    case "question": return trim(step.message);
    case "buttons": return `${step.buttons?.length ?? 0} button option${step.buttons?.length !== 1 ? "s" : ""}`;
    case "tag": return step.tagName ? `Tag: "${step.tagName}"` : "Set tag name";
    case "notify": return trim(step.notifyNote) || "Set team note";
    case "booking": return trim(step.bookingUrl) || "Set booking URL";
    case "delay": return step.delayMinutes ? `Wait ${step.delayMinutes} min` : "Set duration";
    case "condition": return step.conditionVariable ? `If {${step.conditionVariable}} ${step.conditionOperator ?? "equals"} "${step.conditionValue ?? ""}"` : "Set condition";
    case "media": return step.mediaUrl ? trim(step.mediaUrl) : `${step.mediaType ?? "image"} — set URL`;
    case "payment": return step.paymentAmount ? `Request ${step.paymentAmount} ${step.paymentCurrency ?? "USD"}` : "Set payment details";
    case "ai_agent": return trim(step.aiPrompt) || "Query AI Knowledge Base";
    case "webhook": return trim(step.webhookUrl) || "Set API Endpoint";
    case "list": return step.listTitle || `${step.listItems?.length ?? 0} menu items`;
    case "handover": return "Transfer to human agent";
    case "sheets": return step.sheetName ? `Add row to "${step.sheetName}"` : "Log to spreadsheet";
    case "end": return step.endMessage ? trim(step.endMessage) : "End conversation";
    default: return "";
  }
}

// ─── Step Type Picker ─────────────────────────────────────────────────────────

function StepTypeBtn({ type, onClick }: { type: StepType; onClick: () => void }) {
  const m = STEP_META[type];
  const Icon = m.icon;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={onClick}
      style={{ background: isDark ? m.darkBg : m.bg, borderColor: isDark ? m.darkBorder : m.border }}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border-2 hover:shadow-md transition-all hover:scale-[1.03] active:scale-95 text-center w-full aspect-square group"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ background: m.color + "22" }}>
        <Icon className="w-5 h-5" style={{ color: m.color }} />
      </div>
      <span className="text-[10px] font-extrabold text-[#0F1F0F] dark:text-[#E5E7EB] leading-tight px-1 uppercase tracking-tight">{m.label}</span>
    </button>
  );
}

function StepPalette({ onAdd, onClose }: { onAdd: (t: StepType) => void; onClose: () => void }) {
  const types: StepType[] = [
    "message", "question", "buttons", "media", "payment",
    "ai_agent", "list", "booking", "delay", "condition",
    "tag", "notify", "webhook", "handover", "sheets", "end"
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="bg-white dark:bg-[#111827] border border-[#E2EDE2] dark:border-[#1F2937] rounded-2xl shadow-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider">Add a step</span>
        <button onClick={onClose} className="p-1 text-[#9CA3AF] hover:text-[#0F1F0F] dark:hover:text-white rounded-lg hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {types.map(t => (
          <StepTypeBtn key={t} type={t} onClick={() => { onAdd(t); onClose(); }} />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Step Connector ───────────────────────────────────────────────────────────

function StepConnector({ onInsert }: { onInsert: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      className="flex flex-col items-center py-0.5"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div className="w-px h-4 bg-[#E2EDE2] dark:bg-[#1F2937]" />
      <button
        onClick={onInsert}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${hov ? "border-[#16A34A] bg-[#16A34A] text-white shadow-md scale-110" : "border-[#D1D5DB] dark:border-[#374151] bg-white dark:bg-[#111827] text-[#9CA3AF]"
          }`}
      >
        <Plus className="w-3 h-3" />
      </button>
      <div className="w-px h-4 bg-[#E2EDE2] dark:bg-[#1F2937]" />
    </div>
  );
}

// ─── Step Card ────────────────────────────────────────────────────────────────

function StepCard({
  step, index, onUpdate, onDelete,
}: {
  step: FlowStep; index: number; onUpdate: (s: FlowStep) => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const m = STEP_META[step.type];
  const Icon = m.icon;

  function set(field: keyof FlowStep, value: unknown) {
    onUpdate({ ...step, [field]: value });
  }
  function addBtn() {
    if ((step.buttons?.length ?? 0) >= 3) return;
    onUpdate({ ...step, buttons: [...(step.buttons ?? []), { id: genId(), label: "" }] });
  }
  function updateBtn(id: string, label: string) {
    onUpdate({ ...step, buttons: step.buttons?.map(b => b.id === id ? { ...b, label } : b) });
  }
  function removeBtn(id: string) {
    onUpdate({ ...step, buttons: step.buttons?.filter(b => b.id !== id) });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 overflow-hidden"
      style={{ borderColor: isDark ? m.darkBorder : m.border }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none transition-colors"
        style={{ background: isDark ? m.darkBg : m.bg }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.color + "22" }}>
          <Icon className="w-4 h-4" style={{ color: m.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: m.color }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{m.label}</span>
          </div>
          {!expanded && (
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate mt-0.5">{stepPreview(step)}</p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-xl text-[#C4C9C4] dark:text-[#6B7280] hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {expanded ? <ChevronUp className="w-4 h-4 text-[#9CA3AF] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF] shrink-0" />}
      </div>

      {/* Editor */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: "hidden" }}
          >
            <div className="bg-white dark:bg-[#111827] border-t-2 p-5 space-y-4 transition-colors" style={{ borderColor: isDark ? m.darkBorder : m.border }}>

              {/* Message text (message / question / buttons) */}
              {(step.type === "message" || step.type === "question" || step.type === "buttons") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">
                    {step.type === "question" ? "Question Text" : "Message"}
                  </Label>
                  <Textarea
                    value={step.message ?? ""}
                    onChange={e => set("message", e.target.value)}
                    placeholder={step.type === "question" ? "What service are you looking for?" : "Type your message here…"}
                    className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                    rows={3}
                  />
                  <p className="text-[10px] text-[#9CA3AF]">Use &#123;name&#125; to personalize the message.</p>
                </div>
              )}

              {/* Save reply variable (question) */}
              {step.type === "question" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Save Answer As</Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono text-[#6B7B6B]">{"{"}</span>
                    <Input
                      value={step.variableName ?? ""}
                      onChange={e => set("variableName", e.target.value.replace(/\s/g, "_").toLowerCase())}
                      placeholder="service"
                      className="h-9 rounded-xl text-sm font-mono bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                    <span className="text-sm font-mono text-[#6B7B6B]">{"}"}</span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF]">Reuse the answer later in messages with &#123;variable&#125;.</p>
                </div>
              )}

              {/* Button options (buttons) */}
              {step.type === "buttons" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Button Labels (max 3)</Label>
                  <div className="space-y-2">
                    {(step.buttons ?? []).map(btn => (
                      <div key={btn.id} className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-[#F8FAF8] dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] rounded-xl px-3 py-2">
                          <MousePointer className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                          <Input
                            value={btn.label}
                            onChange={e => updateBtn(btn.id, e.target.value)}
                            placeholder="Button label…"
                            className="border-0 bg-transparent p-0 h-auto text-sm font-medium shadow-none focus-visible:ring-0"
                          />
                        </div>
                        <button onClick={() => removeBtn(btn.id)} className="p-2 text-[#C4C9C4] hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  {(step.buttons?.length ?? 0) < 3 && (
                    <Button variant="outline" size="sm" onClick={addBtn} className="rounded-xl border-dashed text-[#6B7B6B] hover:text-[#16A34A] hover:border-[#16A34A]">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Button
                    </Button>
                  )}
                </div>
              )}

              {/* Tag name */}
              {step.type === "tag" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Tag Name</Label>
                  <Input
                    value={step.tagName ?? ""}
                    onChange={e => set("tagName", e.target.value)}
                    placeholder="e.g. hot-lead, after-hours, vip"
                    className="h-10 rounded-xl"
                  />
                </div>
              )}

              {/* Team note */}
              {step.type === "notify" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Note for Your Team</Label>
                  <Textarea
                    value={step.notifyNote ?? ""}
                    onChange={e => set("notifyNote", e.target.value)}
                    placeholder="e.g. High-value lead — prioritise follow-up within 1 hour"
                    className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                    rows={2}
                  />
                </div>
              )}

              {/* Booking */}
              {step.type === "booking" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Intro Message</Label>
                    <Textarea
                      value={step.message ?? ""}
                      onChange={e => set("message", e.target.value)}
                      placeholder="Great! Here's your booking link:"
                      className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Booking URL</Label>
                    <Input
                      value={step.bookingUrl ?? ""}
                      onChange={e => set("bookingUrl", e.target.value)}
                      placeholder="https://calendly.com/your-link"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                      type="url"
                    />
                  </div>
                </div>
              )}

              {/* Delay */}
              {step.type === "delay" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Wait Duration</Label>
                  <Select
                    value={String(step.delayMinutes ?? 30)}
                    onValueChange={v => set("delayMinutes", parseInt(v))}
                  >
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                      <SelectItem value="1440">24 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Condition */}
              {step.type === "condition" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100">
                    <span className="text-xs font-black text-purple-700 uppercase tracking-wider shrink-0">IF</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-sm font-mono text-purple-500">{"{"}</span>
                      <Input
                        value={step.conditionVariable ?? ""}
                        onChange={e => set("conditionVariable", e.target.value.replace(/\s/g, "_").toLowerCase())}
                        placeholder="variable"
                        className="h-8 rounded-lg text-sm font-mono w-28 border-purple-200 focus:border-purple-400"
                      />
                      <span className="text-sm font-mono text-purple-500">{"}"}</span>
                    </div>
                    <Select
                      value={step.conditionOperator ?? "equals"}
                      onValueChange={v => set("conditionOperator", v)}
                    >
                      <SelectTrigger className="h-8 rounded-lg text-xs w-36 border-purple-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">equals</SelectItem>
                        <SelectItem value="not_equals">does not equal</SelectItem>
                        <SelectItem value="contains">contains</SelectItem>
                        <SelectItem value="not_empty">is not empty</SelectItem>
                        <SelectItem value="is_empty">is empty</SelectItem>
                        <SelectItem value="starts_with">starts with</SelectItem>
                      </SelectContent>
                    </Select>
                    {!["not_empty", "is_empty"].includes(step.conditionOperator ?? "") && (
                      <Input
                        value={step.conditionValue ?? ""}
                        onChange={e => set("conditionValue", e.target.value)}
                        placeholder="value"
                        className="h-8 rounded-lg text-sm w-28 border-purple-200 focus:border-purple-400"
                      />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 rounded-xl border border-green-200 text-green-700">
                      <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                      If TRUE → continue
                    </div>
                    <div className="flex flex-col gap-2">
                      <Select
                        value={step.conditionFalseAction ?? "end"}
                        onValueChange={v => set("conditionFalseAction", v)}
                      >
                        <SelectTrigger className="px-3 py-2.5 bg-red-50 rounded-xl border-red-200 text-red-700 h-auto font-bold text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="end" className="text-red-700 font-bold">If FALSE → skip to end</SelectItem>
                          <SelectItem value="skip_next" className="text-orange-700 font-bold">If FALSE → skip next step</SelectItem>
                          <SelectItem value="jump_to" className="text-blue-700 font-bold">If FALSE → jump to step</SelectItem>
                        </SelectContent>
                      </Select>
                      {step.conditionFalseAction === "jump_to" && (
                        <div className="px-2">
                          <Input
                            placeholder="Target Step ID"
                            value={step.conditionFalseTargetId ?? ""}
                            onChange={e => set("conditionFalseTargetId", e.target.value)}
                            className="h-8 text-xs rounded-lg border-blue-200 bg-blue-50/50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF]">Enter the variable name without braces. If false, the flow stops here.</p>
                </div>
              )}

              {/* Send Media */}
              {step.type === "media" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Media Type</Label>
                    <Select value={step.mediaType ?? "image"} onValueChange={v => set("mediaType", v)}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="image">🖼️ Image</SelectItem>
                        <SelectItem value="video">🎥 Video</SelectItem>
                        <SelectItem value="document">📄 Document / PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">File URL</Label>
                    <Input
                      value={step.mediaUrl ?? ""}
                      onChange={e => set("mediaUrl", e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                      type="url"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Caption (optional)</Label>
                    <Textarea
                      value={step.mediaCaption ?? ""}
                      onChange={e => set("mediaCaption", e.target.value)}
                      placeholder="Add a caption for this media…"
                      className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Payment Step */}
              {step.type === "payment" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Amount</Label>
                      <Input
                        type="number"
                        value={step.paymentAmount ?? ""}
                        onChange={e => set("paymentAmount", e.target.value)}
                        placeholder="0.00"
                        className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Currency</Label>
                      <Select value={step.paymentCurrency ?? "USD"} onValueChange={v => set("paymentCurrency", v)}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD ($)</SelectItem>
                          <SelectItem value="EUR">EUR (€)</SelectItem>
                          <SelectItem value="GBP">GBP (£)</SelectItem>
                          <SelectItem value="INR">INR (₹)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Payment Description</Label>
                    <Input
                      value={step.paymentDescription ?? ""}
                      onChange={e => set("paymentDescription", e.target.value)}
                      placeholder="e.g. Consultation Fee"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                </div>
              )}

              {/* AI Agent Step */}
              {step.type === "ai_agent" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">AI Context / Prompt</Label>
                  <Textarea
                    value={step.aiPrompt ?? ""}
                    onChange={e => set("aiPrompt", e.target.value)}
                    placeholder="e.g. Answer using our service catalog: 'We offer dental implants starting at $1500...'"
                    className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                    rows={4}
                  />
                  <p className="text-[10px] text-[#9CA3AF]">The AI will use this context to answer the user's last message.</p>
                </div>
              )}

              {/* Webhook Step */}
              {step.type === "webhook" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Webhook URL (POST)</Label>
                    <Input
                      value={step.webhookUrl ?? ""}
                      onChange={e => set("webhookUrl", e.target.value)}
                      placeholder="https://api.yourdomain.com/webhook"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">JSON Payload (Optional)</Label>
                    <Textarea
                      value={step.webhookPayload ?? ""}
                      onChange={e => set("webhookPayload", e.target.value)}
                      placeholder='{ "lead_name": "{name}", "source": "whatsapp" }'
                      className="text-xs font-mono resize-none rounded-xl border-[#E2EDE2] p-3"
                      rows={3}
                    />
                    <p className="text-[10px] text-[#9CA3AF]">Send lead data to your CRM or internal systems.</p>
                  </div>
                </div>
              )}

              {/* Interactive List */}
              {step.type === "list" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Menu Title</Label>
                    <Input
                      value={step.listTitle ?? ""}
                      onChange={e => set("listTitle", e.target.value)}
                      placeholder="Choose a service…"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Menu Items (max 10)</Label>
                    <div className="space-y-2">
                      {(step.listItems ?? []).map((item, idx) => (
                        <div key={item.id} className="flex gap-2">
                          <div className="flex-1 space-y-2 bg-[#F8FAF8] border border-[#E2EDE2] rounded-xl p-3">
                            <Input
                              value={item.title}
                              onChange={e => {
                                const newItems = [...(step.listItems ?? [])];
                                newItems[idx] = { ...item, title: e.target.value };
                                set("listItems", newItems);
                              }}
                              placeholder="Item title…"
                              className="border-0 bg-transparent p-0 h-auto text-sm font-bold shadow-none focus-visible:ring-0"
                            />
                            <Input
                              value={item.desc ?? ""}
                              onChange={e => {
                                const newItems = [...(step.listItems ?? [])];
                                newItems[idx] = { ...item, desc: e.target.value };
                                set("listItems", newItems);
                              }}
                              placeholder="Short description (optional)…"
                              className="border-0 bg-transparent p-0 h-auto text-[11px] text-[#6B7B6B] shadow-none focus-visible:ring-0"
                            />
                          </div>
                          <button
                            onClick={() => set("listItems", step.listItems?.filter(i => i.id !== item.id))}
                            className="p-2 text-[#C4C9C4] hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(step.listItems?.length ?? 0) < 10 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => set("listItems", [...(step.listItems ?? []), { id: genId(), title: "" }])}
                        className="w-full rounded-xl border-dashed text-[#6B7B6B] hover:text-[#EC4899] hover:border-[#EC4899] h-10"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Menu Item
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Human Handover */}
              {step.type === "handover" && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-start gap-3">
                    <Headset className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-rose-900">AI Auto-Reply Paused</p>
                      <p className="text-[11px] text-rose-700 leading-relaxed">
                        When this step is reached, the AI assistant will stop responding to this contact and alert your human team for a manual takeover.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Handover Note for Team</Label>
                    <Textarea
                      value={step.handoverNote ?? ""}
                      onChange={e => set("handoverNote", e.target.value)}
                      placeholder="e.g. Lead requested a custom quote — human expert needed."
                      className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Google Sheets */}
              {step.type === "sheets" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Spreadsheet ID</Label>
                    <Input
                      value={step.spreadsheetId ?? ""}
                      onChange={e => set("spreadsheetId", e.target.value)}
                      placeholder="e.g. 1aBCdE_fghIjKlMnOpQrStUvW..."
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Sheet Name</Label>
                    <Input
                      value={step.sheetName ?? ""}
                      onChange={e => set("sheetName", e.target.value)}
                      placeholder="e.g. Leads, Sheet1"
                      className="h-10 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-emerald-700 leading-relaxed font-medium">
                      ✨ Lead data (name, phone, and collected variables) will be automatically appended as a new row.
                    </p>
                  </div>
                </div>
              )}

              {/* End Flow */}
              {step.type === "end" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Goodbye Message (optional)</Label>
                    <Textarea
                      value={step.endMessage ?? ""}
                      onChange={e => set("endMessage", e.target.value)}
                      placeholder="Thanks for chatting! We'll be in touch shortly. 🙏"
                      className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-3"
                      rows={3}
                    />
                    <p className="text-[10px] text-[#9CA3AF]">Leave blank to silently end the flow.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B]">Mark Lead As</Label>
                    <Select value={step.endLeadStage ?? "none"} onValueChange={v => set("endLeadStage", v)}>
                      <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No change</SelectItem>
                        <SelectItem value="qualified">✅ Qualified</SelectItem>
                        <SelectItem value="booked">📅 Booked</SelectItem>
                        <SelectItem value="lost">❌ Lost</SelectItem>
                        <SelectItem value="follow_up">🔄 Follow-up Later</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-[#9CA3AF]">Optionally update the lead's stage when this flow ends.</p>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Trigger Card ─────────────────────────────────────────────────────────────

function TriggerCard({ flow, onChange }: { flow: Flow; onChange: (p: Partial<Flow>) => void }) {
  const m = TRIGGER_META[flow.triggerType];
  return (
    <div className="rounded-2xl border-2 border-[#16A34A]/40 dark:border-[#16A34A]/20 overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[#F0FDF4] dark:bg-[#061A0C]">
        <div className="w-8 h-8 bg-[#16A34A] rounded-xl flex items-center justify-center shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-[#16A34A]">Trigger</span>
          <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">When does this flow start?</p>
        </div>
      </div>
      <div className="bg-white dark:bg-[#111827] border-t-2 border-[#16A34A]/20 p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Trigger Type</Label>
          <Select
            value={flow.triggerType}
            onValueChange={v => onChange({ triggerType: v as TriggerType })}
          >
            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937]">
              {(Object.keys(TRIGGER_META) as TriggerType[]).map(t => {
                const TIcon = TRIGGER_META[t].icon;
                return (
                  <SelectItem key={t} value={t} className="text-[#111827] dark:text-[#F9FAFB] focus:bg-[#F3F4F6] dark:focus:bg-[#0B0F1A]">
                    <div className="flex items-center gap-2">
                      <TIcon className="w-4 h-4" />
                      {TRIGGER_META[t].label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">{m.desc}</p>
        </div>
        {flow.triggerType === "keyword" && (
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Keyword</Label>
            <Input
              value={flow.triggerKeyword ?? ""}
              onChange={e => onChange({ triggerKeyword: e.target.value })}
              placeholder="e.g. book, hello, pricing"
              className="h-10 rounded-xl bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Flow Editor ──────────────────────────────────────────────────────────────

function FlowEditor({ flow, onUpdate, onSaveFlow, onBack }: { flow: Flow; onUpdate: (f: Flow) => void; onSaveFlow: (f: Flow) => Promise<void>; onBack: () => void }) {
  const { toast } = useToast();
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [deletingStepIndex, setDeletingStepIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(updates: Partial<Flow>) { onUpdate({ ...flow, ...updates }); }
  function updateStep(i: number, s: FlowStep) {
    const steps = [...flow.steps]; steps[i] = s; patch({ steps });
  }
  function deleteStep(i: number) {
    patch({ steps: flow.steps.filter((_, idx) => idx !== i) });
  }
  function insertStep(afterIndex: number, type: StepType) {
    const defaultStep: FlowStep = {
      id: genId(), type,
      message: ["message", "question", "buttons", "booking"].includes(type) ? "" : undefined,
      variableName: type === "question" ? "" : undefined,
      buttons: type === "buttons" ? [{ id: genId(), label: "" }] : undefined,
      tagName: type === "tag" ? "" : undefined,
      notifyNote: type === "notify" ? "" : undefined,
      bookingUrl: type === "booking" ? "" : undefined,
      delayMinutes: type === "delay" ? 30 : undefined,
      conditionVariable: type === "condition" ? "" : undefined,
      conditionOperator: type === "condition" ? "equals" : undefined,
      conditionValue: type === "condition" ? "" : undefined,
      conditionFalseAction: type === "condition" ? "end" : undefined,
      mediaType: type === "media" ? "image" : undefined,
      mediaUrl: type === "media" ? "" : undefined,
      mediaCaption: type === "media" ? "" : undefined,
      paymentAmount: type === "payment" ? "" : undefined,
      paymentCurrency: type === "payment" ? "USD" : undefined,
      paymentDescription: type === "payment" ? "" : undefined,
      aiPrompt: type === "ai_agent" ? "" : undefined,
      webhookUrl: type === "webhook" ? "" : undefined,
      webhookPayload: type === "webhook" ? "" : undefined,
      listTitle: type === "list" ? "" : undefined,
      listItems: type === "list" ? [{ id: genId(), title: "" }] : undefined,
      handoverNote: type === "handover" ? "" : undefined,
      spreadsheetId: type === "sheets" ? "" : undefined,
      sheetName: type === "sheets" ? "Sheet1" : undefined,
      endMessage: type === "end" ? "" : undefined,
      endLeadStage: type === "end" ? "none" : undefined,
    };
    const steps = [...flow.steps];
    steps.splice(afterIndex + 1, 0, defaultStep);
    patch({ steps });
    setInsertingAt(null);
  }

  async function save() {
    setSaving(true);
    try {
      await onSaveFlow(flow);
      toast("Flow saved successfully ✓", "success");
    } catch (e) {
      toast("Failed to save flow to cloud", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#111827] rounded-[24px] border border-[#E2EDE2]/60 dark:border-[#1F2937] shadow-premium overflow-hidden" style={{ minHeight: 650 }}>
      {/* Header bar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#F0F7F0] dark:border-[#1F2937] shrink-0 bg-[#F8FAF8]/50 dark:bg-[#0B0F1A]/40">
        <button
          onClick={onBack}
          className="p-2 hover:bg-white dark:hover:bg-[#111827] border border-transparent hover:border-[#E2EDE2] dark:hover:border-[#1F2937] rounded-xl transition-all group shadow-sm"
          title="Back to list"
        >
          <ArrowLeft className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] group-hover:text-[#16A34A]" />
        </button>
        <div className="flex-1 min-w-0">
          <Input
            value={flow.name}
            onChange={e => patch({ name: e.target.value })}
            className="text-lg font-bold border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 h-auto text-[#111827] dark:text-[#F9FAFB]"
            placeholder="Flow Name"
          />
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-wider">Currently Editing Workflow</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">Active</span>
          <Switch checked={flow.active} onCheckedChange={v => patch({ active: v })} className="data-[state=checked]:bg-[#16A34A]" />
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-[#16A34A] hover:bg-[#15803D] text-white h-9 px-4 rounded-xl text-sm font-bold shrink-0 shadow-md"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </div>
          ) : (
            <div className="flex items-center gap-2"><Save className="w-3.5 h-3.5" />Save Flow</div>
          )}
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg mx-auto">

          {/* Trigger */}
          <TriggerCard flow={flow} onChange={patch} />

          {/* Steps */}
          {flow.steps.map((step, i) => (
            <div key={step.id}>
              {insertingAt === i - 1 ? (
                <div className="py-2">
                  <AnimatePresence>
                    <StepPalette onAdd={t => insertStep(i - 1, t)} onClose={() => setInsertingAt(null)} />
                  </AnimatePresence>
                </div>
              ) : (
                <StepConnector onInsert={() => setInsertingAt(i - 1)} />
              )}
              <StepCard
                step={step}
                index={i}
                onUpdate={s => updateStep(i, s)}
                onDelete={() => setDeletingStepIndex(i)}
              />
            </div>
          ))}

          {/* Add step at end */}
          <div className="flex flex-col items-center mt-0">
            {insertingAt === flow.steps.length - 1 ? (
              <div className="py-2 w-full">
                <AnimatePresence>
                  <StepPalette
                    onAdd={t => insertStep(flow.steps.length - 1, t)}
                    onClose={() => setInsertingAt(null)}
                  />
                </AnimatePresence>
              </div>
            ) : (
              <>
                <div className="w-px h-5 bg-[#E2EDE2]" />
                <button
                  onClick={() => setInsertingAt(flow.steps.length - 1)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 border-dashed border-[#D1D5DB] text-[#6B7B6B] hover:border-[#16A34A] hover:text-[#16A34A] hover:bg-[#F0FDF4] transition-all text-sm font-bold mt-1"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </>
            )}
          </div>

      </div>

      <ConfirmDeleteDialog
        open={deletingStepIndex !== null}
        onOpenChange={(open) => !open && setDeletingStepIndex(null)}
        title="Delete Step?"
        description="This will remove this step and all its configuration from this flow. This action cannot be undone."
        onConfirm={async () => {
          if (deletingStepIndex !== null) {
            deleteStep(deletingStepIndex);
            setDeletingStepIndex(null);
          }
        }}
        trigger={<span className="hidden" />}
      />
      </div>
    </div>
  );
}

// ─── Chat Flows List (Gallery View) ──────────────────────────────────────────

function FlowCard({
  flow, onEdit, onDuplicate, onDelete
}: {
  flow: Flow; onEdit: () => void; onDuplicate: () => void; onDelete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-white dark:bg-[#111827] rounded-[24px] border border-[#E2EDE2]/60 dark:border-[#1F2937] shadow-sm hover:shadow-premium hover:border-[#16A34A]/30 transition-all p-6 flex flex-col h-full cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${flow.active ? "bg-[#DCFCE7] dark:bg-green-900/30 text-[#16A34A]" : "bg-[#F3F4F6] dark:bg-[#0B0F1A] text-[#9CA3AF] dark:text-[#6B7280]"}`}>
          <Workflow className={`w-6 h-6 ${flow.active ? "fill-[#16A34A]/20" : ""}`} />
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${flow.active ? "bg-[#DCFCE7] dark:bg-green-900/30 text-[#16A34A] border border-[#16A34A]/10" : "bg-gray-100 dark:bg-[#0B0F1A] text-gray-400"}`}>
            {flow.active ? "Active" : "Paused"}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
              <button className="p-2 rounded-xl hover:bg-[#F3F4F6] dark:hover:bg-[#0B0F1A] transition-all">
                <MoreHorizontal className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl p-1.5 min-w-[160px] bg-white dark:bg-[#111827] border border-[#E2EDE2] dark:border-[#1F2937]">
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onEdit(); }} className="rounded-lg py-2.5 text-[#111827] dark:text-[#F9FAFB] focus:bg-[#F3F4F6] dark:focus:bg-[#0B0F1A]">
                <Settings2 className="w-4 h-4 mr-2" /> Edit Flow
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onDuplicate(); }} className="rounded-lg py-2.5 text-[#111827] dark:text-[#F9FAFB] focus:bg-[#F3F4F6] dark:focus:bg-[#0B0F1A]">
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={e => { e.stopPropagation(); onDelete(); }} className="rounded-lg py-2.5 text-red-500 focus:text-red-500 focus:bg-red-50 dark:focus:bg-red-900/20">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Flow
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] mb-1 group-hover:text-[#16A34A] transition-colors">{flow.name}</h3>
        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed mb-4 line-clamp-2">
          Triggered by <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{TRIGGER_META[flow.triggerType].label.toLowerCase()}</span>.
          Contains {flow.steps.length} automated step{flow.steps.length !== 1 ? "s" : ""}.
        </p>
      </div>

      <div className="pt-4 border-t border-[#F0F7F0] dark:border-[#1F2937] flex items-center justify-between mt-auto">
        <div className="flex -space-x-2">
          {flow.steps.slice(0, 3).map((s, idx) => {
            const Icon = STEP_META[s.type].icon;
            return (
              <div key={s.id} className="w-7 h-7 rounded-lg bg-white dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] flex items-center justify-center shadow-sm" title={STEP_META[s.type].label}>
                <Icon className="w-3.5 h-3.5" style={{ color: STEP_META[s.type].color }} />
              </div>
            );
          })}
          {flow.steps.length > 3 && (
            <div className="w-7 h-7 rounded-lg bg-[#F8FAF8] dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] flex items-center justify-center text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF]">
              +{flow.steps.length - 3}
            </div>
          )}
        </div>
        <span className="text-[10px] font-bold text-[#16A34A] opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
          Open Editor <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </motion.div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChatFlowsList({
  flows, onEdit, onCreate, onDuplicate, onDelete
}: {
  flows: Flow[]; onEdit: (id: string) => void; onCreate: () => void; onDuplicate: (f: Flow) => void; onDelete: (id: string) => void;
}) {
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const flowToDelete = flows.find(f => f.id === deletingFlowId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Active Automation Flows</h2>
          <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF] mt-1">Manage your instant AI responses and customer journeys.</p>
        </div>
        <Button
          onClick={onCreate}
          className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-green-500/15 transition-all active:scale-[0.98] shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Create New Flow
        </Button>
      </div>

      {flows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {flows.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onEdit={() => onEdit(flow.id)}
              onDuplicate={() => onDuplicate(flow)}
              onDelete={() => setDeletingFlowId(flow.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#111827] rounded-[32px] border-2 border-dashed border-[#E2EDE2] dark:border-[#1F2937] p-16 text-center">
          <div className="w-20 h-20 bg-[#F0FDF4] dark:bg-green-900/20 rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Workflow className="w-10 h-10 text-[#16A34A]" />
          </div>
          <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] mb-2">No flows created yet</h3>
          <p className="text-[#6B7280] dark:text-[#9CA3AF] max-w-sm mx-auto mb-8">
            Start automating your customer interactions by creating your first chat flow today.
          </p>
          <Button onClick={onCreate} className="bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-12 px-8 rounded-xl shadow-md">
            <Plus className="w-5 h-5 mr-2" /> Create Your First Flow
          </Button>
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deletingFlowId}
        onOpenChange={(open) => !open && setDeletingFlowId(null)}
        title={`Delete Flow "${flowToDelete?.name}"?`}
        description="This will permanently delete this automation flow. Any active conversations using this flow will stop immediately."
        onConfirm={async () => {
          if (deletingFlowId) {
            await onDelete(deletingFlowId);
            setDeletingFlowId(null);
          }
        }}
        trigger={<span className="hidden" />}
      />
    </div>
  );
}

// ─── Settings Tab (existing config) ──────────────────────────────────────────

const defaultQuestions = [
  { id: "q1", text: "What service are you looking for?" },
  { id: "q2", text: "When are you looking to come in?" },
  { id: "q3", text: "Have you visited us before?" },
  { id: "q4", text: "How did you hear about us?" },
];

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function SectionCard({
  title, description, children, onSave,
}: {
  title: string; description?: string; children: React.ReactNode; onSave?: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function handleSave() {
    if (!onSave) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    onSave();
    setSaving(false);
  }
  return (
    <div className="bg-white dark:bg-[#111827] rounded-[24px] border border-[#E2EDE2]/60 dark:border-[#1F2937] shadow-premium p-8 flex flex-col h-full hover:border-[#16A34A]/20 transition-all">
      <div className="mb-8">
        <h3 className="text-xl font-extrabold text-[#0F1F0F] dark:text-[#F9FAFB] tracking-tight">{title}</h3>
        {description && <p className="text-sm font-medium text-[#6B7B6B] dark:text-[#9CA3AF] mt-2 leading-relaxed">{description}</p>}
      </div>
      <div className="space-y-7 flex-1">{children}</div>
      <div className="mt-10 pt-8 border-t border-[#F0F7F0] dark:border-[#1F2937]">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold h-12 rounded-xl shadow-lg shadow-green-500/10 transition-all active:scale-[0.98]"
        >
          {saving ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Applying Changes…
            </div>
          ) : (
            <div className="flex items-center gap-2"><Save className="w-4 h-4" />Update Behavioral Logic</div>
          )}
        </Button>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    "ai_enabled": true,
    ai_auto_pipeline: false,
    business_name: "",
    industry: "online",
    ai_tone: "friendly",
    escalation_threshold: 8,
    questions: defaultQuestions,
    reengagement_enabled: true,
    reengagement_window: "30min",
    reengagement_message: "Hi {name}! 👋 Just checking in — were you still interested in our previous chat?",
    reengagement_cap: 2,
    followup_enabled: true,
    followup_window: "7d",
    followup_stages: ["New", "Contacted"],
    followup_message: "Hi {name}! 👋 Just checking back to see if you are still interested? Feel free to ask any questions!",
    booking_url: "",
    qualification_gate: 3,
    confirmation_message: "Your appointment is confirmed! ✅ You'll receive a reminder 1 hour before. Looking forward to seeing you!",
    working_hours_enabled: false,
    working_hours: days.reduce<Record<string, { start: string; end: string; active: boolean }>>((a, d) => ({ ...a, [d]: { start: "09:00", end: "18:00", active: true } }), {}),
    ooo_message: "Thanks for reaching out! 🙏 We're currently outside our business hours. We'll get back to you first thing in the morning!",
  });

  const [newQuestion, setNewQuestion] = useState("");
  const [availableStages, setAvailableStages] = useState(["New", "Contacted", "Qualifying", "Qualified", "Proposal", "Booked", "Lost"]);

  useEffect(() => {
    const stored = localStorage.getItem("whatsflow_leads_pipeline");
    if (stored) {
      try {
        const pipeline = JSON.parse(stored);
        if (Array.isArray(pipeline) && pipeline.length > 0) {
          setAvailableStages(pipeline.map((p: any) => p.stage));
        }
      } catch (e) {
        console.error("Pipeline fallback failure:", e);
      }
    }
  }, []);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiFetch('/api/settings');
        if (data && Object.keys(data).length > 0) {
          setSettings(prev => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave() {
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings)
      });
      toast("Settings updated successfully ✓", "success");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast("Failed to save settings", "error");
    }
  }

  function addQuestion() {
    if (newQuestion.trim()) {
      setSettings(prev => ({
        ...prev,
        questions: [...prev.questions, { id: genId(), text: newQuestion.trim() }]
      }));
      setNewQuestion("");
    }
  }

  const update = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-[#16A34A] animate-spin" />
        <p className="text-sm text-[#6B7B6B]">Loading AI intelligence...</p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Core Intelligence */}
      <SectionCard title="Core Intelligence" description="Define the identity and baseline personality of your AI assistant." onSave={handleSave}>
        <AutomationToggle
          label="AI Auto-Response"
          description="Activate the AI to instantly handle incoming WhatsApp leads."
          checked={settings.ai_enabled}
          onCheckedChange={v => update("ai_enabled", v)}
        />
        <AutomationToggle
          label="AI Auto Pipeline Status"
          description="Let AI automatically advance lead pipeline stages based on conversation intent."
          checked={settings.ai_auto_pipeline}
          onCheckedChange={v => update("ai_auto_pipeline", v)}
        />
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Business Profile Name</Label>
          <Input
            value={settings.business_name}
            onChange={e => update("business_name", e.target.value)}
            className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Industry Category</Label>
            <Select value={settings.industry} onValueChange={v => update("industry", v)}>
              <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937]">
                <SelectItem value="dental">Health & Medical</SelectItem>
                <SelectItem value="real-estate">Real Estate</SelectItem>
                <SelectItem value="salon">Professional Services</SelectItem>
                <SelectItem value="physio">Consultancy</SelectItem>
                <SelectItem value="online">SaaS / Tech</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">AI Tone & Voice</Label>
            <Select value={settings.ai_tone} onValueChange={v => update("ai_tone", v)}>
              <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937]">
                <SelectItem value="friendly">Warm & Welcoming</SelectItem>
                <SelectItem value="professional">Direct & Expert</SelectItem>
                <SelectItem value="casual">Friendly & Informal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Human Escalation Threshold</Label>
          <Input
            type="number"
            value={settings.escalation_threshold}
            onChange={e => update("escalation_threshold", parseInt(e.target.value))}
            min="1" max="20" className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
          <p className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF]">Messages before notifying your team for takeover.</p>
        </div>
      </SectionCard>

      {/* Qualification Questions */}
      <SectionCard title="Qualification Questions" description="Sequence of questions used to gather lead information before booking." onSave={handleSave}>
        <Reorder.Group axis="y" values={settings.questions} onReorder={v => update("questions", v)} className="space-y-3">
          {settings.questions.map((q, i) => (
            <Reorder.Item
              key={q.id}
              value={q}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 bg-[#F8FAF8] dark:bg-[#0B0F1A] border border-[#E2EDE2]/60 dark:border-[#1F2937] rounded-2xl px-5 py-4 group hover:border-[#16A34A]/40 hover:bg-white dark:hover:bg-[#111827] hover:shadow-sm transition-all cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="w-5 h-5 text-gray-300 group-hover:text-[#16A34A] transition-colors shrink-0" />
              <div className="flex-1 flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-6 h-6 shrink-0 text-[10px] font-extrabold text-[#16A34A] bg-[#DCFCE7] border border-[#16A34A]/10 rounded-lg">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-sm text-[#0F1F0F] dark:text-[#F9FAFB] font-bold truncate">{q.text}</span>
              </div>
              <button
                onClick={() => update("questions", settings.questions.filter(item => item.id !== q.id))}
                className="opacity-0 group-hover:opacity-100 transition-all text-red-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 active:scale-90"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
        <div className="flex gap-3 pt-2">
          <Input
            placeholder="Add a custom qualifying question…"
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addQuestion()}
            className="text-sm h-12 rounded-2xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
          <Button variant="outline" size="icon" onClick={addQuestion} className="h-12 w-12 shrink-0 border-[#E2EDE2] dark:border-[#1F2937] text-[#16A34A] hover:bg-green-50 dark:hover:bg-green-900/10 hover:border-[#16A34A] rounded-2xl">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </SectionCard>

      {/* Lead Re-engagement */}
      <SectionCard title="Lead Re-engagement" description="Automatically follow up with leads who have gone silent mid-conversation." onSave={handleSave}>
        <AutomationToggle
          label="Enable Follow-ups"
          description="AI will ping leads if they don't reply within the set window."
          checked={settings.reengagement_enabled}
          onCheckedChange={v => update("reengagement_enabled", v)}
        />
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Follow-up Window</Label>
          <Select value={settings.reengagement_window} onValueChange={v => update("reengagement_window", v)}>
            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937]">
              <SelectItem value="15min">15 minutes</SelectItem>
              <SelectItem value="30min">30 minutes</SelectItem>
              <SelectItem value="1hr">1 hour of silence</SelectItem>
              <SelectItem value="2hr">2 hours of silence</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Follow-up Message</Label>
          <Textarea
            value={settings.reengagement_message}
            onChange={e => update("reengagement_message", e.target.value)}
            className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] p-4" rows={3}
          />
          <p className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF]">Use &#123;name&#125; to personalise the message.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Attempt Cap</Label>
          <Input
            type="number"
            value={settings.reengagement_cap}
            onChange={e => update("reengagement_cap", parseInt(e.target.value))}
            min="1" max="5" className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
        </div>
      </SectionCard>

      {/* Mid-Stage Follow-up */}
      <SectionCard title="Long-term Nurturing" description="Follow up with leads stuck mid-journey who haven't reached a final status yet." onSave={handleSave}>
        <AutomationToggle
          label="Mid-Stage Follow-up"
          description="Revive interest from leads who went cold after starting."
          checked={settings.followup_enabled}
          onCheckedChange={v => update("followup_enabled", v)}
        />
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Follow-up Delay</Label>
          <Select value={settings.followup_window} onValueChange={v => update("followup_window", v)}>
            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937]">
              <SelectItem value="1d">24 Hours later</SelectItem>
              <SelectItem value="3d">3 Days later</SelectItem>
              <SelectItem value="7d">1 Week later</SelectItem>
              <SelectItem value="14d">2 Weeks later</SelectItem>
              <SelectItem value="30d">1 Month later</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Applies to Stages</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {availableStages.map((stage) => {
              const isSelected = (settings.followup_stages ?? []).includes(stage);
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => {
                    const current = settings.followup_stages ?? [];
                    const next = isSelected ? current.filter(s => s !== stage) : [...current, stage];
                    update("followup_stages", next);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${isSelected 
                    ? "bg-[#16A34A] border-[#16A34A] text-white shadow-md shadow-green-500/15 scale-105" 
                    : "bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#6B7B6B] dark:text-[#9CA3AF] hover:border-[#16A34A]/40"
                  }`}
                >
                  {stage}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Follow-up Message</Label>
          <Textarea
            value={settings.followup_message}
            onChange={e => update("followup_message", e.target.value)}
            className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] p-4" rows={3}
          />
          <p className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF]">Will automatically trigger for leads stalled mid-conversation. Use &#123;name&#125; to personalize.</p>
        </div>
      </SectionCard>

      {/* Booking & Conversion */}
      <SectionCard title="Booking & Conversion" description="Configure how lead conversations transition into confirmed meetings." onSave={handleSave}>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Calendar Integration URL</Label>
          <Input
            type="url"
            value={settings.booking_url}
            onChange={e => update("booking_url", e.target.value)}
            placeholder="https://…" className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Qualification Gate</Label>
          <Input
            type="number"
            value={settings.qualification_gate}
            onChange={e => update("qualification_gate", parseInt(e.target.value))}
            min="1" max="10" className="h-11 rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB]"
          />
          <p className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF]">Send the booking link after gathering N answers.</p>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Post-Booking Confirmation</Label>
          <Textarea
            value={settings.confirmation_message}
            onChange={e => update("confirmation_message", e.target.value)}
            className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] p-4" rows={3}
          />
        </div>
      </SectionCard>

      {/* Working Hours */}
      <div className="lg:col-span-2">
        <SectionCard title="Availability & Hours" description="Control when the AI responds and how it handles off-hour inquiries." onSave={handleSave}>
          <AutomationToggle
            label="Enforce Working Hours"
            description="If enabled, AI will only respond during the windows defined below."
            checked={settings.working_hours_enabled}
            onCheckedChange={v => update("working_hours_enabled", v)}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            {days.map(day => (
              <div key={day} className="flex items-center justify-between bg-[#F8FAF8] dark:bg-[#0B0F1A] border border-[#E2EDE2] dark:border-[#1F2937] rounded-2xl px-6 py-4 shadow-sm transition-all hover:bg-white dark:hover:bg-[#111827] hover:shadow-md">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={settings.working_hours[day]?.active}
                    onCheckedChange={v => update("working_hours", { ...settings.working_hours, [day]: { ...settings.working_hours[day], active: v } })}
                    className="data-[state=checked]:bg-[#16A34A]"
                  />
                  <span className="text-base font-bold text-[#0F1F0F] dark:text-[#F9FAFB] w-12">{day}</span>
                </div>
                {settings.working_hours[day]?.active ? (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider mb-1">Open</span>
                      <Input
                        type="time"
                        value={settings.working_hours[day].start}
                        onChange={e => update("working_hours", { ...settings.working_hours, [day]: { ...settings.working_hours[day], start: e.target.value } })}
                        className="h-10 text-xs font-bold px-3 bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] rounded-xl w-[110px]"
                      />
                    </div>
                    <span className="text-[#6B7B6B] dark:text-[#9CA3AF] text-[10px] font-black uppercase mt-4">To</span>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider mb-1">Close</span>
                      <Input
                        type="time"
                        value={settings.working_hours[day].end}
                        onChange={e => update("working_hours", { ...settings.working_hours, [day]: { ...settings.working_hours[day], end: e.target.value } })}
                        className="h-10 text-xs font-bold px-3 bg-white dark:bg-[#111827] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] rounded-xl w-[110px]"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 dark:bg-red-900/10 px-4 py-2 rounded-xl border border-red-100 dark:border-red-900/20">
                    <span className="text-[11px] font-black text-red-500 uppercase tracking-[0.15em]">Closed</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7B6B] dark:text-[#9CA3AF]">Out-of-Office Response</Label>
            <Textarea
              value={settings.ooo_message}
              onChange={e => update("ooo_message", e.target.value)}
              className="text-sm resize-none rounded-xl bg-white dark:bg-[#0B0F1A] border-[#E2EDE2] dark:border-[#1F2937] text-[#0F1F0F] dark:text-[#F9FAFB] p-4" rows={2}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const { toast } = useToast();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("flows");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFlows() {
      try {
        const data = await apiFetch('/api/flows');
        setFlows(data);
      } catch (err) {
        console.error("Failed to load flows:", err);
      } finally {
        setLoading(false);
      }
    }
    loadFlows();
  }, []);

  const editingFlow = flows.find(f => f.id === editingId) || null;



  function genId() {
    return Math.random().toString(36).substring(2, 9);
  }

  async function createFlow() {
    const f: Flow = {
      id: genId(),
      name: "Untitled Flow",
      active: true,
      triggerType: "keyword",
      triggerKeyword: "",
      steps: []
    };

    setFlows(prev => [f, ...prev]);
    setEditingId(f.id);
    setActiveTab("editor");
  }

  function updateFlow(updated: Flow) {
    // Only update local UI state immediately to prevent DB spam
    setFlows(prev => prev.map(f => f.id === updated.id ? updated : f));
  }

  async function saveFlowToCloud(flowToSave: Flow) {
    const response = await apiFetch('/api/flows', {
      method: 'POST',
      body: JSON.stringify(flowToSave)
    });
    
    // Once saved, replace the temporary UI id with the actual Database UUID
    if (response && response.id) {
      setFlows(prev => prev.map(f => f.id === flowToSave.id ? { ...flowToSave, id: response.id } : f));
      if (editingId === flowToSave.id) {
        setEditingId(response.id);
      }
    }
  }

  async function deleteFlow(id: string) {
    try {
      await apiFetch(`/api/flows/${id}`, {
        method: 'DELETE'
      });
      setFlows(prev => prev.filter(f => f.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setActiveTab("flows");
      }
      toast("Flow deleted successfully", "success");
    } catch (err) {
      console.error("Failed to delete flow:", err);
      toast("Failed to delete flow", "error");
    }
  }

  function duplicateFlow(flow: Flow) {
    const copy: Flow = { ...flow, id: genId(), name: flow.name + " (Copy)", active: false };
    setFlows(prev => [copy, ...prev]);
    setEditingId(copy.id);
    setActiveTab("editor");
  }

  function startEditing(id: string) {
    setEditingId(id);
    setActiveTab("editor");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#16A34A] animate-spin" />
        <p className="text-sm text-[#6B7B6B]">Loading automations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Automation"
        description="Build WhatsApp chat flows and configure your AI assistant's behavior."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-white dark:bg-[#111827] p-1 rounded-2xl border border-[#E2EDE2] dark:border-[#1F2937] inline-flex">
            <TabsTrigger
              value="flows"
              className="rounded-xl px-5 py-2 text-sm font-bold data-[state=active]:bg-[#16A34A]/10 data-[state=active]:text-[#16A34A] text-[#6B7280] dark:text-[#9CA3AF] transition-all"
            >
              <Workflow className="w-4 h-4 mr-2 inline" />
              Chat Flows
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="rounded-xl px-5 py-2 text-sm font-bold data-[state=active]:bg-[#16A34A]/10 data-[state=active]:text-[#16A34A] text-[#6B7280] dark:text-[#9CA3AF] transition-all"
            >
              <Settings2 className="w-4 h-4 mr-2 inline" />
              AI Settings
            </TabsTrigger>
            {editingFlow && (
              <TabsTrigger
                value="editor"
                className="rounded-xl px-5 py-2 text-sm font-bold data-[state=active]:bg-[#16A34A]/10 data-[state=active]:text-[#16A34A] text-[#6B7280] dark:text-[#9CA3AF] transition-all"
              >
                <Workflow className="w-4 h-4 mr-2 inline" />
                Editor: {editingFlow.name}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="flows" className="mt-8 outline-none">
          <ChatFlowsList
            flows={flows}
            onEdit={startEditing}
            onCreate={createFlow}
            onDuplicate={duplicateFlow}
            onDelete={deleteFlow}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-8 outline-none">
          <SettingsTab />
        </TabsContent>

        {editingFlow && (
          <TabsContent value="editor" className="mt-8 outline-none focus-visible:ring-0">
            <FlowEditor
              flow={editingFlow}
              onUpdate={updateFlow}
              onSaveFlow={saveFlowToCloud}
              onBack={() => setActiveTab("flows")}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
