"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search, Plus, Download, LayoutList, Columns3,
  Phone, MessageCircle, MoreHorizontal, Edit3, Trash2, Eye,
  Clock, Zap, User, ArrowRight, Upload, Settings2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddLeadModal } from "@/components/dashboard/leads/AddLeadModal";
import { ImportLeadsModal } from "@/components/dashboard/leads/ImportLeadsModal";
import { ManageStatusesModal, type PipelineItem } from "@/components/dashboard/leads/ManageStatusesModal";
import { EditLeadModal } from "@/components/dashboard/leads/EditLeadModal";
import { ViewLeadDrawer } from "@/components/dashboard/leads/ViewLeadDrawer";
import { DeleteLeadDialog } from "@/components/dashboard/leads/DeleteLeadDialog";
import { LeadsTable } from "@/components/dashboard/leads/LeadsTable";
import { useLeads } from "@/hooks/useLeads";
import { useNotificationsContext } from "@/context/NotificationsContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/dashboard/PageHeading";
import type { Lead, LeadFormData, LeadStage, SortConfig } from "@/types/index";

// ── Pipeline config ───────────────────────────────────────────────────────────

interface StageConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  lightBg: string;
}

const DEFAULT_PIPELINE: PipelineItem[] = [
  {
    stage: "New",
    config: { label: "New", color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", lightBg: "#EFF6FF" },
  },
  {
    stage: "Contacted",
    config: { label: "Contacted", color: "#8B5CF6", bg: "#F5F3FF", border: "#DDD6FE", lightBg: "#F5F3FF" },
  },
  {
    stage: "Qualifying",
    config: { label: "Qualifying", color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", lightBg: "#FFFBEB" },
  },
  {
    stage: "Qualified",
    config: { label: "Qualified", color: "#F97316", bg: "#FFF7ED", border: "#FED7AA", lightBg: "#FFF7ED" },
  },
  {
    stage: "Proposal",
    config: { label: "Proposal", color: "#06B6D4", bg: "#ECFEFF", border: "#A5F3FC", lightBg: "#ECFEFF" },
  },
  {
    stage: "Booked",
    config: { label: "Booked ✓", color: "#22C55E", bg: "#F0FDF4", border: "#BBF7D0", lightBg: "#F0FDF4" },
  },
  {
    stage: "Lost",
    config: { label: "Lost", color: "#EF4444", bg: "#FEF2F2", border: "#FECACA", lightBg: "#FEF2F2" },
  },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const URGENCY_ICON: Record<string, { icon: string; cls: string }> = {
  "Today":      { icon: "🔥", cls: "text-red-500" },
  "This Week":  { icon: "⚡", cls: "text-amber-500" },
  "Next Week":  { icon: "📅", cls: "text-blue-500" },
  "This Month": { icon: "🗓️", cls: "text-purple-500" },
  "Flexible":   { icon: "🌿", cls: "text-green-500" },
};

// ── Lead card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  onView,
  onEdit,
  onDelete,
  onDragStart,
}: {
  lead: Lead;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const urg = URGENCY_ICON[lead.urgency] ?? { icon: "📋", cls: "text-gray-400" };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="group bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:border-[#22C55E]/30 transition-all duration-200 cursor-grab active:cursor-grabbing active:shadow-lg active:scale-[0.98] select-none"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 !bg-[#22C55E]"
            style={{ backgroundColor: "#22C55E" }}
          >
            {(lead.name || "?").charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] truncate leading-tight">{lead.name}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">{lead.phone}</p>
          </div>
        </div>

        {/* Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
            className="w-6 h-6 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#6B7280] dark:hover:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-30 w-36 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl shadow-xl py-1 overflow-hidden">
              <button onClick={() => { setMenuOpen(false); onView(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                <Eye className="w-3.5 h-3.5" /> View
              </button>
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <div className="my-1 border-t border-[#E5E7EB] dark:border-[#1F2937]" />
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Service */}
      <p className="text-[11px] font-semibold text-[#111827] dark:text-[#F9FAFB] bg-[#F9FAFB] dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-lg px-2 py-1 mb-2.5 truncate">
        {lead.service}
      </p>

      {/* Meta row */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-[11px] font-bold", urg.cls)}>{urg.icon}</span>
          <span className="text-[10px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{lead.urgency}</span>
        </div>
        <span className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280]">{timeAgo(lead.lastActivity)}</span>
      </div>

      {/* Source */}
      {lead.source && (
        <div className="mt-2 flex items-center gap-1">
          <span className="text-[10px] text-[#9CA3AF] dark:text-[#6B7280] truncate">{lead.source}</span>
        </div>
      )}
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  config,
  leads,
  dragOverStage,
  onDragOver,
  onDragLeave,
  onDrop,
  onView,
  onEdit,
  onDelete,
  onDragStart,
  onAddLead,
}: {
  stage: any;
  config: StageConfig;
  leads: Lead[];
  dragOverStage: any;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onView: (l: Lead) => void;
  onEdit: (l: Lead) => void;
  onDelete: (l: Lead) => void;
  onDragStart: (e: React.DragEvent, l: Lead) => void;
  onAddLead: () => void;
}) {
  const isOver = dragOverStage === stage;

  return (
    <div className="flex flex-col w-[272px] shrink-0">
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-xl mb-2"
        style={{ background: config.bg, border: `1.5px solid ${config.border}` }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: config.color }} />
          <span className="text-xs font-black" style={{ color: config.color }}>{config.label}</span>
        </div>
        <span
          className="text-[10px] font-black px-2 py-0.5 rounded-lg"
          style={{ background: `${config.color}22`, color: config.color }}
        >
          {leads.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex-1 min-h-[120px] rounded-2xl p-2 space-y-2.5 transition-all duration-150",
          isOver
            ? "ring-2 ring-offset-1 bg-opacity-60"
            : "bg-[#F9FAFB] dark:bg-[#0B0F1A]/50"
        )}
        style={isOver ? {
          background: `${config.color}0D`,
          boxShadow: `inset 0 0 0 2px ${config.color}`,
        } : undefined}
      >
        <AnimatePresence>
          {leads.map(lead => (
            <motion.div
              key={lead.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <LeadCard
                lead={lead}
                onView={() => onView(lead)}
                onEdit={() => onEdit(lead)}
                onDelete={() => onDelete(lead)}
                onDragStart={e => onDragStart(e, lead)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {leads.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-6 gap-1.5">
            <div className="w-8 h-8 rounded-xl border-2 border-dashed border-[#D1D5DB] dark:border-[#374151] flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 text-[#9CA3AF] dark:text-[#6B7280]" />
            </div>
            <p className="text-[10px] font-semibold text-[#9CA3AF] dark:text-[#6B7280] text-center">
              Drop leads here
            </p>
          </div>
        )}

        {/* Drop indicator */}
        {isOver && (
          <div
            className="flex items-center justify-center py-4 rounded-xl border-2 border-dashed"
            style={{ borderColor: config.color, background: `${config.color}10` }}
          >
            <p className="text-xs font-bold" style={{ color: config.color }}>Move to {config.label}</p>
          </div>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={onAddLead}
        className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#1F2937] text-[11px] font-bold text-[#9CA3AF] dark:text-[#6B7280] hover:border-[#22C55E]/50 hover:text-[#22C55E] hover:bg-[#22C55E]/5 transition-all"
      >
        <Plus className="w-3 h-3" /> Add lead
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LeadsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewLeadId = searchParams.get("view");
  const { toast } = useToast();

  const {
    leads,
    isLoading,
    loadError,
    reload,
    filteredLeads,
    addLead,
    updateLead,
    moveLeadToStage,
    deleteLead,
    bulkDelete,
    importLeads,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortConfig,
    setSortConfig,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    stageCounts,
  } = useLeads();

  const { addNotification } = useNotificationsContext();

  const [pipeline, setPipeline] = useState<PipelineItem[]>(DEFAULT_PIPELINE);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("whatsflow_leads_pipeline");
    if (stored) {
      try {
        setPipeline(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to load custom pipeline:", e);
      }
    }
  }, []);

  const STAGE_FILTERS = [
    { key: "all", label: "All" },
    ...pipeline.map((p) => ({ key: p.stage.toLowerCase(), label: p.config.label })),
  ];

  const [viewMode, setViewMode] = useState<"board" | "table">("table");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<any>("New");
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [viewLead, setViewLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // Drag state
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  useEffect(() => {
    if (viewLeadId) {
      const lead = leads.find(l => l.id === viewLeadId);
      if (lead) setViewLead(lead);
      router.replace("/dashboard/leads", { scroll: false });
    }
  }, [viewLeadId, leads, router]);

  useEffect(() => { setPage(0); }, [searchQuery, activeFilter]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleAddLead(data: LeadFormData) {
    try {
      const newLead = await addLead({ ...data, stage: defaultStage });
      addNotification({
        type: "new_lead",
        title: "New lead received",
        body: `${newLead.name} added for ${newLead.service}`,
        time: new Date().toISOString(),
        read: false,
        actionLeadId: newLead.id,
      });
      toast("Lead added successfully ✓", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add lead", "error");
      throw e;
    }
  }

  async function handleUpdateLead(id: string, data: LeadFormData) {
    try {
      await updateLead(id, data);
      toast("Lead updated successfully ✓", "success");
      if (viewLead?.id === id) {
        setViewLead(prev => {
          if (!prev) return null;
          return {
            ...prev,
            ...data,
            email: data.email.trim() || undefined,
            urgency: data.urgency as Lead["urgency"],
            assignedTo: data.assignedTo.trim() || undefined,
            notes: data.notes.trim() || undefined,
          };
        });
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update lead", "error");
      throw e;
    }
  }

  async function handleDeleteLead() {
    if (!deletingLead) return;
    try {
      await deleteLead(deletingLead.id);
      if (viewLead?.id === deletingLead.id) setViewLead(null);
      setDeletingLead(null);
      toast("Lead deleted", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete lead", "error");
    }
  }

  async function handleBulkDelete() {
    try {
      await bulkDelete([...Array.from(selectedIds)]);
      setBulkDeleteOpen(false);
      toast(`${selectedIds.size} leads removed`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk delete failed", "error");
    }
  }

  function handleSavePipeline(newPipeline: PipelineItem[]) {
    setPipeline(newPipeline);
    localStorage.setItem("whatsflow_leads_pipeline", JSON.stringify(newPipeline));
    toast("Pipeline updated successfully ✓", "success");
  }

  function handleSort(key: keyof Lead) {
    setSortConfig({ key, direction: sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc" });
  }

  function handleExportCSV() {
    if (filteredLeads.length === 0) { toast("No leads to export", "error"); return; }
    setIsExporting(true);
    setTimeout(() => {
      const headers = ["Name", "Phone", "Email", "Service", "Urgency", "Stage", "Source", "Created At"];
      const rows = filteredLeads.map(l => [l.name, l.phone, l.email || "-", l.service, l.urgency, l.stage, l.source, new Date(l.createdAt).toLocaleDateString()]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `leads_${Date.now()}.csv`, style: "display:none" });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setIsExporting(false);
      toast(`${filteredLeads.length} leads exported`, "success");
    }, 800);
  }



  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, lead: Lead) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("leadId", lead.id);
    setDraggingLead(lead);
  }

  function handleDragOver(e: React.DragEvent, stage: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverStage !== stage) setDragOverStage(stage);
  }

  function handleDragLeave(stage: string) {
    if (dragOverStage === stage) setDragOverStage(null);
  }

  async function handleDrop(e: React.DragEvent, targetStage: any) {
    e.preventDefault();
    const leadId = e.dataTransfer.getData("leadId");
    if (leadId && draggingLead?.stage?.toLowerCase() !== targetStage.toLowerCase()) {
      try {
        await moveLeadToStage(leadId, targetStage);
        toast(`Moved to ${targetStage}`, "success");
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not update stage", "error");
      }
    }
    setDraggingLead(null);
    setDragOverStage(null);
  }

  // ── Computed ─────────────────────────────────────────────────────────────────

  const boardLeads = searchQuery.trim()
    ? leads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.phone.includes(searchQuery) || l.service.toLowerCase().includes(searchQuery.toLowerCase()))
    : leads;

  const leadsPerStage = (stage: any) => boardLeads.filter(l => l.stage?.toLowerCase() === stage.toLowerCase());

  const totalValue = leads.length;
  const wonCount = leads.filter(l => l.stage?.toLowerCase() === "booked").length;
  const convRate = totalValue > 0 ? Math.round((wonCount / totalValue) * 100) : 0;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-red-800 dark:text-red-200">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" className="shrink-0 border-red-300" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      )}
      <PageHeading
        title="Leads Management"
        count={leads.length}
        description="Track and manage your WhatsApp leads in real-time"
        rightContent={
          <>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={isExporting}
              className="h-10 text-[#22C55E] border-[#E5E7EB] dark:border-[#1F2937] hover:bg-green-50 dark:hover:bg-[#22C55E]/10 font-bold rounded-xl bg-white dark:bg-[#111827]"
            >
              {isExporting ? <div className="w-4 h-4 border-2 border-[#22C55E]/30 border-t-[#22C55E] rounded-full animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
              Export
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-10 text-blue-600 border-[#E5E7EB] dark:border-[#1F2937] hover:bg-blue-50 dark:hover:bg-blue-900/10 font-bold rounded-xl bg-white dark:bg-[#111827]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              onClick={() => setCustomizeOpen(true)}
              className="h-10 text-slate-700 dark:text-slate-200 border-[#E5E7EB] dark:border-[#1F2937] hover:bg-slate-50 dark:hover:bg-[#1F2937] font-bold rounded-xl bg-white dark:bg-[#111827]"
            >
              <Settings2 className="w-4 h-4 mr-2 text-slate-500" />
              Customize Pipeline
            </Button>
            <Button
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white h-10 px-5 font-bold rounded-xl shadow-md shadow-[#22C55E]/20"
              onClick={() => { setDefaultStage("New"); setAddOpen(true); }}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Lead
            </Button>
          </>
        }
      />

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: leads.length, color: "#3B82F6", bg: "#EFF6FF" },
          { label: "In Progress", value: leads.filter(l => !["booked","lost"].includes(l.stage?.toLowerCase())).length, color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Booked", value: wonCount, color: "#22C55E", bg: "#F0FDF4" },
          { label: "Conversion", value: `${convRate}%`, color: "#8B5CF6", bg: "#F5F3FF" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
              <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
            </div>
            <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] pointer-events-none" />
          <Input
            placeholder="Search leads…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-sm"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl p-1 gap-1 shrink-0">
          <button
            onClick={() => setViewMode("board")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewMode === "board"
                ? "bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] shadow-sm"
                : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
            )}
          >
            <Columns3 className="w-3.5 h-3.5" /> Board
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              viewMode === "table"
                ? "bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] shadow-sm"
                : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
            )}
          >
            <LayoutList className="w-3.5 h-3.5" /> Table
          </button>
        </div>

        {/* Stage filter pill — table mode only */}
        {viewMode === "table" && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {STAGE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl whitespace-nowrap transition-all border shrink-0",
                  activeFilter === f.key
                    ? "bg-[#22C55E] text-white border-[#22C55E] shadow-md"
                    : "bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] hover:border-[#22C55E]"
                )}
              >
                {f.label}
                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md", activeFilter === f.key ? "bg-white/20" : "bg-[#22C55E]/10 text-[#22C55E]")}>
                  {f.key === "all" ? leads.length : stageCounts[f.key] || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── BOARD VIEW ── */}
      {viewMode === "board" && (
        <div
          className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1"
          onDragEnd={() => { setDraggingLead(null); setDragOverStage(null); }}
        >
          {pipeline.map(({ stage, config }) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              config={config}
              leads={leadsPerStage(stage)}
              dragOverStage={dragOverStage}
              onDragOver={e => handleDragOver(e, stage)}
              onDragLeave={() => handleDragLeave(stage)}
              onDrop={e => handleDrop(e, stage)}
              onView={setViewLead}
              onEdit={setEditLead}
              onDelete={setDeletingLead}
              onDragStart={handleDragStart}
              onAddLead={() => { setDefaultStage(stage); setAddOpen(true); }}
            />
          ))}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <LeadsTable
          leads={filteredLeads}
          page={page}
          setPage={setPage}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          selectAll={selectAll}
          clearSelection={clearSelection}
          sortConfig={sortConfig}
          onSort={handleSort}
          onView={setViewLead}
          onEdit={setEditLead}
          onDelete={setDeletingLead}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          onClearFilters={() => { setSearchQuery(""); setActiveFilter("all"); }}
          onAddLead={() => { setDefaultStage("New"); setAddOpen(true); }}
        />
      )}

      {/* ── Modals ── */}
      <ManageStatusesModal
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        pipeline={pipeline}
        onSave={handleSavePipeline}
      />
      <AddLeadModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAddLead}
        defaultStage={defaultStage}
        stages={pipeline.map((p) => p.stage)}
      />
      <ImportLeadsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (newLeads) => {
          const ok = await importLeads(newLeads);
          if (ok === newLeads.length) {
            toast(`Successfully imported ${ok} leads ✓`, "success");
          } else if (ok > 0) {
            toast(`Imported ${ok} of ${newLeads.length} (some rows failed validation)`, "error");
          } else {
            toast("Import failed — check phone numbers and required fields", "error");
          }
        }}
      />
      <EditLeadModal
        open={!!editLead}
        lead={editLead}
        onClose={() => setEditLead(null)}
        onSave={handleUpdateLead}
        stages={pipeline.map((p) => p.stage)}
      />
      <ViewLeadDrawer
        lead={viewLead} open={!!viewLead} onClose={() => setViewLead(null)}
        onEdit={l => { setViewLead(null); setEditLead(l); }}
        onDelete={l => { setViewLead(null); setDeletingLead(l); }}
      />
      <DeleteLeadDialog
        open={!!deletingLead && !bulkDeleteOpen} leadName={deletingLead?.name ?? null}
        onClose={() => setDeletingLead(null)} onConfirm={handleDeleteLead}
      />
      <DeleteLeadDialog
        open={bulkDeleteOpen} leadName={null} leadCount={selectedIds.size}
        onClose={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete}
      />
    </div>
  );
}
