"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Pencil,
  Trash2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  Download,
  Users,
  X,
  Plus,
  MessageSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadUrgencyBadge } from "./LeadUrgencyBadge";
import { timeAgo, cn } from "@/lib/utils";
import type { Lead, SortConfig } from "@/types/index";

const COLUMNS: { key: keyof Lead | "actions"; label: string; sortable?: boolean }[] = [
  { key: "name", label: "Avatar + Name", sortable: true },
  { key: "phone", label: "Phone" },
  { key: "service", label: "Service", sortable: true },
  { key: "urgency", label: "Urgency", sortable: true },
  { key: "stage", label: "Stage", sortable: true },
  { key: "source", label: "Source", sortable: true },
  { key: "lastActivity", label: "Last Activity", sortable: true },
  { key: "actions", label: "Actions" },
];

const PAGE_SIZE = 10;

interface Props {
  leads: Lead[];
  page: number;
  setPage: (p: number) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  sortConfig: SortConfig;
  onSort: (key: keyof Lead) => void;
  onView: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onBulkDelete: () => void;
  onClearFilters: () => void;
  onAddLead: () => void;
}

export function LeadsTable({
  leads,
  page,
  setPage,
  selectedIds,
  toggleSelect,
  selectAll,
  clearSelection,
  sortConfig,
  onSort,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onClearFilters,
  onAddLead,
}: Props) {
  const router = useRouter();
  const totalPages = Math.max(1, Math.ceil(leads.length / PAGE_SIZE));
  const paged = leads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allPageSelected =
    paged.length > 0 && paged.every((l) => selectedIds.has(l.id));
  const somePageSelected =
    paged.some((l) => selectedIds.has(l.id)) && !allPageSelected;

  function handleToggleAll() {
    if (allPageSelected) {
      const next = new Set(selectedIds);
      paged.forEach((l) => next.delete(l.id));
      selectAll(Array.from(next));
    } else {
      selectAll([...Array.from(selectedIds), ...paged.map((l) => l.id)]);
    }
  }

  function SortIcon({ colKey }: { colKey: keyof Lead }) {
    if (sortConfig.key !== colKey) return <ChevronsUpDown className="w-3 h-3 opacity-30 ml-1" />;
    return sortConfig.direction === "asc"
      ? <ChevronUp className="w-3 h-3 ml-1 text-[#16A34A]" />
      : <ChevronDown className="w-3 h-3 ml-1 text-[#16A34A]" />;
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden min-h-[400px] flex items-center justify-center transition-colors">
        <div className="flex flex-col items-center justify-center p-12 text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-6">
            <Users className="w-10 h-10 text-[#22C55E]" />
          </div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">No leads found</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-2 mb-8">
            Try adjusting your search or filters to see more results.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={onClearFilters} className="h-10 px-4 font-bold rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] bg-white dark:bg-[#111827]">
              Clear Filters
            </Button>
            <Button onClick={onAddLead} className="h-10 px-6 font-bold bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl shadow-md active:scale-95 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Add Lead
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="flex items-center justify-between bg-white dark:bg-[#111827] border border-[#22C55E]/30 rounded-xl px-5 py-3 shadow-lg shadow-[#22C55E]/5 ring-1 ring-[#22C55E]/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-[#22C55E]/20">
                {selectedIds.size}
              </div>
              <span className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">
                leads selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-[#6B7280] dark:text-[#9CA3AF] h-9 px-4 font-medium"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 text-[#111827] dark:text-[#F9FAFB] font-bold border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]"
              >
                <Download className="w-3.5 h-3.5 mr-2" />
                Export Selected
              </Button>
              <Button
                variant="default"
                size="sm"
                className="h-9 px-4 bg-red-500 hover:bg-red-600 text-white border-none font-bold shadow-sm shadow-red-500/10"
                onClick={onBulkDelete}
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete Selected
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#1F2937]">
                <th className="px-5 py-4 w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[#E5E7EB] dark:border-[#1F2937] accent-[#22C55E] cursor-pointer outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all bg-white dark:bg-[#111827]"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={handleToggleAll}
                  />
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-3 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap",
                      col.sortable && "cursor-pointer select-none hover:text-[#22C55E] transition-colors"
                    )}
                    onClick={() => col.sortable && col.key !== "actions" && onSort(col.key as keyof Lead)}
                  >
                    <div className="flex items-center">
                      {col.label}
                      {col.sortable && col.key !== "actions" && (
                        <SortIcon colKey={col.key as keyof Lead} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
              {paged.map((lead, i) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "group transition-all duration-150",
                    selectedIds.has(lead.id) ? "bg-[#22C55E]/10 dark:bg-[#22C55E]/15" : "hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]"
                  )}
                >
                  <td className="px-5 py-4">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[#E5E7EB] dark:border-[#1F2937] accent-[#22C55E] cursor-pointer outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all bg-white dark:bg-[#111827]"
                      checked={selectedIds.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                    />
                  </td>

                  {/* Avatar + Name */}
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm border-2 border-white dark:border-[#111827] !bg-[#22C55E]"
                        style={{ backgroundColor: "#22C55E" }}
                      >
                        <span className="text-white text-xs font-bold leading-none">
                          {(lead.name || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <button
                          onClick={() => onView(lead)}
                          className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] hover:text-[#22C55E] dark:hover:text-[#22C55E] transition-colors block truncate"
                        >
                          {lead.name}
                        </button>
                        <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">
                          {lead.createdAt ? `Added ${formatDateShort(lead.createdAt)}` : "New lead"}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="px-3 py-4 text-sm text-[#111827] dark:text-[#F9FAFB] font-medium whitespace-nowrap">
                    {lead.phone}
                  </td>

                  {/* Service */}
                  <td className="px-3 py-4 text-sm text-[#111827] dark:text-[#F9FAFB] whitespace-nowrap">
                    {lead.service}
                  </td>

                  {/* Urgency */}
                  <td className="px-3 py-4">
                    <LeadUrgencyBadge urgency={lead.urgency} />
                  </td>

                  {/* Stage */}
                  <td className="px-3 py-4">
                    <LeadStageBadge stage={lead.stage} />
                  </td>

                  {/* Source */}
                  <td className="px-3 py-4 text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                    {lead.source}
                  </td>

                  {/* Last Activity */}
                  <td className="px-3 py-4 text-sm text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                    {timeAgo(lead.lastActivity)}
                  </td>

                  {/* Actions — visible on row hover */}
                  <td className="px-3 py-4 text-right">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] dark:hover:text-[#22C55E] hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-all"
                        onClick={() => onView(lead)}
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6B7280] dark:text-[#9CA3AF] hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all"
                        onClick={() => router.push(`/dashboard/conversations?leadId=${lead.id}`)}
                        title="Open Chat"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6B7280] dark:text-[#9CA3AF] hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        onClick={() => onEdit(lead)}
                        title="Edit Lead"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-[#6B7280] dark:text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        onClick={() => onDelete(lead)}
                        title="Delete Lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#1F2937]">
          <span className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
            Showing <span className="text-[#111827] dark:text-[#F9FAFB]">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, leads.length)}</span> of <span className="text-[#111827] dark:text-[#F9FAFB]">{leads.length}</span> leads
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-8 px-3 text-xs font-bold border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-all disabled:opacity-30"
            >
              Prev
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={page === i ? "default" : "ghost"}
                  onClick={() => setPage(i)}
                  className={cn(
                    "h-8 w-8 p-0 text-xs font-bold transition-all",
                    page === i
                      ? "bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-sm ring-1 ring-[#22C55E]/20"
                      : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-white dark:hover:bg-[#111827]"
                  )}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="h-8 px-3 text-xs font-bold border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-all disabled:opacity-30"
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
