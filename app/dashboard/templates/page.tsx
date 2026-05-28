"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Send, MessageSquare, Check, Trash2, Edit2, Search, Filter,
  Eye, FileText, Smartphone, Layout, Globe, Copy, CheckCircle, HelpCircle,
  AlertCircle, ChevronRight, Sparkles, Loader2
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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type TemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";
type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  components: {
    header?: { type: "TEXT" | "IMAGE"; text?: string; url?: string };
    body: { text: string };
    footer?: { text: string };
    buttons?: { type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY"; text: string; value?: string }[];
  };
  created_at?: string;
  updated_at?: string;
}

interface TemplateForm {
  name: string;
  category: TemplateCategory;
  language: string;
  headerType: "NONE" | "TEXT";
  headerText: string;
  bodyText: string;
  footerText: string;
  hasButtons: boolean;
  buttons: { type: "URL" | "QUICK_REPLY"; text: string; value: string }[];
}

const CATEGORIES: Record<TemplateCategory, { label: string; desc: string; color: string; bg: string }> = {
  UTILITY: { label: "Utility", desc: "Order confirmation, shipping update, account alert", color: "#2563EB", bg: "#EFF6FF" },
  MARKETING: { label: "Marketing", desc: "Promo offers, product announcements, newsletters", color: "#16A34A", bg: "#F0FDF4" },
  AUTHENTICATION: { label: "Authentication", desc: "OTP codes, verification, security", color: "#7C3AED", bg: "#FAF5FF" },
};

