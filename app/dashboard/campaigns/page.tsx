"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Send, Users, CheckCheck, Eye, MessageCircle,
  Clock, Calendar, Search, Play, Pause, Copy, Trash2,
  MoreHorizontal, Megaphone, ChevronRight,
  ImageIcon, Check, Tag, Filter, TrendingUp, Loader2
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "paused";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  audienceType: "all" | "tag";
  audienceTag?: string;
  audienceCount: number;
  message: string;
  mediaType?: "image" | "video" | "document";
  buttons?: string[];
  scheduledAt?: string;
  sentAt?: string;
  stats: { sent: number; delivered: number; read: number; replied: number };
  createdAt: string;
}

interface CampaignForm {
  name: string;
  audienceType: "all" | "tag";
  audienceTag: string;
  message: string;
  hasMedia: boolean;
  mediaType: "image" | "video" | "document";
  mediaUrl: string;
  hasButtons: boolean;
  buttonLabels: string[];
  scheduleType: "now" | "later";
  scheduledDate: string;
  scheduledTime: string;
}

const STATUS: Record<CampaignStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
  scheduled: { label: "Scheduled", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  running: { label: "Running", color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0" },
  completed: { label: "Completed", color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  paused: { label: "Paused", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};

const AVAILABLE_TAGS = ["returning-patient", "inactive", "hot-lead", "qualified", "after-hours", "vip"];

const BLANK_FORM: CampaignForm = {
  name: "", audienceType: "all", audienceTag: "",
  message: "", hasMedia: false, mediaType: "image", mediaUrl: "",
  hasButtons: false, buttonLabels: ["", ""],
  scheduleType: "now", scheduledDate: "", scheduledTime: "",
};

function genId() { 
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function pct(n: number, t: number) { return t === 0 ? "—" : Math.round((n / t) * 100) + "%"; }
function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: CampaignStatus }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border"
      style={{ color: s.color, background: s.bg, borderColor: s.border }}
    >
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
      {s.label}
    </span>
  );
}

function CampaignCard({
  campaign, onDelete, onDuplicate, onLaunch, onPause, onResume,
}: {
  campaign: Campaign;
  onDelete: () => void;
  onDuplicate: () => void;
  onLaunch: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const { sent, delivered, read, replied } = campaign.stats;
  const hasStats = sent > 0;

  const primaryAction = ((): { label: string; icon: React.ElementType; action: () => void; cls: string } | null => {
    switch (campaign.status) {
      case "draft":
      case "scheduled": return { label: "Launch Now", icon: Send, action: onLaunch, cls: "bg-[#22C55E] hover:bg-[#16A34A] text-white" };
      case "running": return { label: "Pause", icon: Pause, action: onPause, cls: "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/20 text-amber-700 border border-amber-200" };
      case "paused": return { label: "Resume", icon: Play, action: onResume, cls: "bg-[#22C55E] hover:bg-[#16A34A] text-white" };
      default: return null;
    }
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm p-6 flex flex-col gap-4 hover:border-[#22C55E]/30 transition-all duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] truncate">{campaign.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <StatusBadge status={campaign.status} />
            <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
              <Users className="w-3 h-3" />
              {campaign.audienceType === "all"
                ? `All contacts (${campaign.audienceCount.toLocaleString()})`
                : `Tag: ${campaign.audienceTag} (${campaign.audienceCount.toLocaleString()})`}
            </span>
            {(campaign.sentAt || campaign.scheduledAt) && (
              <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                {campaign.status === "scheduled" ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                {campaign.status === "scheduled"
                  ? `Scheduled ${fmtDate(campaign.scheduledAt)}`
                  : `Sent ${fmtDate(campaign.sentAt)}`}
              </span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-xl text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-all">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
            <DropdownMenuItem onClick={onDuplicate} className="rounded-xl text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
              <Copy className="w-4 h-4 mr-2" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-[#E5E7EB] dark:bg-[#1F2937]" />
            <DropdownMenuItem onClick={onDelete} className="rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Message preview */}
      <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl px-4 py-3 border border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="flex items-start gap-2">
          {campaign.mediaType && (
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0 mt-0.5">
              <ImageIcon className="w-4 h-4 text-sky-500" />
            </div>
          )}
          <p className="text-sm text-[#111827] dark:text-[#F9FAFB] leading-relaxed line-clamp-2 font-medium">{campaign.message}</p>
        </div>
        {campaign.buttons && campaign.buttons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {campaign.buttons.map((btn, i) => (
              <span key={i} className="text-[11px] font-bold text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2.5 py-1 rounded-lg">
                {btn}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      {hasStats ? (
        <div className="grid grid-cols-4 gap-2">
          {([
            { icon: Send, label: "Sent", value: sent.toLocaleString(), sub: "", color: "#6B7280" },
            { icon: CheckCheck, label: "Delivered", value: delivered.toLocaleString(), sub: pct(delivered, sent), color: "#22C55E" },
            { icon: Eye, label: "Read", value: read.toLocaleString(), sub: pct(read, sent), color: "#2563EB" },
            { icon: MessageCircle, label: "Replied", value: replied.toLocaleString(), sub: pct(replied, sent), color: "#7C3AED" },
          ] as const).map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl p-2.5 text-center border border-[#E5E7EB] dark:border-[#1F2937]">
                <Icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
                <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{stat.value}</p>
                {stat.sub && <p className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF]">{stat.sub}</p>}
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{stat.label}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-[#9CA3AF] bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl px-4 py-3 border border-[#E5E7EB] dark:border-[#1F2937] font-medium">
          <TrendingUp className="w-4 h-4" />
          {campaign.status === "scheduled" ? "Stats will appear once the campaign launches." : "No stats yet — launch to get started."}
        </div>
      )}

      {/* Primary action */}
      {primaryAction && (
        <Button onClick={primaryAction.action} className={`w-full h-10 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 shadow-md ${primaryAction.cls}`}>
          <primaryAction.icon className="w-4 h-4 mr-2" />
          {primaryAction.label}
        </Button>
      )}
    </motion.div>
  );
}

function CreateCampaignSheet({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Campaign) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<CampaignForm>(BLANK_FORM);
  const [launching, setLaunching] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);

  useEffect(() => {
    async function loadContacts() {
      try {
        const leads = await apiFetch('/api/leads');
        setTotalContacts(leads.length);
      } catch (err) {
        console.error("Failed to load contacts:", err);
      }
    }
    loadContacts();
  }, []);

  function patch(u: Partial<CampaignForm>) { setForm(p => ({ ...p, ...u })); }
  function reset() { setStep(1); setForm(BLANK_FORM); }

  async function launch() {
    setLaunching(true);
    try {
      const now = new Date().toISOString();
      const newCampaign: Campaign = {
        id: genId(),
        name: form.name.trim() || "Untitled Campaign",
        status: form.scheduleType === "now" ? "running" : "scheduled",
        audienceType: form.audienceType,
        audienceTag: form.audienceType === "tag" ? form.audienceTag : undefined,
        audienceCount: form.audienceType === "all" ? totalContacts : 0,
        message: form.message,
        mediaType: form.hasMedia ? form.mediaType : undefined,
        buttons: form.hasButtons ? form.buttonLabels.filter(b => b.trim()) : undefined,
        scheduledAt: form.scheduleType === "later" ? `${form.scheduledDate}T${form.scheduledTime || "09:00"}:00` : undefined,
        sentAt: form.scheduleType === "now" ? now : undefined,
        stats: { sent: 0, delivered: 0, read: 0, replied: 0 },
        createdAt: now,
      };

      await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(newCampaign)
      });

      onCreated(newCampaign);
      toast(form.scheduleType === "now" ? "Campaign launched! 🚀" : "Campaign scheduled! 📅", "success");
      reset();
      onClose();
    } catch (err) {
      console.error("Failed to launch campaign:", err);
      toast("Failed to process campaign", "error");
    } finally {
      setLaunching(false);
    }
  }

  const STEPS = ["Audience", "Message", "Schedule"];

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#1F2937]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] dark:border-[#1F2937]">
          <h2 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">New Campaign</h2>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Send a bulk message to your WhatsApp contacts</p>
        </div>

        {/* Step indicators */}
        <div className="px-6 pt-4 pb-5 border-b border-[#E5E7EB] dark:border-[#1F2937]">
          <div className="flex items-start">
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${done ? "bg-[#22C55E] text-white" :
                        active ? "bg-[#22C55E] text-white ring-4 ring-[#22C55E]/20" :
                          "bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}>
                      {done ? <Check className="w-3.5 h-3.5" /> : n}
                    </div>
                    <span className={`text-[10px] font-bold whitespace-nowrap ${active ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors duration-300 ${done ? "bg-[#22C55E]" : "bg-[#E5E7EB] dark:bg-[#1F2937]"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {step === 1 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Campaign Name</Label>
                <Input
                  value={form.name}
                  onChange={e => patch({ name: e.target.value })}
                  placeholder="e.g. Spring Promo, Follow-up Round 2"
                  className="h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Send To</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { type: "all" as const, icon: Users, label: "All Contacts", sub: `${totalContacts.toLocaleString()} contacts` },
                    { type: "tag" as const, icon: Tag, label: "By Tag", sub: "Filter by label" },
                  ] as const).map(opt => {
                    const Icon = opt.icon;
                    const active = form.audienceType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        onClick={() => patch({ audienceType: opt.type })}
                        className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border-2 text-left transition-all ${active ? "border-[#22C55E] bg-[#22C55E]/10" : "border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:border-[#22C55E]/40"
                          }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]"}`} />
                        <p className={`text-sm font-bold ${active ? "text-[#22C55E]" : "text-[#111827] dark:text-[#F9FAFB]"}`}>{opt.label}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{opt.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.audienceType === "tag" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Select Tag</Label>
                  <Select value={form.audienceTag} onValueChange={v => patch({ audienceTag: v })}>
                    <SelectTrigger className="h-11 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"><SelectValue placeholder="Choose a tag…" /></SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                      {AVAILABLE_TAGS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Message</Label>
                <Textarea
                  value={form.message}
                  onChange={e => patch({ message: e.target.value.slice(0, 1024) })}
                  placeholder="Hi {name}! 👋 Write your message here…"
                  className="text-sm resize-none bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl p-4 font-medium leading-relaxed"
                  rows={5}
                />
                <div className="flex justify-between">
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Use &#123;name&#125; to personalise</p>
                  <p className="text-[10px] font-mono text-[#6B7280] dark:text-[#9CA3AF]">{form.message.length} / 1024</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] overflow-hidden">
                <button
                  onClick={() => patch({ hasMedia: !form.hasMedia })}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:bg-[#F3F4F6] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                    <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Attach Media</span>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">optional</span>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${form.hasMedia ? "bg-[#22C55E] border-[#22C55E]" : "border-[#E5E7EB] dark:border-[#1F2937]"}`}>
                    {form.hasMedia && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
                {form.hasMedia && (
                  <div className="px-4 py-4 space-y-3 border-t border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
                    <Select value={form.mediaType} onValueChange={v => patch({ mediaType: v as CampaignForm["mediaType"] })}>
                      <SelectTrigger className="h-10 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                        <SelectItem value="image">🖼️ Image</SelectItem>
                        <SelectItem value="video">🎥 Video</SelectItem>
                        <SelectItem value="document">📄 Document / PDF</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input value={form.mediaUrl} onChange={e => patch({ mediaUrl: e.target.value })} placeholder="https://…" className="h-10 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" type="url" />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] overflow-hidden">
                <button
                  onClick={() => patch({ hasButtons: !form.hasButtons })}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:bg-[#F3F4F6] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                    <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Quick Reply Buttons</span>
                    <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">optional · max 3</span>
                  </div>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${form.hasButtons ? "bg-[#22C55E] border-[#22C55E]" : "border-[#E5E7EB] dark:border-[#1F2937]"}`}>
                    {form.hasButtons && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
                {form.hasButtons && (
                  <div className="px-4 py-4 space-y-2 border-t border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
                    {form.buttonLabels.map((label, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-[#22C55E] w-5 shrink-0">{i + 1}</span>
                        <Input
                          value={label}
                          onChange={e => {
                            const next = [...form.buttonLabels];
                            next[i] = e.target.value;
                            patch({ buttonLabels: next });
                          }}
                          placeholder={`Button ${i + 1}…`}
                          className="h-9 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-sm"
                        />
                      </div>
                    ))}
                    {form.buttonLabels.length < 3 && (
                      <button
                        onClick={() => patch({ buttonLabels: [...form.buttonLabels, ""] })}
                        className="text-[11px] font-bold text-[#22C55E] hover:text-[#16A34A] flex items-center gap-1 mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another button
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">When to Send</Label>
                {([
                  { type: "now" as const, icon: Send, label: "Send Now", sub: "Launch immediately to all selected contacts" },
                  { type: "later" as const, icon: Calendar, label: "Schedule Later", sub: "Pick a specific date and time" },
                ] as const).map(opt => {
                  const Icon = opt.icon;
                  const active = form.scheduleType === opt.type;
                  return (
                    <button
                      key={opt.type}
                      onClick={() => patch({ scheduleType: opt.type })}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${active ? "border-[#22C55E] bg-[#22C55E]/10" : "border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:border-[#22C55E]/40"
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? "bg-[#22C55E]" : "bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937]"}`}>
                        <Icon className={`w-4 h-4 ${active ? "text-white" : "text-[#6B7280] dark:text-[#9CA3AF]"}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${active ? "text-[#22C55E]" : "text-[#111827] dark:text-[#F9FAFB]"}`}>{opt.label}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{opt.sub}</p>
                      </div>
                      {active && <Check className="w-4 h-4 text-[#22C55E] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {form.scheduleType === "later" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Date</Label>
                    <Input type="date" value={form.scheduledDate} onChange={e => patch({ scheduledDate: e.target.value })} className="h-10 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Time</Label>
                    <Input type="time" value={form.scheduledTime} onChange={e => patch({ scheduledTime: e.target.value })} className="h-10 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937]" />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Preview</Label>
                <div className="bg-[#ECE5DD] dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-4">
                  <div className="bg-[#DCF8C6] dark:bg-[#22C55E]/15 rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs shadow-sm">
                    <p className="text-sm text-[#111B21] dark:text-[#F9FAFB] font-medium leading-relaxed whitespace-pre-wrap">
                      {form.message || <span className="text-[#6B7280] dark:text-[#9CA3AF] italic text-xs">Your message will appear here…</span>}
                    </p>
                    {form.hasButtons && form.buttonLabels.some(b => b.trim()) && (
                      <div className="mt-2 space-y-1">
                        {form.buttonLabels.filter(b => b.trim()).map((btn, i) => (
                          <div key={i} className="bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl px-3 py-1.5 text-center text-xs font-bold text-[#0693E3] dark:text-[#22C55E]">
                            {btn}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-[#667781] dark:text-[#9CA3AF] text-right mt-1">9:41 AM ✓✓</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] flex items-center gap-3">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="rounded-xl flex-1 font-bold text-[#6B7280] dark:text-[#9CA3AF] bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => { reset(); onClose(); }} className="rounded-xl flex-1 font-bold text-[#6B7280] dark:text-[#9CA3AF] bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
              Cancel
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && !form.name.trim()}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl flex-1 font-bold disabled:opacity-40 transition-all duration-200"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={launch}
              disabled={!form.message.trim() || launching}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl flex-1 font-bold disabled:opacity-40 transition-all duration-200 shadow-md shadow-[#22C55E]/15"
            >
              {launching ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {form.scheduleType === "now" ? "Launching…" : "Scheduling…"}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {form.scheduleType === "now" ? <Send className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                  {form.scheduleType === "now" ? "Launch Campaign" : "Schedule Campaign"}
                </div>
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const data = await apiFetch('/api/campaigns');
        setCampaigns(data);
      } catch (err) {
        console.error("Failed to load campaigns:", err);
      } finally {
        setLoading(false);
      }
    }
    loadCampaigns();
  }, []);

  const totalSent = campaigns.reduce((s, c) => s + (c.stats?.sent || 0), 0);

  const avgDelivery = (() => {
    const valid = campaigns.filter(c => (c.stats?.sent || 0) > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((a, c) => a + (c.stats?.delivered || 0) / (c.stats?.sent || 1), 0) / valid.length * 100);
  })();

  const avgRead = (() => {
    const valid = campaigns.filter(c => (c.stats?.sent || 0) > 0);
    if (!valid.length) return 0;
    return Math.round(valid.reduce((a, c) => a + (c.stats?.read || 0) / (c.stats?.sent || 1), 0) / valid.length * 100);
  })();

  const filtered = campaigns.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function removeCampaign(id: string) {
    try {
      await apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      setCampaigns(p => p.filter(c => c.id !== id));
      toast("Campaign deleted", "success");
    } catch (err) {
      toast("Failed to delete campaign", "error");
    }
  }

  async function duplicateCampaign(campaign: Campaign) {
    const copy: Campaign = {
      ...campaign, id: genId(), name: campaign.name + " (Copy)",
      status: "draft", stats: { sent: 0, delivered: 0, read: 0, replied: 0 },
      createdAt: new Date().toISOString(),
    };
    try {
      await apiFetch('/api/campaigns', { method: 'POST', body: JSON.stringify(copy) });
      setCampaigns(p => [copy, ...p]);
      toast("Campaign duplicated", "success");
    } catch (err) {
      toast("Failed to duplicate campaign", "error");
    }
  }

  async function launchCampaign(id: string) {
    try {
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) return;

      const updated: Campaign = { ...campaign, status: "running", sentAt: new Date().toISOString() };

      await apiFetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(updated)
      });

      setCampaigns(p => p.map(c => c.id === id ? updated : c));
      toast("Campaign launched! 🚀", "success");
    } catch (err) {
      toast("Failed to launch campaign", "error");
    }
  }

  async function pauseCampaign(id: string) {
    setCampaigns(p => p.map(c => c.id === id ? { ...c, status: "paused" } : c));
    toast("Campaign paused", "success");
  }

  async function resumeCampaign(id: string) {
    setCampaigns(p => p.map(c => c.id === id ? { ...c, status: "running" } : c));
    toast("Campaign resumed 🚀", "success");
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Campaigns"
        count={campaigns.length}
        description="Create and send bulk WhatsApp messages to your contacts at scale."
        rightContent={
          <Button
            onClick={() => setSheetOpen(true)}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 px-5 rounded-xl shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          { label: "Total Campaigns", value: campaigns.length, icon: Megaphone, color: "#22C55E", bg: "#22C55E/10" },
          { label: "Messages Sent", value: totalSent.toLocaleString(), icon: Send, color: "#2563EB", bg: "#EFF6FF" },
          { label: "Avg Delivery", value: avgDelivery + "%", icon: CheckCheck, color: "#0D9488", bg: "#F0FDFA" },
          { label: "Avg Read Rate", value: avgRead + "%", icon: Eye, color: "#7C3AED", bg: "#FAF5FF" },
        ] as const).map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-5 flex items-center gap-4 transition-colors duration-300">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827] dark:text-[#F9FAFB] leading-none">{stat.value}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-10 h-11 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-11 rounded-xl w-48 bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
            <SelectItem value="all">All Statuses</SelectItem>
            {(Object.keys(STATUS) as CampaignStatus[]).map(s => (
              <SelectItem key={s} value={s}>{STATUS[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campaign grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl">
          <div className="w-16 h-16 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 text-[#22C55E] rounded-2xl flex items-center justify-center mb-4">
            <Megaphone className="w-8 h-8 text-[#22C55E]" />
          </div>
          <p className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] mb-1">No campaigns found</p>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6 font-medium">
            {search || statusFilter !== "all"
              ? "Try adjusting your filters."
              : "Create your first campaign to start reaching your contacts."}
          </p>
          {!search && statusFilter === "all" && (
            <Button onClick={() => setSheetOpen(true)} className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 px-6 rounded-xl shadow-md active:scale-95 transition-all">
              <Plus className="w-4 h-4 mr-2" /> New Campaign
            </Button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map(campaign => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onDelete={() => removeCampaign(campaign.id)}
              onDuplicate={() => duplicateCampaign(campaign)}
              onLaunch={() => launchCampaign(campaign.id)}
              onPause={() => pauseCampaign(campaign.id)}
              onResume={() => resumeCampaign(campaign.id)}
            />
          ))}
        </div>
      )}

      <CreateCampaignSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={c => setCampaigns(p => [c, ...p])}
      />
    </div>
  );
}
