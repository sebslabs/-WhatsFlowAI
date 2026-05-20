"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  FileText,
  HelpCircle,
  Type,
  Image as ImageIcon,
  FileUp,
  Search,
  MoreVertical,
  Trash2,
  Clock,
  Database,
  CheckCircle2,
  AlertCircle,
  Zap,
  LayoutGrid,
  List,
  Eye,
  Loader2,
  Globe
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { createClient } from "@/lib/supabase/client";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type KnowledgeType = "pdf" | "faq" | "text" | "image" | "url";

interface KnowledgeSource {
  id: string;
  title: string;
  description: string;
  content: string;
  type: KnowledgeType;
  status: "synced" | "syncing" | "error";
  size?: string;
  itemCount?: number;
  sourceUrl?: string;
}

export default function KnowledgeBasePage() {
  const { toast } = useToast();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<KnowledgeType | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deletingSource, setDeletingSource] = useState<KnowledgeSource | null>(null);
  const [viewingSource, setViewingSource] = useState<KnowledgeSource | null>(null);

  async function loadSources() {
    try {
      const data = await apiFetch('/api/knowledge');
      setSources(data || []);
    } catch (err) {
      console.error("Failed to load knowledge sources:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSource(id: string) {
    try {
      await apiFetch(`/api/knowledge?id=${id}`, { method: "DELETE" });
      setSources(prev => prev.filter(s => s.id !== id));
      toast("Knowledge source removed", "success");
    } catch (err) {
      console.error("Failed to delete source:", err);
      toast("Failed to delete source", "error");
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  const filteredSources = sources.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || s.type === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Syncing knowledge base...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Knowledge Base"
        count={sources.length}
        description="Train your AI on your specific business data. Upload documents, FAQs, and business details to improve accuracy."
        rightContent={
          <Button
            onClick={() => setAddOpen(true)}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white h-10 px-6 font-bold rounded-xl shadow-md active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add New Source
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Trained Assets" value={sources.length.toString()} icon={<Database className="w-4 h-4" />} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-900/10" />
        <StatCard label="Last Training" value="Live" icon={<Clock className="w-4 h-4" />} color="text-purple-500" bg="bg-purple-50 dark:bg-purple-900/10" />
        <StatCard label="AI Accuracy" value="100%" icon={<CheckCircle2 className="w-4 h-4" />} color="text-green-500" bg="bg-green-50 dark:bg-green-900/10" />
        <StatCard label="Monthly Tokens" value="0" icon={<Zap className="w-4 h-4" />} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-900/10" />
      </div>

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-2">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          <Input
            placeholder="Search documents, questions, or labels..."
            className="pl-11 h-11 bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full overflow-x-auto">
          <TabsList className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] h-11 p-1 rounded-xl w-full flex justify-start overflow-x-auto scrollbar-hide">
            <TabsTrigger value="all" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] shrink-0 text-[#6B7280] dark:text-[#9CA3AF]">All Assets</TabsTrigger>
            <TabsTrigger value="pdf" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] shrink-0 text-[#6B7280] dark:text-[#9CA3AF]">PDF Docs</TabsTrigger>
            <TabsTrigger value="faq" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] shrink-0 text-[#6B7280] dark:text-[#9CA3AF]">FAQs</TabsTrigger>
            <TabsTrigger value="text" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] shrink-0 text-[#6B7280] dark:text-[#9CA3AF]">Text</TabsTrigger>
            <TabsTrigger value="image" className="rounded-xl px-5 text-xs font-bold data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] shrink-0 text-[#6B7280] dark:text-[#9CA3AF]">Images</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-1 rounded-xl shrink-0">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === "grid" ? "bg-[#22C55E]/10 text-[#22C55E] shadow-sm" : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
            )}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 rounded-xl transition-all",
              viewMode === "list" ? "bg-[#22C55E]/10 text-[#22C55E] shadow-sm" : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
            )}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {filteredSources.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredSources.map((source) => (
              <KnowledgeCard 
                key={source.id} 
                source={source} 
                onAdd={() => setAddOpen(true)} 
                onDelete={() => setDeletingSource(source)}
                onView={() => setViewingSource(source)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#1F2937]">
                    <th className="px-6 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider w-1/3">Source Asset</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Size/Items</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
                  {filteredSources.map((source) => (
                    <KnowledgeListItem 
                      key={source.id} 
                      source={source} 
                      onAdd={() => setAddOpen(true)} 
                      onDelete={() => setDeletingSource(source)}
                      onView={() => setViewingSource(source)}
                    />                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6 transition-colors duration-300">
          <div className="w-16 h-16 rounded-2xl bg-[#F9FAFB] dark:bg-[#0B0F1A] flex items-center justify-center mb-4">
            <Database className="w-8 h-8 text-[#6B7280] dark:text-[#9CA3AF]" />
          </div>
          <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">No assets found</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium max-w-sm">Try searching for something else or add a new training asset.</p>
          <Button
            variant="outline"
            onClick={() => { setSearchQuery(""); setActiveTab("all"); }}
            className="mt-6 h-10 px-5 font-bold rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]"
          >
            Clear Search & Filters
          </Button>
        </div>
      )}

      <AddKnowledgeModal 
        open={addOpen} 
        onClose={() => setAddOpen(false)}
        onSuccess={loadSources}
      />

      {deletingSource && (
        <ConfirmDeleteDialog
          open={!!deletingSource}
          onOpenChange={(open) => !open && setDeletingSource(null)}
          title={`Delete Knowledge Source "${deletingSource.title}"?`}
          description="This will permanently delete this knowledge asset. The AI agent will no longer have access to this information during conversations."
          onConfirm={async () => {
            await handleDeleteSource(deletingSource.id);
            setDeletingSource(null);
          }}
          trigger={<span className="hidden" />}
        />
      )}

      <ViewKnowledgeModal
        open={!!viewingSource}
        source={viewingSource}
        onClose={() => setViewingSource(null)}
      />
    </div>
  );
}

function StatCard({ label, value, icon, color, bg }: { label: string; value: string; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm flex items-center gap-4 transition-colors duration-300">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">{label}</p>
        <p className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">{value}</p>
      </div>
    </div>
  );
}

function KnowledgeCard({ source, onAdd, onDelete, onView }: { source: KnowledgeSource; onAdd: () => void; onDelete: () => void; onView: () => void }) {
  const typeIcons: Record<KnowledgeType, { icon: any; color: string; bg: string }> = {
    pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10" },
    faq: { icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10" },
    text: { icon: Type, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/10" },
    image: { icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10" },
    url: { icon: Globe, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/10" },
  };

  const { icon: Icon, color, bg } = typeIcons[source.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-5 hover:border-[#22C55E]/30 shadow-sm transition-all duration-300 group hover:shadow-md"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", bg, color)}>
          <Icon className="w-6 h-6" />
        </div>
        <button 
          onClick={onDelete}
          className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-red-500 p-1 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB] mb-1 truncate group-hover:text-[#22C55E] transition-colors">{source.title}</h3>
      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium leading-relaxed line-clamp-2 min-h-[2.5rem]">{source.description}</p>

      <div className="mt-4 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {source.status === "synced" ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/10 px-2.5 py-0.5 rounded-xl">
              <CheckCircle2 className="w-3 h-3" /> SYNCED
            </span>
          ) : source.status === "syncing" ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 px-2.5 py-0.5 rounded-xl inline-flex">
              <div className="w-2.5 h-2.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> SYNCING
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/10 px-2.5 py-0.5 rounded-xl">
              <AlertCircle className="w-3 h-3" /> ERROR
            </span>
          )}
          <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">
            {source.size || (source.itemCount !== undefined ? `${source.itemCount} items` : "Processed")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onView}
            className="text-[#22C55E] hover:bg-[#22C55E]/10 p-1.5 rounded-xl transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onAdd}
            className="text-[#22C55E] hover:bg-[#22C55E]/10 p-1.5 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function KnowledgeListItem({ source, onAdd, onDelete, onView }: { source: KnowledgeSource; onAdd: () => void; onDelete: () => void; onView: () => void }) {
  const typeIcons: Record<KnowledgeType, { icon: any; color: string; bg: string }> = {
    pdf: { icon: FileText, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10" },
    faq: { icon: HelpCircle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10" },
    text: { icon: Type, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/10" },
    image: { icon: ImageIcon, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10" },
    url: { icon: Globe, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/10" },
  };

  const { icon: Icon, color, bg } = typeIcons[source.type];

  return (
    <tr className="group hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors">
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", bg, color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[#111827] dark:text-[#F9FAFB] truncate group-hover:text-[#22C55E] transition-colors">{source.title}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate max-w-[240px]">{source.description}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] px-2 py-0.5 rounded-xl uppercase tracking-wider">
          {source.type}
        </span>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">
          {source.size || (source.itemCount !== undefined ? `${source.itemCount} items` : "Processed")}
        </span>
      </td>
      <td className="px-6 py-4">
        {source.status === "synced" ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-[#22C55E] transition-all">
            <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" /> SYNCED
          </span>
        ) : source.status === "syncing" ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" /> SYNCING
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-red-600">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600" /> ERROR
          </span>
        )}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex items-center justify-end gap-1">
          <button 
            onClick={onView}
            className="p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] rounded-xl transition-all"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={onAdd}
            className="p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button 
            onClick={onDelete}
            className="p-2 text-[#6B7280] dark:text-[#9CA3AF] hover:text-red-500 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function AddKnowledgeModal({ open, onClose, onSuccess }: { open: boolean; onClose?: () => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<KnowledgeType | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form States
  const [sourceName, setSourceName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  
  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Website Scraper States
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [websiteLabel, setWebsiteLabel] = useState("");
  const [scrapingStatus, setScrapingStatus] = useState<string>("idle");
  const [scrapingProgress, setScrapingProgress] = useState(0);
  const [scrapingError, setScrapingError] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const types = [
    { id: "pdf", title: "Upload PDF", desc: "Product manuals, Docs, eBooks", icon: FileUp, color: "bg-red-50 dark:bg-red-900/10 text-red-500" },
    { id: "faq", title: "Add FAQs", desc: "Common Q&A pairs for quick info", icon: HelpCircle, color: "bg-amber-50 dark:bg-amber-900/10 text-amber-500" },
    { id: "text", title: "Raw Text", desc: "Company bio, services list, etc.", icon: Type, color: "bg-blue-50 dark:bg-blue-900/10 text-blue-500" },
    { id: "image", title: "Add Images", desc: "Menus, flowcharts, visual guides", icon: ImageIcon, color: "bg-purple-50 dark:bg-purple-900/10 text-purple-500" },
    { id: "url", title: "Scrape Website", desc: "Ingest content from a URL dynamically", icon: Globe, color: "bg-green-50 dark:bg-green-900/10 text-green-500" },
  ];

  // Poll scraping progress every 1.5 seconds when a job is active
  useEffect(() => {
    if (!activeJobId || scrapingStatus === "completed" || scrapingStatus === "failed") return;

    const interval = setInterval(async () => {
      try {
        const data = await apiFetch(`/api/scrape/status/${activeJobId}`);
        if (data) {
          setScrapingStatus(data.status);
          setScrapingProgress(data.progress);
          
          if (data.status === "completed") {
            setSaving(false);
            setActiveJobId(null);
            toast("Website successfully scraped and trained! ✓", "success");
            onSuccess();
            handleClose();
          } else if (data.status === "failed") {
            setSaving(false);
            setActiveJobId(null);
            setScrapingError(data.error_message || "Website scraping failed.");
            toast(data.error_message || "Scraping failed.", "error");
          }
        }
      } catch (err: any) {
        console.error("Error polling scrape status:", err);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeJobId, scrapingStatus]);

  const handleClose = () => {
    setSourceName("");
    setTextContent("");
    setFaqQuestion("");
    setFaqAnswer("");
    setFile(null);
    setWebsiteUrl("");
    setWebsiteLabel("");
    setScrapingStatus("idle");
    setScrapingProgress(0);
    setScrapingError("");
    setActiveJobId(null);
    setSelectedType(null);
    onClose?.();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast("File size exceeds the 10MB upload limit", "error");
      return;
    }
    if (selectedType === "pdf" && selectedFile.type !== "application/pdf") {
      toast("Please upload a valid PDF document", "error");
      return;
    }
    if (selectedType === "image" && !selectedFile.type.startsWith("image/")) {
      toast("Please upload a valid image file", "error");
      return;
    }
    setFile(selectedFile);
  };

  async function handleScrapeSubmit() {
    if (!websiteUrl.trim()) {
      toast("Please enter a target website URL", "error");
      return;
    }

    try {
      new URL(websiteUrl); // Basic client side parser validation
    } catch {
      toast("Please enter a valid URL (including http:// or https://)", "error");
      return;
    }

    setSaving(true);
    setScrapingStatus("queued");
    setScrapingProgress(5);
    setScrapingError("");

    try {
      const res = await apiFetch("/api/scrape", {
        method: "POST",
        body: JSON.stringify({
          url: websiteUrl.trim(),
          label: websiteLabel.trim() || undefined,
        }),
      });

      if (res && res.jobId) {
        setActiveJobId(res.jobId);
        setScrapingStatus(res.status || "queued");
        toast("Scraping background task started!", "success");
      } else {
        throw new Error("Invalid response received from scraping service.");
      }
    } catch (err: any) {
      setSaving(false);
      setScrapingStatus("idle");
      setScrapingProgress(0);
      setScrapingError(err.message || "Failed to start scraping.");
      toast(err.message || "Failed to trigger scrape operation.", "error");
    }
  }

  async function handleSubmit() {
    if (!selectedType) return;
    if (selectedType === "url") {
      await handleScrapeSubmit();
      return;
    }
    
    setSaving(true);
    try {
      let title = sourceName.trim();
      let content = "";
      let source_url = "";

      // File upload branch (PDF & Images)
      if (selectedType === "pdf" || selectedType === "image") {
        if (!file) {
          toast("Please choose a file to upload", "error");
          setSaving(false);
          return;
        }

        // Initialize client-side Supabase client
        const supabase = createClient();

        // 1. Get logged in user's tenant ID
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("No active credentials or session found. Please log in.");
        }

        // Retrieve tenant_id from members mapping
        const { data: memberData } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('profile_id', user.id)
          .limit(1)
          .single();

        const tenantId = memberData?.tenant_id ?? 'global';

        // 2. Upload file to the 'knowledge-base' bucket
        const fileKey = `${tenantId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('knowledge-base')
          .upload(fileKey, file, { contentType: file.type, cacheControl: '3600' });

        if (uploadError) {
          throw new Error(`Supabase upload failed: ${uploadError.message}`);
        }

        // 3. Retrieve the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('knowledge-base')
          .getPublicUrl(fileKey);

        source_url = publicUrl;
        title = file.name;
        content = `Document type: ${file.type}\nFile Name: ${file.name}\nSize: ${Math.round(file.size / 1024)} KB\nSource URL: ${publicUrl}`;
      } else if (selectedType === "text") {
        content = textContent.trim();
        if (!title) title = "Raw Text Source";
      } else if (selectedType === "faq") {
        if (!faqQuestion.trim() || !faqAnswer.trim()) {
          toast("Both Question and Answer are required", "error");
          setSaving(false);
          return;
        }
        title = faqQuestion.trim();
        content = `Q: ${faqQuestion.trim()}\nA: ${faqAnswer.trim()}`;
      }

      if (!content) {
        toast("Content cannot be empty", "error");
        setSaving(false);
        return;
      }

      // Save database asset row via Next.js api Fetch
      await apiFetch('/api/knowledge', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          source_type: selectedType,
          source_url: source_url || undefined,
          metadata: {
            original_type: selectedType,
            ...(selectedType === 'faq' ? { question: faqQuestion.trim(), answer: faqAnswer.trim() } : {}),
            ...(file ? { file_name: file.name, file_size: file.size, mime_type: file.type } : {})
          }
        })
      });

      toast("Asset successfully uploaded and trained! ✓", "success");
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast(err?.message || "Failed to save knowledge item", "error");
    } finally {
      setSaving(false);
    }
  }

  // Helper description of the active scraping stage
  const getScrapeProgressMessage = () => {
    switch (scrapingStatus) {
      case "queued": return "Queueing website scraping task...";
      case "scraping": return "Initializing browser, downloading HTML code...";
      case "processing": return "Cleaning HTML clutter, parsing semantic text blocks...";
      case "embedding": return `Calculating AI vector matrices (${scrapingProgress}%)...`;
      case "completed": return "Website successfully ingested and vectorized!";
      case "failed": return `Scraping failed: ${scrapingError}`;
      default: return "Scraping...";
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !saving && handleClose()}>
      <DialogContent className="sm:max-w-[580px] p-0 overflow-hidden bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">Add Knowledge Source</DialogTitle>
          <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF] font-medium leading-relaxed">
            Choose a source type to train your AI on your business data.
          </DialogDescription>
        </DialogHeader>

        {!selectedType ? (
          <div className="p-6 grid grid-cols-2 gap-4">
            {types.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id as any)}
                className="flex flex-col items-center text-center p-6 bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#22C55E]/40 hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-all duration-300 group"
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105 duration-300", t.color)}>
                  <t.icon className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-[#111827] dark:text-[#F9FAFB] mb-0.5 text-sm">{t.title}</h4>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium leading-relaxed">{t.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-6 space-y-4 animate-in fade-in duration-300">
            <button
              disabled={saving}
              onClick={() => { setSelectedType(null); setFile(null); }}
              className="text-xs font-bold text-[#22C55E] flex items-center gap-1 hover:underline mb-1 disabled:opacity-50"
            >
              ← Back to sources
            </button>

            <div className="space-y-4">
              {/* WEBSITE SCRAPER MODULE */}
              {selectedType === "url" && (
                <div className="space-y-4">
                  {scrapingStatus === "idle" ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Website URL Address</label>
                        <Input 
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://example.com/about" 
                          disabled={saving}
                          className="rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Custom Source Label (Optional)</label>
                        <Input 
                          value={websiteLabel}
                          onChange={(e) => setWebsiteLabel(e.target.value)}
                          placeholder="e.g. Ingested Main Services page" 
                          disabled={saving}
                          className="rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]" 
                        />
                      </div>
                    </>
                  ) : (
                    <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider">
                          Scraping Task State: <span className="text-[#22C55E]">{scrapingStatus}</span>
                        </span>
                        {scrapingStatus !== "completed" && scrapingStatus !== "failed" && (
                          <Loader2 className="w-4 h-4 text-[#22C55E] animate-spin" />
                        )}
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                        <div 
                          className="bg-[#22C55E] h-2.5 rounded-full transition-all duration-500 ease-out" 
                          style={{ width: `${scrapingProgress}%` }}
                        />
                      </div>

                      <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                        {getScrapeProgressMessage()}
                      </p>

                      {scrapingStatus === "failed" && (
                        <Button 
                          onClick={() => setScrapingStatus("idle")}
                          className="w-full mt-2 bg-red-50 dark:bg-red-950/10 text-red-500 border border-red-200 hover:bg-red-100 rounded-xl"
                        >
                          Retry New Website Scrape
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedType === "text" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Source Name</label>
                  <Input 
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    placeholder="e.g. Product Pricing 2026" 
                    disabled={saving}
                    className="rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]" 
                  />
                </div>
              )}

              {(selectedType === "pdf" || selectedType === "image") && (
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                    {selectedType === "pdf" ? "Upload PDF Document" : "Upload Visual Asset"}
                  </label>
                  
                  {!file ? (
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200",
                        dragActive 
                          ? "border-[#22C55E] bg-[#22C55E]/5" 
                          : "border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:bg-[#F3F4F6] dark:hover:bg-[#111827]/40"
                      )}
                      onClick={() => document.getElementById("file-upload-input")?.click()}
                    >
                      <input
                        type="file"
                        id="file-upload-input"
                        className="hidden"
                        accept={selectedType === "pdf" ? ".pdf" : "image/*"}
                        onChange={handleFileChange}
                      />
                      <FileUp className="w-10 h-10 text-[#6B7280] dark:text-[#9CA3AF] mb-3" />
                      <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">
                        Drag and drop your file here, or <span className="text-[#22C55E] hover:underline">browse</span>
                      </p>
                      <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-semibold">
                        {selectedType === "pdf" ? "Supports PDF files up to 25MB" : "Supports PNG, JPEG, WEBP up to 10MB"}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-[#22C55E]/30 bg-[#22C55E]/5 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#111827] shadow-sm flex items-center justify-center text-xl shrink-0">
                          {selectedType === "pdf" ? "📄" : "🖼️"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] truncate leading-tight">{file.name}</p>
                          <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-bold mt-0.5">{Math.round(file.size / 1024)} KB</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setFile(null)}
                        className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-xl transition-all active:scale-95"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {selectedType === "text" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Content</label>
                  <textarea
                    rows={5}
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Paste or type your information here..."
                    disabled={saving}
                    className="w-full rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all resize-none font-medium leading-relaxed"
                  />
                </div>
              )}

              {selectedType === "faq" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Question</label>
                    <Input 
                      value={faqQuestion}
                      onChange={(e) => setFaqQuestion(e.target.value)}
                      placeholder="e.g. What are your opening hours?" 
                      disabled={saving}
                      className="rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]" 
                  />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Answer</label>
                    <textarea
                      rows={3}
                      value={faqAnswer}
                      onChange={(e) => setFaqAnswer(e.target.value)}
                      placeholder="Enter the automated response for this question..."
                      disabled={saving}
                      className="w-full rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] p-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 transition-all resize-none font-medium leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937] mt-2">
              <Button variant="ghost" disabled={saving} onClick={handleClose} className="text-[#6B7280] dark:text-[#9CA3AF] font-bold">Cancel</Button>
              <Button
                disabled={saving || ((selectedType === "pdf" || selectedType === "image") && !file) || (selectedType === "url" && !websiteUrl.trim())}
                onClick={handleSubmit}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-6 font-bold rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedType === "url" ? "Scraping..." : "Syncing..."}
                  </div>
                ) : (
                  selectedType === "url" ? "Scrape URL" : "Confirm & Sync"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ViewKnowledgeModal({ open, source, onClose }: { open: boolean; source: KnowledgeSource | null; onClose: () => void }) {
  const [viewTab, setViewTab] = useState<'preview' | 'text'>('text');

  useEffect(() => {
    if (source) {
      setViewTab(source.sourceUrl ? 'preview' : 'text');
    }
  }, [source]);

  if (!source) return null;

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="sm:max-w-[620px] w-full p-0 flex flex-col h-full bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937] shrink-0">
          <div className="flex items-center justify-between gap-4 mt-4">
            <SheetTitle className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] truncate pr-4">
              {source.title}
            </SheetTitle>
            <span className="text-[10px] font-bold text-[#22C55E] bg-[#22C55E]/10 px-2.5 py-0.5 rounded-xl uppercase tracking-wider shrink-0">
              {source.type}
            </span>
          </div>
          <SheetDescription className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-1">
            Size: {source.size || "Processed"} | Status: Synced
          </SheetDescription>
        </SheetHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          
          {/* Tab Selector & Original File URL */}
          {source.sourceUrl && (
            <div className="flex items-center justify-between gap-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-3 shrink-0 shadow-sm">
              <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] dark:bg-[#161B22] rounded-xl">
                <button
                  onClick={() => setViewTab('preview')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    viewTab === 'preview'
                      ? "bg-[#22C55E] text-white shadow-sm"
                      : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
                  )}
                >
                  File Preview
                </button>
                <button
                  onClick={() => setViewTab('text')}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    viewTab === 'text'
                      ? "bg-[#22C55E] text-white shadow-sm"
                      : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
                  )}
                >
                  Trained Text
                </button>
              </div>

              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-[#22C55E] hover:text-[#16A34A] hover:underline flex items-center gap-1 transition-all mr-2"
              >
                Open Original ↗
              </a>
            </div>
          )}

          {/* Conditional View Rendering */}
          {viewTab === 'preview' && source.sourceUrl ? (
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                Document Preview (Live Reader)
              </label>
              {source.type === 'image' ? (
                <div className="w-full flex items-center justify-center bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl p-4 min-h-[300px] shadow-inner">
                  <img
                    src={source.sourceUrl}
                    alt={source.title}
                    className="max-w-full max-h-[480px] object-contain rounded-lg shadow-sm"
                  />
                </div>
              ) : (
                <iframe
                  src={source.sourceUrl}
                  className="w-full h-[520px] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-inner bg-white"
                  title={source.title}
                />
              )}
            </div>
          ) : (
            /* Text Content */
            <div className="space-y-2 animate-in fade-in duration-300">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                Extracted Training Content
              </label>
              <div className="w-full min-h-[220px] rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] p-5 text-sm font-medium leading-relaxed text-[#374151] dark:text-[#E5E7EB] whitespace-pre-wrap break-words shadow-inner">
                {source.content}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#E5E7EB] dark:border-[#1F2937] shrink-0 bg-white dark:bg-[#111827]">
          <Button
            onClick={onClose}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-6 font-bold rounded-xl shadow-md active:scale-95 transition-all"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