const STATUSES: Record<TemplateStatus, { label: string; color: string; bg: string; border: string }> = {
  APPROVED: { label: "Approved", color: "#22C55E", bg: "#E8FBF0", border: "#A7F3D0" },
  PENDING: { label: "Pending Meta Approval", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  REJECTED: { label: "Rejected", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  DRAFT: { label: "Draft", color: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" },
};

const LANGUAGES = [
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "es_ES", label: "Spanish (Spain)" },
  { code: "fr_FR", label: "French (France)" },
  { code: "de_DE", label: "German" },
];

const BLANK_FORM: TemplateForm = {
  name: "",
  category: "MARKETING",
  language: "en_US",
  headerType: "NONE",
  headerText: "",
  bodyText: "",
  footerText: "",
  hasButtons: false,
  buttons: [{ type: "QUICK_REPLY", text: "", value: "" }],
};

// Removed DEFAULT_TEMPLATES static array

function genId() { return "wt-" + Math.random().toString(36).slice(2, 9); }
function formatMetaName(v: string) {
  return v.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 512);
}

export default function TemplatesPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | "all">("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WhatsAppTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WhatsAppTemplate | null>(null);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const data = await apiFetch("/api/whatsapp-templates");
        if (data && data.length > 0) {
          setTemplates(data);
        } else {
          setTemplates([]);
        }
      } catch (err) {
        setTemplates([]);
        console.error("Template load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  // Handlers directly reference setTemplates

  const filtered = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/whatsapp-templates/${id}`, { method: "DELETE" });
      setTemplates(templates.filter(t => t.id !== id));
      toast("Template successfully deleted", "success");
    } catch (err: any) {
      console.error("Delete error:", err);
      toast(err.message || "Failed to delete template", "error");
    }
  };

  const handleDuplicate = async (template: WhatsAppTemplate) => {
    const copy: WhatsAppTemplate = {
      ...template,
      id: genId(),
      name: formatMetaName(template.name + "_copy"),
      status: "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try {
      const savedDb = await apiFetch("/api/whatsapp-templates", {
        method: "POST",
        body: JSON.stringify(copy)
      });
      if (savedDb) {
        setTemplates([savedDb, ...templates]);
        toast("Template duplicated", "success");
      }
    } catch (err: any) {
      console.error("Duplicate error:", err);
      toast(err.message || "Failed to duplicate template", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm font-semibold text-[#6B7280] dark:text-[#9CA3AF] animate-pulse">Connecting to WhatsApp Templates Backend...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="WhatsApp Message Templates"
        count={templates.length}
        description="Design high-performance pre-approved templates for Meta Cloud API campaigns and chat automations."
        rightContent={
          <Button
            onClick={() => {
              setEditingTemplate(null);
              setSheetOpen(true);
            }}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 px-5 rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Template</span>
          </Button>
        }
      />

      {/* Toolbar / Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by template name..."
            className="pl-10 h-11 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] focus:border-[#22C55E]/40"
          />
        </div>
        <div className="flex items-center gap-3">
          <Select value={categoryFilter} onValueChange={v => setCategoryFilter(v as any)}>
            <SelectTrigger className="h-11 rounded-xl w-44 bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                <SelectValue placeholder="All Categories" />
              </div>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(CATEGORIES).map(([key, value]) => (
                <SelectItem key={key} value={key}>{value.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Templates Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 text-[#22C55E] rounded-2xl flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">No Templates Found</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 max-w-sm">Create and store your very first high-conversion WhatsApp message template.</p>
          <Button onClick={() => setSheetOpen(true)} className="mt-6 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl h-10 px-5 font-bold shadow-md active:scale-95 transition-all">
            <Plus className="w-4 h-4 mr-2" />
            Get Started
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => {
                setEditingTemplate(t);
                setSheetOpen(true);
              }}
              onDelete={() => setDeletingTemplate(t)}
              onDuplicate={() => handleDuplicate(t)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deletingTemplate && (
        <ConfirmDeleteDialog
          open={!!deletingTemplate}
          onOpenChange={(open) => !open && setDeletingTemplate(null)}
          title={`Delete Template "${deletingTemplate.name}"?`}
          description="This action cannot be undone. If this template is actively used in automations, those flows may fail."
          onConfirm={async () => {
            await handleDelete(deletingTemplate.id);
            setDeletingTemplate(null);
          }}
          trigger={<span className="hidden" />}
        />
      )}

      {/* Slideout Form Panel */}
      <CreateEditTemplateSheet
        open={sheetOpen}
        template={editingTemplate}
        onClose={() => {
          setSheetOpen(false);
          setEditingTemplate(null);
        }}
        onSave={async (saved) => {
          try {
            const savedDb = await apiFetch("/api/whatsapp-templates", {
              method: "POST",
              body: JSON.stringify(saved)
            });
            if (savedDb) {
              setTemplates((prev) => {
                const index = prev.findIndex(item => item.id === saved.id || item.id === savedDb.id);
                if (index >= 0) {
                  const copy = [...prev];
                  copy[index] = savedDb;
                  return copy;
                } else {
                  return [savedDb, ...prev];
                }
              });
              toast(editingTemplate ? "Template changes synchronized ✓" : "Template submitted for approval 🚀", "success");
            }
          } catch (err: any) {
            console.error("Save error:", err);
            toast(err.message || "Failed to save template.", "error");
          }
          setSheetOpen(false);
          setEditingTemplate(null);
        }}
      />
    </div>
  );
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate
}: {
  template: WhatsAppTemplate;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const s = STATUSES[template.status] || STATUSES.DRAFT;
  const c = CATEGORIES[template.category] || CATEGORIES.MARKETING;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#22C55E]/30 shadow-sm p-5 flex flex-col justify-between gap-4 transition-all duration-300 group hover:shadow-md"
    >
      <div>
        {/* Header/Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB] text-base leading-snug break-all group-hover:text-[#22C55E] transition-colors">
              {template.name}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-xl uppercase tracking-wider border"
                style={{ color: s.color, backgroundColor: s.bg, borderColor: s.border }}
              >
                {s.label}
              </span>
              <span
                className="text-[10px] font-extrabold px-2 py-0.5 rounded-xl uppercase tracking-wider border"
                style={{ color: c.color, backgroundColor: c.bg, borderColor: c.color + "15" }}
              >
                {c.label}
              </span>
              <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {template.language}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] rounded-xl hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-all">
                <Layout className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
              <DropdownMenuItem onClick={onEdit} className="rounded-xl text-xs font-bold gap-2 text-[#111827] dark:text-[#F9FAFB]">
                <Edit2 className="w-3.5 h-3.5" /> Edit Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate} className="rounded-xl text-xs font-bold gap-2 text-[#111827] dark:text-[#F9FAFB]">
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#E5E7EB] dark:bg-[#1F2937]" />
              <DropdownMenuItem onClick={onDelete} className="rounded-xl text-xs font-bold gap-2 text-red-500 focus:bg-red-50 dark:focus:bg-red-900/10">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Message body preview */}
        <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl p-4 border border-[#E5E7EB] dark:border-[#1F2937] text-xs text-[#111827] dark:text-[#F9FAFB] leading-relaxed relative min-h-[90px] max-h-[140px] overflow-hidden flex flex-col justify-between">
          <div className="line-clamp-4">
            {template.components.header?.text && (
              <p className="font-bold text-[#111827] dark:text-[#F9FAFB] mb-1.5">{template.components.header.text}</p>
            )}
            <p className="whitespace-pre-line leading-relaxed">{template.components.body.text}</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#F9FAFB] dark:from-[#0B0F1A] to-transparent pointer-events-none" />
        </div>

        {/* Buttons preview */}
        {template.components.buttons && template.components.buttons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#1F2937]">
            {template.components.buttons.map((b, i) => (
              <span key={i} className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2.5 py-1.5 rounded-xl flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[#22C55E]" />
                {b.text}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#E5E7EB] dark:border-[#1F2937] pt-4 mt-auto">
        <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#9CA3AF]">
          Updated: {template.updated_at ? new Date(template.updated_at).toLocaleDateString() : "Just now"}
        </span>
        <Button
          onClick={onEdit}
          variant="ghost"
          size="sm"
          className="h-8 px-3.5 rounded-xl font-bold text-xs text-[#22C55E] hover:bg-[#22C55E]/10 flex items-center gap-1.5"
        >
          <span>Modify</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function CreateEditTemplateSheet({
  open,
  template,
  onClose,
  onSave,
}: {
  open: boolean;
  template: WhatsAppTemplate | null;
  onClose: () => void;
  onSave: (t: WhatsAppTemplate) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<TemplateForm>(BLANK_FORM);

  useEffect(() => {
    if (template) {
      setForm({
        name: template.name,
        category: template.category,
        language: template.language || "en_US",
        headerType: template.components.header?.type === "TEXT" ? "TEXT" : "NONE",
        headerText: template.components.header?.text || "",
        bodyText: template.components.body.text,
        footerText: template.components.footer?.text || "",
        hasButtons: template.components.buttons && template.components.buttons.length > 0 ? true : false,
        buttons: template.components.buttons
          ? template.components.buttons.map(b => ({
            type: b.type === "URL" ? "URL" : "QUICK_REPLY",
            text: b.text,
            value: b.value || ""
          }))
          : [{ type: "QUICK_REPLY", text: "", value: "" }]
      });
    } else {
      setForm(BLANK_FORM);
    }
  }, [template, open]);

  const patch = (u: Partial<TemplateForm>) => setForm(p => ({ ...p, ...u }));

  const handleSubmit = (statusToSet: TemplateStatus = "PENDING") => {
    if (!form.name.trim()) {
      toast("Please provide a template name.", "error");
      return;
    }
    if (!form.bodyText.trim()) {
      toast("Please compose your message body.", "error");
      return;
    }

    const compiled: WhatsAppTemplate = {
      id: template?.id || genId(),
      name: formatMetaName(form.name),
      category: form.category,
      language: form.language,
      status: statusToSet,
      components: {
        header: form.headerType === "TEXT" && form.headerText.trim()
          ? { type: "TEXT", text: form.headerText }
          : undefined,
        body: { text: form.bodyText },
        footer: form.footerText.trim() ? { text: form.footerText } : undefined,
        buttons: form.hasButtons
          ? form.buttons.filter(b => b.text.trim()).map(b => ({
            type: b.type === "URL" ? "URL" : "QUICK_REPLY",
            text: b.text,
            value: b.type === "URL" ? b.value || "" : undefined
          }))
          : undefined
      },
      created_at: template?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    onSave(compiled);
    toast(template ? "Template changes synchronized ✓" : "Template submitted for approval 🚀", "success");
  };

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-4xl lg:max-w-5xl xl:max-w-[1100px] p-0 flex flex-col h-screen bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#1F2937]">
        <div className="grid md:grid-cols-[55%_45%] xl:grid-cols-[60%_40%] flex-1 h-full overflow-hidden">
          <div className="flex flex-col border-r border-[#E5E7EB] dark:border-[#1F2937] h-full overflow-hidden bg-white dark:bg-[#111827]">
            <div className="px-6 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
              <h2 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">
                {template ? "Modify WhatsApp Template" : "New WhatsApp Template"}
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Ensure full Meta Cloud compliance with format constraints.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Meta System Name</Label>
                  <Input
                    value={form.name}
                    onChange={e => patch({ name: formatMetaName(e.target.value) })}
                    placeholder="e.g. promotional_update_v1"
                    className="h-11 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-mono text-xs"
                  />
                  <p className="text-[9px] text-[#6B7280] dark:text-[#9CA3AF]">Only lowercase characters, numbers, and underscores are valid.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Category</Label>
                    <Select value={form.category} onValueChange={v => patch({ category: v as any })}>
                      <SelectTrigger className="h-11 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                        {Object.entries(CATEGORIES).map(([key, value]) => (
                          <SelectItem key={key} value={key} className="text-xs">
                            {value.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Language</Label>
                    <Select value={form.language} onValueChange={v => patch({ language: v })}>
                      <SelectTrigger className="h-11 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                        {LANGUAGES.map(lang => (
                          <SelectItem key={lang.code} value={lang.code} className="text-xs">
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-5 border-t border-[#E5E7EB] dark:border-[#1F2937] pt-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Header Option</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={form.headerType === "NONE" ? "default" : "outline"}
                      onClick={() => patch({ headerType: "NONE", headerText: "" })}
                      className={`h-9 px-4 rounded-xl text-xs font-bold ${form.headerType === "NONE" ? "bg-[#22C55E] hover:bg-[#16A34A] text-white" : "border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] bg-white dark:bg-[#111827]"
                        }`}
                    >
                      None
                    </Button>
                    <Button
                      type="button"
                      variant={form.headerType === "TEXT" ? "default" : "outline"}
                      onClick={() => patch({ headerType: "TEXT" })}
                      className={`h-9 px-4 rounded-xl text-xs font-bold ${form.headerType === "TEXT" ? "bg-[#22C55E] hover:bg-[#16A34A] text-white" : "border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] bg-white dark:bg-[#111827]"
                        }`}
                    >
                      Text Header
                    </Button>
                  </div>
                  {form.headerType === "TEXT" && (
                    <Input
                      value={form.headerText}
                      onChange={e => patch({ headerText: e.target.value.slice(0, 60) })}
                      placeholder="e.g. Exclusive Weekend Offer"
                      className="h-10 rounded-xl mt-2 bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs font-medium"
                    />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Message Body</Label>
                  <Textarea
                    value={form.bodyText}
                    onChange={e => patch({ bodyText: e.target.value.slice(0, 1024) })}
                    placeholder="Write your text here..."
                    className="min-h-[120px] bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl p-4 leading-relaxed font-medium resize-none text-xs"
                  />
                  <div className="flex items-center justify-between mt-1 text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                    <span className="font-semibold">Add variables by typing &#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;, etc.</span>
                    <span className="font-mono">{form.bodyText.length}/1024</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Footer</Label>
                  <Input
                    value={form.footerText}
                    onChange={e => patch({ footerText: e.target.value.slice(0, 60) })}
                    placeholder="e.g. Reply STOP to opt out"
                    className="h-10 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs font-medium"
                  />
                </div>
              </div>

              {/* Action Buttons Toggle */}
              <div className="space-y-3 border-t border-[#E5E7EB] dark:border-[#1F2937] pt-5">
                <button
                  type="button"
                  onClick={() => patch({ hasButtons: !form.hasButtons })}
                  className="w-full flex items-center justify-between p-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:bg-[#F3F4F6] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Smartphone className="w-4 h-4 text-[#22C55E]" />
                    <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">Include Quick Reply / URL Buttons</span>
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${form.hasButtons ? "bg-[#22C55E] border-[#22C55E] text-white" : "border-[#E5E7EB] dark:border-[#1F2937]"}`}>
                    {form.hasButtons && <Check className="w-3.5 h-3.5" />}
                  </div>
                </button>

                {form.hasButtons && (
                  <div className="space-y-3 p-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937]">
                    {form.buttons.map((btn, index) => (
                      <div key={index} className="space-y-2 border-b border-[#E5E7EB] dark:border-[#1F2937] pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold text-[#22C55E]">Button {index + 1}</span>
                          {form.buttons.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = [...form.buttons];
                                copy.splice(index, 1);
                                patch({ buttons: copy });
                              }}
                              className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={btn.type}
                            onValueChange={v => {
                              const copy = [...form.buttons];
                              copy[index].type = v as any;
                              patch({ buttons: copy });
                            }}
                          >
                            <SelectTrigger className="h-11 rounded-xl bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                              <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                              <SelectItem value="URL">Website Link</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={btn.text}
                            onChange={e => {
                              const copy = [...form.buttons];
                              copy[index].text = e.target.value.slice(0, 25);
                              patch({ buttons: copy });
                            }}
                            placeholder="Label (max 25 chars)"
                            className="h-11 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-xs col-span-2"
                          />
                        </div>
                        {btn.type === "URL" && (
                          <Input
                            value={btn.value}
                            onChange={e => {
                              const copy = [...form.buttons];
                              copy[index].value = e.target.value;
                              patch({ buttons: copy });
                            }}
                            placeholder="URL e.g. https://domain.com"
                            className="h-10 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-xs mt-1"
                            type="url"
                          />
                        )}
                      </div>
                    ))}
                    {form.buttons.length < 3 && (
                      <button
                        type="button"
                        onClick={() => patch({ buttons: [...form.buttons, { type: "QUICK_REPLY", text: "", value: "" }] })}
                        className="text-[11px] font-bold text-[#22C55E] hover:text-[#16A34A] flex items-center gap-1 mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add another button
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Submittal Actions */}
            <div className="p-6 border-t border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] flex flex-wrap gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-11 rounded-xl text-xs font-bold flex-1 border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] bg-white dark:bg-[#111827]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit("DRAFT")}
                className="h-11 rounded-xl text-xs font-bold flex-1 bg-[#22C55E]/10 border border-[#22C55E] text-[#22C55E] shadow-sm transition-all"
              >
                Save Draft
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit("PENDING")}
                disabled={!form.bodyText.trim() || !form.name.trim()}
                className="h-11 rounded-xl text-xs font-bold flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-md active:scale-95 transition-all disabled:opacity-40"
              >
                Submit Template
              </Button>
            </div>
          </div>

          {/* Right Panel: WhatsApp Device Simulator */}
          <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] p-8 hidden md:flex flex-col items-center justify-center relative select-none h-full border-l border-[#E5E7EB] dark:border-[#1F2937]">
            <div className="w-[330px] max-w-[330px] bg-white dark:bg-[#111827] rounded-[40px] shadow-2xl border-8 border-gray-900 overflow-hidden relative flex flex-col h-[580px] shrink-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-5 bg-gray-900 rounded-b-2xl z-20 flex items-end justify-center pb-1">
                <div className="w-8 h-1 bg-gray-800 rounded-full" />
              </div>

              <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] pt-4 px-6 pb-2 flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#1F2937] mt-1 select-none">
                <span className="text-[11px] font-bold text-black dark:text-white">9:41 AM</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3 bg-black dark:bg-white rounded-sm border border-black dark:border-white" />
                </div>
              </div>

              <div className="bg-[#128C7E] text-white p-3.5 flex items-center gap-3 shrink-0">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">W</span>
                </div>
                <div>
                  <h4 className="text-xs font-bold leading-none">Meta Business API</h4>
                  <p className="text-[9px] text-white/80 mt-1 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-white fill-green-400" /> WhatsApp Official
                  </p>
                </div>
              </div>

              <div className="flex-1 bg-[#ECE5DD] dark:bg-[#0B0F1A] p-4 overflow-y-auto flex flex-col justify-end">
                <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] self-start shadow-sm mb-2">
                  {form.headerType === "TEXT" && form.headerText.trim() && (
                    <div className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] mb-1.5 border-b border-[#E5E7EB] dark:border-[#1F2937] pb-1">
                      {form.headerText}
                    </div>
                  )}

                  <div className="text-xs text-[#111B21] dark:text-[#F9FAFB] leading-relaxed whitespace-pre-wrap break-words min-h-[24px]">
                    {form.bodyText.trim() ? (
                      form.bodyText
                    ) : (
                      <span className="text-[#6B7280] dark:text-[#9CA3AF] italic text-xs">Write your message to preview...</span>
                    )}
                  </div>

                  {form.footerText.trim() && (
                    <div className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-1.5 border-t border-[#E5E7EB] dark:border-[#1F2937] pt-1">
                      {form.footerText}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 text-[9px] text-[#6B7280] dark:text-[#9CA3AF] mt-1.5">
                    <span>9:41 AM</span>
                    <span className="text-[#22C55E]">✓✓</span>
                  </div>
                </div>

                {form.hasButtons && form.buttons.some(b => b.text.trim()) && (
                  <div className="self-start max-w-[85%] w-full space-y-1 mb-2">
                    {form.buttons.filter(b => b.text.trim()).map((btn, index) => (
                      <div
                        key={index}
                        className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] rounded-xl px-4 py-2.5 shadow-sm text-center text-xs font-bold text-[#007AFF] dark:text-[#22C55E] flex items-center justify-center gap-1.5"
                      >
                        {btn.type === "URL" ? (
                          <Globe className="w-3.5 h-3.5" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5" />
                        )}
                        <span>{btn.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
