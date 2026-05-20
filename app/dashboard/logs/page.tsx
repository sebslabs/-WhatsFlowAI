"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Filter, RefreshCw, Calendar, Database, Eye, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeading } from "@/components/dashboard/PageHeading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api-config";
import { cn } from "@/lib/utils";

export default function APILogsPage() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  
  // Filters
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const limit = 15;

  useEffect(() => {
    fetchLogs();
  }, [page, methodFilter, statusFilter]); // Note: debouncing search manually for perf

  async function fetchLogs() {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: (page * limit).toString(),
      });
      if (methodFilter !== "all") params.append("method", methodFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery) params.append("query", searchQuery);

      const data = await apiFetch(`/api/logs?${params.toString()}`);
      setLogs(data.logs || []);
      setTotalCount(data.pagination.total || 0);
    } catch (error) {
      console.error("Error loading logs", error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchLogs();
  };

  const getMethodColor = (method: string) => {
    const m = method.toUpperCase();
    if (m === 'GET') return "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800";
    if (m === 'POST') return "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-800";
    if (m === 'PUT' || m === 'PATCH') return "bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-100 dark:border-yellow-800";
    if (m === 'DELETE') return "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-800";
    return "bg-gray-50 text-gray-600 border-gray-100";
  };

  const getStatusColor = (code: number) => {
    if (!code) return "bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800/40";
    if (code >= 200 && code < 300) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800";
    if (code >= 400) return "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400 border-rose-100 dark:border-rose-800";
    return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400 border-amber-100 dark:border-amber-800";
  };

  return (
    <div className="space-y-6">
      <PageHeading
        title="Cloud System Logs"
        description="Complete real-time auditable trace of all inbound/outbound API synchronization events."
      />

      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm flex flex-col md:flex-row items-center gap-4">
        <form onSubmit={handleSearch} className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          <Input
            placeholder="Search by endpoint pattern..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
          />
        </form>
        
        <div className="flex gap-3 w-full md:w-auto">
          <Select value={methodFilter} onValueChange={(val) => { setMethodFilter(val); setPage(0); }}>
            <SelectTrigger className="w-[120px] h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verbs</SelectItem>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Codes</SelectItem>
              <SelectItem value="success">Success (2xx)</SelectItem>
              <SelectItem value="error">Errors (4xx/5xx)</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={fetchLogs} variant="outline" className="h-11 w-11 p-0 rounded-xl shrink-0 border-[#E5E7EB] dark:border-[#1F2937]">
            <RefreshCw className={cn("w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A]/50">
                <th className="text-left px-6 py-4 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Timestamp</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Method</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Endpoint</th>
                <th className="text-left px-6 py-4 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Status</th>
                <th className="text-right px-6 py-4 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Payloads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <Loader2 className="w-6 h-6 text-[#22C55E] animate-spin mx-auto mb-3" />
                    <p className="text-xs font-medium text-gray-400">Querying analytical data store...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-20">
                    <Database className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">No analytical logs captured.</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1">Adjust filter parameters or refresh.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => (
                  <motion.tr 
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                      {new Date(log.created_at).toLocaleString('en-US', { hour12: false })}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn("font-bold text-[10px] tracking-wider border uppercase", getMethodColor(log.method))}>
                        {log.method}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] truncate max-w-[300px] font-mono">
                        {log.endpoint}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className={cn("font-bold text-[11px] rounded-md border", getStatusColor(log.status_code))}>
                        {log.status_code || '??'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-[#22C55E] hover:bg-[#22C55E]/10 gap-2 h-8 rounded-lg text-xs font-bold">
                        <Eye className="w-3.5 h-3.5" /> Inspect
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between bg-[#F9FAFB] dark:bg-[#0B0F1A]/30">
          <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
            Showing <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{logs.length}</span> of <span className="font-bold text-[#111827] dark:text-[#F9FAFB]">{totalCount}</span> historical traces
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] disabled:opacity-30"
              disabled={page === 0 || loading}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] disabled:opacity-30"
              disabled={(page + 1) * limit >= totalCount || loading}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Inspect Modal */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-3xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-0 gap-0 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {selectedLog && (
            <>
              <DialogHeader className="p-6 border-b border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn("text-xs font-black", getMethodColor(selectedLog.method))}>{selectedLog.method}</Badge>
                    <DialogTitle className="font-mono text-sm text-[#111827] dark:text-[#F9FAFB] tracking-tight break-all pr-6">{selectedLog.endpoint}</DialogTitle>
                  </div>
                  <Badge variant="outline" className={cn("text-xs font-bold", getStatusColor(selectedLog.status_code))}>HTTP {selectedLog.status_code}</Badge>
                </div>
                <DialogDescription className="text-[11px] mt-2 font-mono text-[#6B7280] dark:text-[#9CA3AF]">
                  Trace Identifier: {selectedLog.id} • {new Date(selectedLog.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="p-6 grid md:grid-cols-2 gap-6 overflow-y-auto scrollbar-hide flex-1">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Request Payload</Label>
                  <div className="bg-[#0B0F1A] text-emerald-400 p-4 rounded-xl border border-[#1F2937] font-mono text-xs overflow-auto max-h-[400px] shadow-inner">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedLog.request_body, null, 2) || "{} // No Body"}</pre>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#6B7280] dark:text-[#9CA3AF]">Server Response</Label>
                  <div className="bg-[#0B0F1A] text-blue-400 p-4 rounded-xl border border-[#1F2937] font-mono text-xs overflow-auto max-h-[400px] shadow-inner">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(selectedLog.response_body, null, 2) || "{} // Empty Response"}</pre>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#1F2937] flex gap-6 text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                <div>IP Address: <span className="text-[#111827] dark:text-[#F9FAFB] font-bold">{selectedLog.ip_address || 'N/A'}</span></div>
                <div className="truncate">User Agent: <span className="text-[#111827] dark:text-[#F9FAFB] font-bold">{selectedLog.user_agent || 'N/A'}</span></div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
