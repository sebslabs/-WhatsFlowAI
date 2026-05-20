"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Clock, MessageSquare, CalendarCheck, Download, Calendar, FileSpreadsheet, ChevronDown, Loader2, Check, Filter, RotateCcw, SlidersHorizontal } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  DailyBarChart,
  ConversionByServiceChart,
  ResponseTimeChart,
  LeadFunnelChart,
} from "@/components/dashboard/ChartCard";
// Removed mockTopDays import
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const dateRanges = ["Last 7d", "Last 30d", "Last 90d", "Custom"];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [range, setRange] = useState("Last 30d");
  const [isExporting, setIsExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [dateRange, setDateRange] = useState({ start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
  const [isGenerating, setIsGenerating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState({
    type: "performance",
    format: "csv",
    service: "all",
    source: "all",
    granularity: "daily",
    includeMetrics: ["leads", "conversions", "revenue"]
  });

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const data = await apiFetch('/api/analytics');
        if (data) {
          setStats(data);
        } else {
          setStats(null);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
        setStats(null);
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const kpiStats = stats ? [
    {
      label: "Leads Received",
      value: stats.totalLeads,
      subLabel: "Total this period",
      trend: "up" as const,
      trendValue: "↑ Live",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      label: "Conversion Rate",
      value: stats.conversionRate,
      subLabel: "Leads → Booked",
      trend: "up" as const,
      trendValue: "↑ Live",
      icon: <TrendingUp className="w-4 h-4" />,
    },
    {
      label: "Avg Response Time",
      value: stats.avgResponseTime,
      subLabel: "AI first reply speed",
      trend: "up" as const,
      trendValue: "↑ Live",
      icon: <Clock className="w-4 h-4" />,
    },
    {
      label: "Appointments Booked",
      value: stats.bookedLeads,
      subLabel: "Confirmed bookings",
      trend: "up" as const,
      trendValue: "↑ Live",
      icon: <CalendarCheck className="w-4 h-4" />,
    },
  ] : [];

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const headers = ["Metric", "Value", "Period"];
      const data = [
        ["Total Leads", stats?.totalLeads || "1,240", `${dateRange.start} to ${dateRange.end}`],
        ["Conversions", stats?.bookedLeads || "304", `${dateRange.start} to ${dateRange.end}`],
        ["Conversion Rate", stats?.conversionRate || "24.5%", `${dateRange.start} to ${dateRange.end}`],
        ["Avg Response Time", stats?.avgResponseTime || "1.2s", `${dateRange.start} to ${dateRange.end}`],
      ];
      
      const csvContent = [headers, ...data].map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `whatsflow_${reportConfig.type}_report_${dateRange.start}_${dateRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsGenerating(false);
      setSheetOpen(false);
      toast("Custom report generated and downloaded! 🚀", "success");
    }, 2000);
  };

  const downloadCSV = () => {
    setIsExporting(true);
    setTimeout(() => {
      const headers = ["Day", "Leads", "Converted"];
      const rows = (stats?.dailyStats || []).map((d: any) => [d.day, d.leads, d.conversions]);
      const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `analytics_report_${range.toLowerCase().replace(" ", "_")}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExporting(false);
      toast("Analytics report exported successfully!", "success");
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Generating analytics report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeading
        title="Analytics & Reports"
        description="Monitor your WhatsApp automation health and generate deep-dive performance reports."
        rightContent={
          <div className="flex items-center gap-3">
             <div className="flex gap-1 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl p-1 shadow-sm">
                {dateRanges.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-xl transition-all",
                      range === r
                        ? "bg-[#22C55E] text-white shadow-sm"
                        : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]"
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              
              <Button
                onClick={() => setSheetOpen(true)}
                variant="outline"
                className="border-[#22C55E] text-[#22C55E] hover:text-[#22C55E] dark:hover:text-[#22C55E] hover:bg-[#22C55E]/10 h-10 px-4 font-bold rounded-xl transition-all"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Customize Report
              </Button>

              <Button
                onClick={downloadCSV}
                disabled={isExporting}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white h-10 px-4 font-bold rounded-xl shadow-md active:scale-95 transition-all"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Quick Export
                  </>
                )}
              </Button>
          </div>
        }
      />

      <div className="space-y-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {kpiStats.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} />
          ))}
        </div>

        {/* Row 2: Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <DailyBarChart data={stats?.dailyStats || []} />
          <ConversionByServiceChart data={stats?.serviceStats || []} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <ResponseTimeChart data={(stats?.dailyStats || []).map((d:any) => ({ ...d, responseTime: stats?.avgResponseTime ? parseFloat(stats.avgResponseTime) : 0.8 }))} />
          <LeadFunnelChart data={stats?.leadFunnel || []} />
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-[#111827] rounded-3xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden"
        >
          <div className="px-8 py-6 border-b border-[#E5E7EB] dark:border-[#1F2937]">
            <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB] text-lg">Top Performing Days</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">Detailed performance breakdown for the current period.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#1F2937]">
                  {["Day", "Leads", "Converted", "Rate", "Bookings"].map((h) => (
                    <th key={h} className="text-left text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] px-8 py-4 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
                {(stats?.dailyStats || []).map((row: any, i: number) => (
                  <tr key={row.day} className="hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors">
                    <td className="px-8 py-5 text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{row.day}</td>
                    <td className="px-8 py-5 text-sm font-medium">{row.leads}</td>
                    <td className="px-8 py-5 text-sm font-medium">{row.conversions}</td>
                    <td className="px-8 py-5"><span className="text-sm font-bold text-[#22C55E]">{row.leads > 0 ? Math.round((row.conversions/row.leads)*100) : 0}%</span></td>
                    <td className="px-8 py-5 text-sm font-medium">{row.conversions}</td>
                  </tr>
                ))}
                {(!stats?.dailyStats || stats?.dailyStats.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-sm text-gray-500">No daily metrics tracked yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Right Side Slider (Sheet) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[450px] p-0 border-none bg-white dark:bg-[#111827] shadow-2xl">
          <div className="flex flex-col h-full">
            <div className="bg-[#22C55E] p-8 text-white">
              <SheetHeader className="text-left">
                <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-sm">
                  <SlidersHorizontal className="w-6 h-6 text-white" />
                </div>
                <SheetTitle className="text-2xl font-bold text-white">Report Builder</SheetTitle>
                <SheetDescription className="text-white/80 font-medium">
                  Customize and generate your deep-dive performance analysis.
                </SheetDescription>
              </SheetHeader>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Date Range Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#22C55E]" />
                  <Label className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Analysis Period</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase ml-1">From</span>
                    <Input 
                      type="date" 
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] h-12 font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase ml-1">To</span>
                    <Input 
                      type="date" 
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] h-12 font-bold" 
                    />
                  </div>
                </div>
              </div>

              {/* Category Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-[#22C55E]" />
                  <Label className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Report Category</Label>
                </div>
                <Select value={reportConfig.type} onValueChange={(v) => setReportConfig(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] h-12 font-bold">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="performance">Performance Overview</SelectItem>
                    <SelectItem value="leads">Leads & Sources</SelectItem>
                    <SelectItem value="conversion">Conversion Funnel</SelectItem>
                    <SelectItem value="ai_efficiency">AI Response Efficiency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Filters */}
              <div className="space-y-4 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937]">
                <Label className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Advanced Filters</Label>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase ml-1">Service Department</span>
                    <Select value={reportConfig.service} onValueChange={(v) => setReportConfig(prev => ({ ...prev, service: v }))}>
                      <SelectTrigger className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] h-11 font-bold">
                        <SelectValue placeholder="All Services" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Services</SelectItem>
                        <SelectItem value="sales">Sales & Inquiry</SelectItem>
                        <SelectItem value="support">Customer Support</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-[#9CA3AF] uppercase ml-1">Data Granularity</span>
                    <div className="flex gap-1 p-1 bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937]">
                      {["daily", "weekly", "monthly"].map((g) => (
                        <button
                          key={g}
                          onClick={() => setReportConfig(prev => ({ ...prev, granularity: g }))}
                          className={cn(
                            "flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            reportConfig.granularity === g 
                              ? "bg-white dark:bg-[#111827] text-[#22C55E] shadow-sm" 
                              : "text-[#6B7280] dark:text-[#9CA3AF]"
                          )}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Checklist */}
              <div className="space-y-4 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937]">
                <Label className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">Include Metrics</Label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "leads", label: "Lead Counts" },
                    { id: "conversions", label: "Conversion Data" },
                    { id: "revenue", label: "Estimated Revenue" },
                    { id: "response_time", label: "Response Speeds" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        const current = reportConfig.includeMetrics;
                        const next = current.includes(m.id) ? current.filter(i => i !== m.id) : [...current, m.id];
                        setReportConfig(prev => ({ ...prev, includeMetrics: next }));
                      }}
                      className={cn(
                        "flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all",
                        reportConfig.includeMetrics.includes(m.id)
                          ? "bg-[#22C55E]/5 border-[#22C55E]/30 text-[#22C55E]"
                          : "bg-transparent border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280]"
                      )}
                    >
                      <span className="text-xs font-bold">{m.label}</span>
                      <div className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center",
                        reportConfig.includeMetrics.includes(m.id) ? "bg-[#22C55E] border-[#22C55E] text-white" : "border-[#D1D5DB]"
                      )}>
                        {reportConfig.includeMetrics.includes(m.id) && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter className="p-8 bg-[#F9FAFB] dark:bg-[#0B0F1A] border-t border-[#E5E7EB] dark:border-[#1F2937] sm:flex-col gap-3">
              <Button 
                onClick={handleGenerateReport} 
                disabled={isGenerating || reportConfig.includeMetrics.length === 0}
                className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white h-14 font-bold rounded-2xl shadow-xl shadow-green-500/20 active:scale-95 transition-all text-lg"
              >
                {isGenerating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <FileSpreadsheet className="w-5 h-5 mr-3" />
                    Generate & Download
                  </>
                )}
              </Button>
              <button 
                onClick={() => setReportConfig({
                  type: "performance",
                  format: "csv",
                  service: "all",
                  source: "all",
                  granularity: "daily",
                  includeMetrics: ["leads", "conversions", "revenue"]
                })}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-[#6B7280] hover:text-[#111827] transition-colors py-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Filters
              </button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
