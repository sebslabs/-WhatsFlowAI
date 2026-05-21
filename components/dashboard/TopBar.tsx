"use client";

import { Search, Menu, User, Settings, QrCode, CheckCircle2, Loader2, AlertCircle, Sun, Moon } from "lucide-react";
import { NotificationDropdown } from "./NotificationDropdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  MessageSquare,
  Users,
  BarChart3,
  Calendar,
  Phone,
  Globe
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";


export function TopBar() {
  const { isCollapsed, toggleMobileMenu } = useSidebar();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [waConfig, setWaConfig] = useState<any>(null);
  const [qrSession, setQrSession] = useState<any>(null);
  const [subData, setSubData] = useState<any>(null);
  const [profile, setProfile] = useState<{ full_name?: string; personal_email?: string; avatar_url?: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    fetchWaConfig();
    fetchSubData();

    // Dynamically synchronize profile changes across layout components in real-time
    const handleProfileUpdate = () => {
      fetchSubData();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  async function fetchSubData() {
    try {
      const data = await apiFetch('/api/settings');
      if (data) {
        if (data.active_subscription) {
          setSubData(data.active_subscription);
        }
        setProfile({
          full_name: data.full_name,
          personal_email: data.personal_email,
          avatar_url: data.avatar_url,
        });
      }
    } catch (err) {
      console.error("TopBar subscription and settings check failed", err);
    }
  }

  async function fetchWaConfig() {
    try {
      const data = await apiFetch('/api/whatsapp/config');
      setWaConfig(data);
    } catch (err) {
      console.error("TopBar WhatsApp check failed", err);
    }

    try {
      const qrData = await apiFetch('/api/whatsapp/qr');
      if (Array.isArray(qrData)) {
        const activeQr = qrData.find((s: any) => s.status === 'connected');
        setQrSession(activeQr || null);
      }
    } catch (err) {
      console.error("TopBar WhatsApp QR check failed", err);
    }
  }

  useEffect(() => {
    setIsNavigating(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const searchResults = [
    { icon: MessageSquare, title: "Automations", description: "Manage your AI response flows", category: "Features", href: "/dashboard/automation" },
    { icon: Users, title: "Contacts", description: "View and manage your leads", category: "Management", href: "/dashboard/leads" },
    { icon: BarChart3, title: "Analytics", description: "Review performance metrics", category: "Reports", href: "/dashboard/analytics" },
    { icon: Calendar, title: "Campaigns", description: "Schedule broadcast messages", category: "Marketing", href: "/dashboard/campaigns" },
  ].filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const simulateConnect = async () => {
    setConnecting(true);
    await new Promise(r => setTimeout(r, 2000));
    setConnecting(false);
    setOpen(false);
    toast("WhatsApp connected successfully! ✓", "success");
  };

  const toggleTheme = () => {
    if (!mounted) return;
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header
      className={cn(
        "h-16 fixed top-0 right-0 left-0 bg-white/80 dark:bg-[#0B0F1A]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#1F2937] z-30 px-4 flex items-center justify-between transition-all duration-300 ease-in-out",
        isCollapsed ? "lg:left-20" : "lg:left-64"
      )}
    >
      {/* Left Section: Mobile Menu & Logo */}
      <div className="flex items-center justify-start gap-4 shrink-0">
        <div className="flex items-center lg:hidden">
          <button
            onClick={toggleMobileMenu}
            className="p-1 -ml-1 hover:bg-[#F9FAFB] dark:hover:bg-[#111827] rounded-md transition-colors"
          >
            <Menu className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
          </button>
          <span className="ml-3 font-bold text-[#22C55E] text-lg tracking-tight">WhatsFlow</span>
        </div>

        {waConfig?.status === 'connected' ? (
          <Button
            onClick={() => router.push('/dashboard/whatsapp')}
            className="bg-[#22C55E]/10 border border-[#22C55E]/25 hover:bg-[#22C55E]/20 text-[#22C55E] gap-2 rounded-xl h-9 px-3 hidden lg:flex font-bold text-[11px] shrink-0 shadow-sm active:scale-[0.98] transition-all items-center group"
            title="View Integrated WhatsApp Settings"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping absolute opacity-75" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] relative" />
            </div>
            <Phone className="w-3 h-3 opacity-80 group-hover:scale-110 transition-transform" />
            <span>
              {waConfig.display_phone_number || `WA: ...${waConfig.phone_number_id.slice(-4)}`}
            </span>
          </Button>
        ) : qrSession ? (
          <Button
            onClick={() => router.push('/dashboard/whatsapp')}
            className="bg-[#16A34A]/10 border border-[#16A34A]/25 hover:bg-[#16A34A]/20 text-[#16A34A] gap-2 rounded-xl h-9 px-3 hidden lg:flex font-bold text-[11px] shrink-0 shadow-sm active:scale-[0.98] transition-all items-center group"
            title="View QR-Connected WhatsApp Settings"
          >
            <div className="relative flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-ping absolute opacity-75" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A] relative" />
            </div>
            <QrCode className="w-4 h-4 text-[#16A34A] opacity-80 group-hover:scale-110 transition-transform" />
            <span>
              {qrSession.phone_number ? `QR: +${qrSession.phone_number}` : 'QR Connected'}
            </span>
          </Button>
        ) : (
          <Button
            onClick={() => router.push('/dashboard/whatsapp')}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white gap-2 rounded-xl h-9 px-4 shadow-lg shadow-green-500/15 transition-all active:scale-[0.98] hidden lg:flex font-semibold text-xs shrink-0 items-center"
          >
            <img 
              src="https://img.icons8.com/external-tanah-basah-glyph-tanah-basah/48/external-meta-social-media-tanah-basah-glyph-tanah-basah.png" 
              className="w-4 h-4 brightness-0 invert" 
              alt="Meta" 
            />
            Connect WhatsApp
          </Button>
        )}
      </div>

      {/* Center Section: Search Bar */}
      <div className="hidden md:flex flex-1 items-center justify-center px-4 max-w-md mx-auto">
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogTrigger asChild>
            <div className="w-full max-w-md flex items-center gap-2 text-[#6B7280] dark:text-[#9CA3AF] bg-[#F9FAFB] dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] px-4 py-2 rounded-xl hover:border-[#22C55E]/30 transition-all cursor-pointer group">
              <Search className="w-4 h-4 group-hover:text-[#22C55E] transition-colors" />
              <span className="text-sm font-medium">Quick Search (⌘K)</span>
            </div>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden border-none shadow-2xl rounded-2xl bg-white dark:bg-[#111827] [&>button]:hidden">
            <div className="flex items-center px-4 py-1 border-b border-gray-100 dark:border-[#1F2937] bg-white dark:bg-[#111827]">
              <Search className="w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search..."
                className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 outline-none text-sm h-12 bg-transparent placeholder:text-gray-400 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-gray-100 bg-gray-50/50 px-1.5 font-mono text-[9px] font-medium text-gray-400 opacity-100">
                <span className="text-[10px]">esc</span>
              </kbd>
            </div>

            <div className="p-1 max-h-[350px] overflow-y-auto scrollbar-hide relative min-h-[100px] bg-white dark:bg-[#111827]">
              <AnimatePresence>
                {isNavigating && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white/60 dark:bg-[#111827]/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full border-2 border-gray-100 border-t-[#22C55E] animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-[#22C55E] rounded-full animate-pulse" />
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-[#22C55E] uppercase tracking-widest animate-pulse">Loading Page...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {searchQuery.length > 0 ? (
                <div className="space-y-0.5">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, i) => (
                      <button
                        key={i}
                        className="w-full flex items-center gap-3 p-2 hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] rounded-lg transition-colors group text-left"
                        disabled={isNavigating}
                        onClick={() => {
                          setIsNavigating(true);
                          router.push(result.href);
                        }}
                      >
                        <div className="w-8 h-8 rounded-md bg-[#F9FAFB] dark:bg-[#0B0F1A] flex items-center justify-center text-[#6B7280] group-hover:text-[#22C55E] group-hover:bg-[#22C55E]/10 transition-colors">
                          <result.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB] truncate">{result.title}</h4>
                            <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">{result.category}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-10 text-center">
                      <p className="text-sm text-gray-500">No results for "{searchQuery}"</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-1 space-y-1">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-tight">Recent / Quick Actions</div>
                  {[
                    { icon: Plus, title: "Create New Flow", href: "/dashboard/automation" },
                    { icon: Users, title: "Add New Contact", href: "/dashboard/leads" },
                    { icon: MessageSquare, title: "WhatsApp Campaigns", href: "/dashboard/campaigns" },
                    { icon: BarChart3, title: "View Analytics", href: "/dashboard/analytics" },
                  ].map((action, i) => (
                    <button
                      key={i}
                      className="w-full flex items-center gap-3 p-2 hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] rounded-lg transition-colors group text-left"
                      disabled={isNavigating}
                      onClick={() => {
                        setIsNavigating(true);
                        router.push(action.href);
                      }}
                    >
                      <div className="w-8 h-8 rounded-md bg-[#F9FAFB] dark:bg-[#0B0F1A] flex items-center justify-center text-gray-500 group-hover:text-[#22C55E] group-hover:bg-green-50 transition-colors">
                        <action.icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-medium text-[#111827] dark:text-[#F9FAFB]">{action.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-gray-50 dark:border-[#1F2937] bg-gray-50/50 dark:bg-[#0B0F1A]/50 flex items-center justify-between">
              <p className="text-[10px] text-gray-400">Search powered by <span className="font-semibold text-[#22C55E]">WhatsFlow AI</span></p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Right Section: Actions + Theme Toggle Switch */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-3 shrink-0">
        {/* Real-time subscription, trial days remaining and AI conversation progress bar */}
        {subData && (
          <div className="hidden lg:flex items-center gap-3 bg-gray-50 dark:bg-[#111827] px-3 py-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] text-xs">
            {subData.subscription_status === 'trial' && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-lg border border-amber-500/25 animate-pulse shrink-0">
                <AlertCircle className="w-3 h-3" />
                <span>{subData.trial_days_remaining ?? 7}d Trial Left</span>
              </div>
            )}
            {subData.subscription_status === 'grace_period' && (
              <div className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-lg border border-rose-500/25 animate-pulse shrink-0">
                <AlertCircle className="w-3 h-3" />
                <span>Grace: {subData.grace_days_remaining ?? 3}d Left</span>
              </div>
            )}
            {subData.subscription_status === 'expired' && (
              <div className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-lg border border-rose-500/25 shrink-0">
                <AlertCircle className="w-3 h-3" />
                <span>Trial Expired</span>
              </div>
            )}
            {subData.subscription_status === 'suspended' && (
              <div className="flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold px-2 py-0.5 rounded-lg border border-rose-500/25 shrink-0">
                <AlertCircle className="w-3 h-3" />
                <span>Suspended</span>
              </div>
            )}
            <div 
              className="flex flex-col gap-1 min-w-[130px] shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => router.push('/dashboard/settings?tab=billing')}
              title="View Billing Settings"
            >
              <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                <span>Active Leads</span>
                <span className={cn(
                  subData.ai_conversation_used / subData.ai_conversation_limit >= 0.8 ? "text-amber-500 font-extrabold" : "",
                  subData.ai_conversation_used >= subData.ai_conversation_limit ? "text-red-500 font-extrabold" : ""
                )}>
                  {subData.ai_conversation_used?.toLocaleString()} / {subData.ai_conversation_limit?.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    subData.ai_conversation_used / subData.ai_conversation_limit >= 1.0 ? "bg-red-500" :
                    subData.ai_conversation_used / subData.ai_conversation_limit >= 0.8 ? "bg-amber-500" : "bg-[#22C55E]"
                  )}
                  style={{ width: `${Math.min(100, ((subData.ai_conversation_used || 0) / (subData.ai_conversation_limit || 1500)) * 100)}%` }}
                />
              </div>
            </div>
            {(subData.ai_conversation_used / subData.ai_conversation_limit >= 0.8 || ['trial', 'grace_period', 'expired', 'suspended'].includes(subData.subscription_status)) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => router.push('/dashboard/settings?tab=billing')}
                className="text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 font-bold h-7 px-2 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg shrink-0 active:scale-[0.98] transition-all"
              >
                Upgrade
              </Button>
            )}
          </div>
        )}

        {/* 🌗 Premium Theme Toggle Switch */}
        <div className="relative flex items-center" title="Switch theme">
          <button
            onClick={toggleTheme}
            className="w-14 h-7 flex items-center bg-[#E5E7EB] dark:bg-[#111827] border border-[#D1D5DB] dark:border-[#1F2937] rounded-full p-0.5 relative transition-all duration-300 hover:border-[#22C55E] dark:hover:border-[#22C55E] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
          >
            <motion.div
              animate={{ x: mounted && theme === "dark" ? 28 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="w-[22px] h-[22px] flex items-center justify-center bg-white dark:bg-[#22C55E] rounded-full shadow-md transition-colors duration-300"
            >
              <AnimatePresence mode="wait" initial={false}>
                {mounted && theme === "dark" ? (
                  <motion.div
                    key="dark"
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Moon className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="light"
                    initial={{ opacity: 0, rotate: -45 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 45 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </button>
        </div>

        <NotificationDropdown />

        <div className="w-[1px] h-4 bg-[#E5E7EB] dark:bg-[#1F2937] mx-1" />

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-gray-100 dark:hover:bg-[#111827] rounded-full"
          onClick={() => router.push('/dashboard/settings')}
        >
          <Settings className="w-4 h-4" />
        </Button>

        <button
          onClick={() => router.push('/dashboard/settings?tab=profile')}
          className="flex items-center gap-2 p-1 hover:bg-gray-50 dark:hover:bg-[#111827] rounded-full transition-colors border border-transparent hover:border-[#E5E7EB] dark:hover:border-[#1F2937]"
        >
          <div className="w-8 h-8 rounded-full bg-[#22C55E] flex items-center justify-center text-white shadow-sm ring-2 ring-white dark:ring-[#111827] overflow-hidden">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name || "User"} className="w-full h-full object-cover" />
            ) : profile?.full_name ? (
              <span className="text-xs font-bold">
                {profile.full_name
                  .split(" ")
                  .map((n: any) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </span>
            ) : (
              <User className="w-4 h-4" />
            )}
          </div>
        </button>
      </div>
    </header>
  );
}
