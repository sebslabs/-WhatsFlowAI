"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MessageSquare, CheckCircle2, MessagesSquare, CalendarCheck, Loader2 } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { LeadsTable } from "@/components/dashboard/LeadsTable";
import { LeadConversionsChart, LeadSourcesChart } from "@/components/dashboard/ChartCard";
import { apiFetch } from "@/lib/api-config";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/dashboard/PageHeading";
import Link from "next/link";
// Removed mock type import
type Conversation = {
  id: string;
  leadName?: string;
  lastMessage?: string;
  lastMessageTime: string;
  aiActive?: boolean;
};

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [convData, statsData, analyticsData] = await Promise.all([
          apiFetch('/api/conversations'),
          apiFetch('/api/stats'),
          apiFetch('/api/analytics').catch(() => null)
        ]);
        setConversations((convData || []).slice(0, 5));
        setStats(statsData);
        setAnalytics(analyticsData);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const [viewMode, setViewMode] = useState<"real-time" | "historical">("real-time");
  
  const statItems = [
    {
      label: "Total Leads",
      value: stats?.totalLeads || 0,
      subLabel: "Total contacts",
      trend: "up" as const,
      trendValue: "Live data",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      label: "Converted",
      value: stats?.bookedLeads || 0,
      subLabel: `${stats?.conversionRate || 0}% conversion rate`,
      trend: "up" as const,
      trendValue: "Booked leads",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    {
      label: "Active Chats",
      value: conversations.length,
      subLabel: "Recent activity",
      trend: "neutral" as const,
      trendValue: "AI handling",
      icon: <MessagesSquare className="w-4 h-4" />,
    },
    {
      label: "Booked Today",
      value: stats?.bookedLeads || 0,
      subLabel: "Appointments",
      trend: "up" as const,
      trendValue: "Check details",
      icon: <CalendarCheck className="w-4 h-4" />,
    },
  ];

  const statsToDisplay = viewMode === "real-time" ? statItems : [
    ...statItems.slice(0, 3),
    {
      label: "Total Booked",
      value: stats?.totalBooked || stats?.bookedLeads || 0,
      subLabel: "All time records",
      trend: "up" as const,
      trendValue: "Growing",
      icon: <CalendarCheck className="w-4 h-4" />,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] font-medium animate-pulse">Connecting to WhatsFlow AI backend...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeading
        title="Performance Overview"
        description="Monitor your WhatsApp automation health, lead conversion metrics, and active conversations in real-time."
        rightContent={
          <div className="flex items-center gap-2 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-1 rounded-xl shadow-sm transition-colors duration-300">
            <button 
              onClick={() => setViewMode("real-time")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "real-time" 
                  ? "bg-[#22C55E]/10 dark:bg-[#22C55E]/20 text-[#22C55E] shadow-sm" 
                  : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              )}
            >
              Real-time
            </button>
            <button 
              onClick={() => setViewMode("historical")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                viewMode === "historical" 
                  ? "bg-[#22C55E]/10 dark:bg-[#22C55E]/20 text-[#22C55E] shadow-sm" 
                  : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              )}
            >
              Historical
            </button>
          </div>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {statsToDisplay.map((stat, i) => (
          <StatCard key={stat.label} {...stat} index={i} />
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <LeadConversionsChart data={analytics?.dailyStats || []} />
        </div>
        <div>
          <LeadSourcesChart data={(analytics?.serviceStats || []).map((s: any) => ({ name: s.service, value: s.count }))} />
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Leads Table */}
        <div className="lg:col-span-2">
          <LeadsTable limit={5} showViewAll={true} />
        </div>

        {/* Active Conversations Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-[#111827] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm transition-colors duration-300"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
            <h3 className="font-semibold text-[#111827] dark:text-[#F9FAFB]">Active Chats</h3>
            <Link
              href="/dashboard/conversations"
              className="text-sm text-[#22C55E] font-medium hover:underline transition-colors"
            >
              View All →
            </Link>
          </div>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">No active conversations yet.</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href="/dashboard/conversations"
                  className="flex items-start gap-3 px-5 py-4 hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[#22C55E]/10 dark:bg-[#22C55E]/20 flex items-center justify-center">
                      <span className="text-[#22C55E] text-xs font-bold">
                        {conv.leadName?.split(" ").map((n: string) => n[0]).join("") || "?"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#111827]",
                        conv.aiActive ? "bg-[#22C55E]" : "bg-orange-400"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB] truncate">
                        {conv.leadName}
                      </span>
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] shrink-0 ml-2">
                        {timeAgo(conv.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate leading-relaxed">
                      {conv.lastMessage}
                    </p>
                    <p className="text-[10px] mt-0.5">
                      <span
                        className={cn(
                          "font-medium",
                          conv.aiActive ? "text-[#22C55E]" : "text-orange-500"
                        )}
                      >
                        {conv.aiActive ? "● AI Active" : "● Needs Attention"}
                      </span>
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
