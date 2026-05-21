"use client";

import { useState, useEffect } from "react";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  LifeBuoy,
  Loader2
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = "open" | "in-progress" | "resolved";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high";
  createdAt: string;
}

// Removed DEFAULT_TICKETS

export default function SupportPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    priority: "medium" as const
  });

  useEffect(() => {
    async function loadTickets() {
      try {
        const data = await apiFetch('/api/tickets');
        if (data && data.length > 0) {
          setTickets(data);
        } else {
          setTickets([]);
        }
      } catch (err) {
        setTickets([]);
      } finally {
        setLoading(false);
      }
    }
    loadTickets();
  }, []);

  const handleRaiseTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast("Please fill in all fields", "error");
      return;
    }

    try {
      const ticketData = {
        subject: newTicket.subject,
        description: newTicket.description,
        priority: newTicket.priority,
      };

      const savedTicket = await apiFetch('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(ticketData)
      });

      if (savedTicket && savedTicket.id) {
        setTickets([savedTicket, ...tickets]);
        setIsModalOpen(false);
        setNewTicket({ subject: "", description: "", priority: "medium" });
        toast("Support ticket raised successfully.", "success");
      } else {
        throw new Error("Invalid ticket response");
      }
    } catch (err) {
      console.error(err);
      toast("Failed to create ticket on the server.", "error");
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.subject.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] animate-pulse">Connecting to support center...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Help & Support"
        description="Raise a ticket or search our help center for common issues."
        rightContent={
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl shadow-md font-bold h-10 px-5 active:scale-95 transition-all">
                <Plus className="w-4 h-4 mr-2" />
                Raise a Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">Describe Your Issue</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of the issue"
                    className="rounded-xl h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="priority" className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Priority</Label>
                  <select
                    id="priority"
                    className="w-full h-11 px-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                  >
                    <option value="low">Low - General inquiry</option>
                    <option value="medium">Medium - Something's broken</option>
                    <option value="high">High - Urgent / Production issue</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Please provide as much detail as possible..."
                    className="rounded-xl min-h-[110px] bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-xs p-3 font-medium leading-relaxed resize-none"
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl font-bold text-[#6B7280] dark:text-[#9CA3AF] h-11 px-5 flex-1">Cancel</Button>
                <Button onClick={handleRaiseTicket} className="bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl font-bold h-11 px-5 flex-1 shadow-md active:scale-95 transition-all">Submit Ticket</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className="w-12 h-12 bg-[#22C55E]/10 rounded-xl flex items-center justify-center text-[#22C55E] mb-4">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB]">Knowledge Base</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-1 mb-4">Search documentation for instant answers.</p>
          <Button variant="outline" className="w-full rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-transparent text-[#111827] dark:text-[#F9FAFB] hover:bg-[#22C55E]/10 dark:hover:bg-[#22C55E]/20 hover:text-[#22C55E] dark:hover:text-[#22C55E] font-bold text-xs h-9">View Docs</Button>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 rounded-xl flex items-center justify-center text-blue-500 mb-4">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB]">Live Chat</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-1 mb-4">Chat with our experts on WhatsApp.</p>
          <Button variant="outline" className="w-full rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-transparent text-[#111827] dark:text-[#F9FAFB] hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-500 dark:hover:text-blue-400 font-bold text-xs h-9">Start WhatsApp Chat</Button>
        </div>
        <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/10 rounded-xl flex items-center justify-center text-purple-500 mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB]">System Status</h3>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium mt-1 mb-4">All clusters are currently operational.</p>
          <div className="w-full py-2 bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl text-green-500 text-[10px] font-bold uppercase tracking-wider">All Systems Operational</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl overflow-hidden shadow-sm transition-colors duration-300">
        <div className="px-6 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
          <h2 className="font-bold text-[#111827] dark:text-[#F9FAFB]">My Support Tickets</h2>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tickets..."
              className="pl-9 h-10 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#6B7280] dark:text-[#9CA3AF] text-[10px] font-bold uppercase tracking-wider border-b border-[#E5E7EB] dark:border-[#1F2937]">
                <th className="px-6 py-3.5">Ticket ID</th>
                <th className="px-6 py-3.5">Subject</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Priority</th>
                <th className="px-6 py-3.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
              {filteredTickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors cursor-pointer group">
                  <td className="px-6 py-4">
                    <span className="font-bold text-[#111827] dark:text-[#F9FAFB] text-sm">{ticket.id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-bold text-[#111827] dark:text-[#F9FAFB] text-sm group-hover:text-[#22C55E] transition-colors">{ticket.subject}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 line-clamp-1">{ticket.description}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                      ticket.status === 'resolved' ? 'bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/10' :
                      ticket.status === 'in-progress' ? 'bg-blue-50 dark:bg-blue-900/10 text-blue-500 border border-blue-500/10' :
                      'bg-amber-50 dark:bg-amber-900/10 text-amber-500 border border-amber-500/10'
                    }`}>
                      {ticket.status === 'resolved' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {ticket.status}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[11px] font-bold ${
                      ticket.priority === 'high' ? 'text-red-500' :
                      ticket.priority === 'medium' ? 'text-amber-500' :
                      'text-[#6B7280] dark:text-[#9CA3AF]'
                    }`}>
                      {ticket.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
