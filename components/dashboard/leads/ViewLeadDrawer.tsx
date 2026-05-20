"use client";

import { useState, useEffect } from "react";
import { Copy, X, MessageSquare, Info, Activity, User, Phone, Mail, MousePointer2, Calendar, Clock, CheckCircle2, Zap, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LeadStageBadge } from "./LeadStageBadge";
import { LeadUrgencyBadge } from "./LeadUrgencyBadge";
import { useToast } from "@/hooks/use-toast";
import { cn, timeAgo, formatDate, formatTime } from "@/lib/utils";
import type { Lead } from "@/types/index";

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}

export function ViewLeadDrawer({ lead, open, onClose, onEdit, onDelete }: Props) {
  const { toast } = useToast();
  
  // Interactive Loading & Data States
  const [activeTab, setActiveTab] = useState("details");
  const [messages, setMessages] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // Fetch live logs dynamically whenever tab opens or changes
  useEffect(() => {
    if (!open || !lead) {
      // Reset tabs and states when drawer closes
      if (!open) setActiveTab("details");
      return;
    }

    if (activeTab === "conversation") {
      setLoadingMessages(true);
      fetch(`/api/leads/${lead.id}/conversation?page=1&pageSize=50`)
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.messages ?? []);
          setMessages(Array.isArray(list) ? list : []);
        })
        .catch(err => {
          console.error("Failed retrieving WhatsApp chat logs.", err);
          toast("Failed retrieving WhatsApp chat logs.", "error");
        })
        .finally(() => setLoadingMessages(false));
    }

    if (activeTab === "activity") {
      setLoadingActivities(true);
      fetch(`/api/leads/${lead.id}/activity`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setActivities(data);
          } else {
            setActivities([]);
          }
        })
        .catch(err => {
          console.error("Failed retrieving trace logging timelines.", err);
        })
        .finally(() => setLoadingActivities(false));
    }
  }, [open, lead, activeTab, toast]);

  if (!lead) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Phone copied to clipboard", "info");
  };

  // Helper to intelligently group messages by distinct days
  const groupedMessagesByDay = messages.reduce((groups: any, message: any) => {
    const date = new Date(message.timestamp).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  const getRelativeDayLabel = (dateStr: string) => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (dateStr === today) return "Today";
    if (dateStr === yesterday) return "Yesterday";
    return new Date(dateStr).toLocaleDateString("en-US", { month: 'long', day: 'numeric' });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] p-0 border-none shadow-2xl flex flex-col bg-white dark:bg-[#111827] text-[#0F1F0F] dark:text-[#F9FAFB]">
        {/* Header */}
        <div className="p-6 border-b border-[#F0F7F0] dark:border-[#1F2937] shrink-0 relative">
          <div className="flex flex-col items-center text-center mt-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-inner ring-4 ring-white dark:ring-[#1F2937] bg-[#22C55E]"
              style={{ backgroundColor: "#22C55E" }}
            >
              {(lead.name || "?").charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-bold text-[#0F1F0F] dark:text-[#F9FAFB] mt-3">{lead.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-[#6B7B6B] dark:text-[#9CA3AF]">
              <span className="text-sm font-medium">{lead.phone}</span>
              <button
                onClick={() => copyToClipboard(lead.phone)}
                className="p-1 hover:text-[#16A34A] transition-colors"
                title="Copy phone"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-3">
              <LeadStageBadge stage={lead.stage} className="text-[11px] px-3 py-1" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b border-[#F0F7F0] dark:border-[#1F2937]">
            <TabsList className="w-full bg-[#F8FAF8] dark:bg-[#0B0F1A] p-1 h-11 border border-[#E2EDE2] dark:border-[#1F2937]">
              <TabsTrigger value="details" className="flex-1 text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#111827] data-[state=active]:text-[#16A34A] data-[state=active]:shadow-sm">
                Details
              </TabsTrigger>
              <TabsTrigger value="conversation" className="flex-1 text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#111827] data-[state=active]:text-[#16A34A] data-[state=active]:shadow-sm">
                Conversation
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 text-xs font-semibold data-[state=active]:bg-white dark:data-[state=active]:bg-[#111827] data-[state=active]:text-[#16A34A] data-[state=active]:shadow-sm">
                Activity
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col">
            {/* Tab 1: Details */}
            <TabsContent value="details" className="m-0 space-y-8 data-[state=inactive]:hidden">
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2">
                  <User className="w-3.5 h-3.5" /> Contact Info
                </h3>
                <div className="grid grid-cols-1 gap-4 bg-[#F8FAF8] dark:bg-[#0B0F1A] p-4 rounded-xl border border-[#E2EDE2] dark:border-[#1F2937]">
                  <DetailItem label="Full Name" value={lead.name} />
                  <DetailItem
                    label="Phone"
                    value={lead.phone}
                    action={<button onClick={() => copyToClipboard(lead.phone)} className="ml-auto text-[#16A34A] hover:underline text-xs font-medium">Copy</button>}
                  />
                  <DetailItem label="Email" value={lead.email || "—"} />
                  <DetailItem label="Lead Source" value={lead.source} />
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-xs font-bold text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2">
                  <Info className="w-3.5 h-3.5" /> Lead Info
                </h3>
                <div className="grid grid-cols-1 gap-4 bg-[#F8FAF8] dark:bg-[#0B0F1A] p-4 rounded-xl border border-[#E2EDE2] dark:border-[#1F2937]">
                  <DetailItem label="Service" value={lead.service} />
                  <DetailItem label="Urgency" value={<LeadUrgencyBadge urgency={lead.urgency} />} />
                  <DetailItem label="Stage" value={<LeadStageBadge stage={lead.stage} />} />
                  <DetailItem label="Assigned To" value={lead.assignedTo || "Unassigned"} />
                  <DetailItem label="Created" value={formatDate(lead.createdAt)} />
                  <DetailItem label="Last Activity" value={timeAgo(lead.lastActivity)} />
                </div>
              </section>

              {lead.notes && (
                <section className="space-y-4">
                  <h3 className="text-xs font-bold text-[#6B7B6B] dark:text-[#9CA3AF] uppercase tracking-wider">Notes</h3>
                  <div className="bg-[#FFFBEB] dark:bg-[#1F1A05] p-4 rounded-xl border border-amber-100 dark:border-amber-900/30 text-sm text-[#92400E] dark:text-[#F59E0B] leading-relaxed italic">
                    "{lead.notes}"
                  </div>
                </section>
              )}
            </TabsContent>

            {/* Tab 2: Conversation */}
            <TabsContent value="conversation" className="m-0 flex-1 flex flex-col bg-[#F0F7F0]/30 dark:bg-green-900/5 rounded-xl border border-[#D1E1D1] dark:border-[#1F2937] overflow-hidden min-h-[300px] data-[state=inactive]:hidden">
              {loadingMessages ? (
                <div className="flex-1 flex items-center justify-center p-12">
                  <Loader2 className="w-7 h-7 animate-spin text-[#16A34A]" />
                </div>
              ) : Object.keys(groupedMessagesByDay).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#6B7B6B] dark:text-[#9CA3AF]">
                  <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No message logs found.</p>
                  <p className="text-[10px] opacity-70 mt-0.5 text-[#6B7B6B] dark:text-[#6B7280]">Logs initialize on first contact.</p>
                </div>
              ) : (
                <div className="flex-1 p-4 space-y-5 overflow-y-auto max-h-[400px]">
                  {Object.keys(groupedMessagesByDay).map((dayStr) => (
                    <div key={dayStr} className="space-y-4">
                      <div className="flex justify-center sticky top-0 z-10 py-1">
                        <span className="text-[10px] font-bold bg-[#DCFCE7] dark:bg-green-900/20 text-[#16A34A] px-3 py-0.5 rounded-full shadow-sm border border-[#16A34A]/10 dark:border-[#16A34A]/20">
                          {getRelativeDayLabel(dayStr)}
                        </span>
                      </div>
                      {groupedMessagesByDay[dayStr].map((msg: any) => (
                        <ChatBubble 
                          key={msg.id} 
                          side={msg.side} 
                          content={msg.content} 
                          time={formatTime(msg.timestamp)} 
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 bg-white dark:bg-[#111827] border-t border-[#D1E1D1] dark:border-[#1F2937] text-center shrink-0">
                <p className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF] font-medium flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3 text-[#16A34A] fill-[#16A34A]" />
                  Conversation managed by WhatsFlow AI
                </p>
              </div>
            </TabsContent>

            {/* Tab 3: Activity */}
            <TabsContent value="activity" className="m-0 px-2 flex-1 flex flex-col data-[state=inactive]:hidden">
              {loadingActivities ? (
                <div className="flex-1 flex items-center justify-center p-12">
                  <Loader2 className="w-7 h-7 animate-spin text-[#16A34A]" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 text-[#6B7B6B] dark:text-[#9CA3AF]">
                  <Activity className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs font-semibold">No activities recorded yet.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-[#E2EDE2] dark:border-[#1F2937] ml-3 pl-6 space-y-8 py-2 flex-1">
                  {activities.map((evt: any, i: number) => {
                    // If it's not the first event, show relative time or actual timestamp
                    const displayTime = i === 0 
                      ? formatDate(evt.timestamp, true)
                      : timeAgo(evt.timestamp);
                      
                    return (
                      <TimelineItem
                        key={evt.id}
                        dotColor={evt.dotColor}
                        title={evt.title}
                        time={i === 0 ? displayTime : `${displayTime}`}
                        icon={evt.icon === 'check' ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : undefined}
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-6 border-t border-[#F0F7F0] dark:border-[#1F2937] bg-[#F8FAF8] dark:bg-[#0B0F1A] grid grid-cols-2 gap-3 shrink-0">
          <Button variant="outline" className="text-[#6B7B6B] dark:text-[#9CA3AF] border-[#E2EDE2] dark:border-[#1F2937] font-semibold tracking-wide active:scale-95 transition-all" onClick={() => onEdit(lead)}>
            Edit Lead
          </Button>
          <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 font-semibold active:scale-95 transition-all" onClick={() => onDelete(lead)}>
            Delete Lead
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value, action }: { label: string; value: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[#6B7B6B] dark:text-[#9CA3AF] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[#0F1F0F] dark:text-[#F9FAFB]">{value}</span>
        {action}
      </div>
    </div>
  );
}

function ChatBubble({ side, content, time }: { side: "left" | "right"; content: string; time: string }) {
  return (
    <div className={cn("flex flex-col max-w-[85%] transition-all animate-in fade-in duration-300", side === "right" ? "ml-auto items-end" : "mr-auto items-start")}>
      <div className={cn("p-3 rounded-2xl text-sm shadow-sm border transition-colors", side === "right" ? "bg-[#DCFCE7] dark:bg-green-900/30 text-[#0F1F0F] dark:text-[#F9FAFB] border-[#BBF7D0] dark:border-[#16A34A]/20 rounded-tr-none" : "bg-white dark:bg-[#111827] text-[#0F1F0F] dark:text-[#F9FAFB] border-[#E2EDE2] dark:border-[#1F2937] rounded-tl-none")}>
        {content}
      </div>
      <span className="text-[10px] text-[#6B7B6B] dark:text-[#9CA3AF] font-medium mt-1 px-1">{time}</span>
    </div>
  );
}

function TimelineItem({ dotColor, title, time, icon }: { dotColor: string; title: string; time: string; icon?: React.ReactNode }) {
  return (
    <div className="relative animate-in slide-in-from-left-3 duration-300">
      <div className={cn("absolute -left-[31px] top-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white dark:border-[#111827] shadow-sm ring-2 ring-[#E2EDE2] dark:ring-[#1F2937]", dotColor)}>
        {icon}
      </div>
      <div className="bg-white dark:bg-[#0B0F1A] border border-[#F0F7F0] dark:border-[#1F2937] p-3 rounded-xl shadow-sm inline-block min-w-[200px]">
        <p className="text-xs font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">{title}</p>
        <p className="text-[10px] font-semibold text-[#6B7B6B] dark:text-[#9CA3AF] mt-0.5 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {time}
        </p>
      </div>
    </div>
  );
}
