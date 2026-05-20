"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { Lead, LeadFormData, LeadStage, SortConfig } from "@/types/index";
import {
  fetchLeadsList,
  createLeadApi,
  updateLeadApi,
  deleteLeadApi,
  bulkDeleteLeadsApi,
} from "@/lib/leads-client";

export interface UseLeadsReturn {
  leads: Lead[];
  isLoading: boolean;
  loadError: string | null;
  reload: () => Promise<void>;
  addLead: (data: LeadFormData) => Promise<Lead>;
  updateLead: (id: string, data: LeadFormData) => Promise<void>;
  moveLeadToStage: (id: string, stage: LeadStage) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  bulkDelete: (ids: string[]) => Promise<void>;
  importLeads: (leadsData: LeadFormData[]) => Promise<number>;
  filteredLeads: Lead[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  sortConfig: SortConfig;
  setSortConfig: (s: SortConfig) => void;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  stageCounts: Record<string, number>;
}

export function useLeads(): UseLeadsReturn {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "asc",
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const leadsRef = useRef<Lead[]>([]);
  leadsRef.current = leads;

  const reload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchLeadsList();
      setLeads(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load leads");
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addLead = useCallback(async (data: LeadFormData): Promise<Lead> => {
    const created = await createLeadApi(data);
    setLeads((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateLead = useCallback(async (id: string, data: LeadFormData): Promise<void> => {
    const updated = await updateLeadApi(id, data);
    setLeads((prev) => prev.map((lead) => (lead.id === id ? updated : lead)));
  }, []);

  const moveLeadToStage = useCallback(async (id: string, stage: LeadStage): Promise<void> => {
    const lead = leadsRef.current.find((l) => l.id === id);
    if (!lead) return;
    await updateLeadApi(id, {
      name: lead.name,
      phone: lead.phone,
      email: lead.email ?? "",
      service: lead.service,
      urgency: lead.urgency,
      source: lead.source,
      stage,
      assignedTo: lead.assignedTo ?? "",
      notes: lead.notes ?? "",
    });
    setLeads((prev) =>
      prev.map((l) =>
        l.id === id
          ? {
              ...l,
              stage,
              lastActivity: new Date().toISOString(),
            }
          : l
      )
    );
  }, []);

  const deleteLead = useCallback(async (id: string): Promise<void> => {
    await deleteLeadApi(id);
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const bulkDelete = useCallback(async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    await bulkDeleteLeadsApi(ids);
    const idSet = new Set(ids);
    setLeads((prev) => prev.filter((l) => !idSet.has(l.id)));
    setSelectedIds(new Set());
  }, []);

  const importLeads = useCallback(async (leadsData: LeadFormData[]): Promise<number> => {
    let ok = 0;
    for (const data of leadsData) {
      try {
        const row = await createLeadApi(data);
        setLeads((prev) => [row, ...prev]);
        ok++;
      } catch {
        // Continue other rows; caller can toast partial success
      }
    }
    return ok;
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: leads.length };
    leads.forEach((l) => {
      const key = l.stage.toLowerCase();
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          l.service.toLowerCase().includes(q) ||
          l.stage.toLowerCase().includes(q) ||
          (l.email?.toLowerCase().includes(q) ?? false)
      );
    }

    if (activeFilter !== "all") {
      result = result.filter(
        (l) => l.stage.toLowerCase() === activeFilter.toLowerCase()
      );
    }

    if (sortConfig.key) {
      const key = sortConfig.key;
      result.sort((a, b) => {
        const av = a[key] ?? "";
        const bv = b[key] ?? "";
        const cmp = String(av).localeCompare(String(bv));
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [leads, searchQuery, activeFilter, sortConfig]);

  return {
    leads,
    isLoading,
    loadError,
    reload,
    addLead,
    updateLead,
    moveLeadToStage,
    deleteLead,
    bulkDelete,
    importLeads,
    filteredLeads,
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
  };
}
