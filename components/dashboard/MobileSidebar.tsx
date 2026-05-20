"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSidebar } from "@/context/SidebarContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  MessageCircle,
  Zap,
  BarChart3,
  Settings,
  BookOpen,
  MessageSquare,
  ArrowUpRight,
  LogOut
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "Conversations", href: "/dashboard/conversations", icon: MessageCircle },
  { label: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen },
  { label: "Automation", href: "/dashboard/automation", icon: Zap },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function MobileSidebar() {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; name?: string } | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || "User",
        });
      }
    }
    if (isMobileOpen) {
      fetchUser();
    }
  }, [isMobileOpen]);

  const handleLogout = async () => {
    try {
      setIsMobileOpen(false);
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error during logout:", err);
    } finally {
      localStorage.removeItem("isLoggedIn");
      window.location.href = "/";
    }
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || "?";

  return (
    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
      <SheetContent side="left" className="p-0 border-none w-72 flex flex-col h-full bg-white">
        <SheetHeader className="px-6 py-5 border-b border-[#E2EDE2] text-left">
          <SheetTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#16A34A] rounded-full flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#0F1F0F] text-base tracking-tight">
                WhatsFlow
              </span>
              <span className="bg-[#16A34A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                AI
              </span>
            </div>
          </SheetTitle>
        </SheetHeader>

        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all transition-colors",
                  isActive
                    ? "bg-[#DCFCE7] text-[#15803D]"
                    : "text-[#6B7B6B] hover:bg-[#F8FAF8] hover:text-[#0F1F0F]"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0",
                  isActive ? "text-[#16A34A]" : "text-[#6B7B6B]"
                )} />
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="activeNavMobile"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-[#16A34A]"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 pb-10 space-y-4 border-t border-[#E2EDE2] pt-6">
          <div className="bg-[#F0F7F0] rounded-2xl p-4">
            <p className="text-xs font-bold text-[#0F1F0F] mb-1">
              Starter Plan
            </p>
            <p className="text-[11px] text-[#6B7B6B] mb-3 leading-relaxed">
              Upgrade to unlock advanced AI features and automation.
            </p>
            <Button
              size="sm"
              className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white h-9 text-xs font-bold shadow-sm"
            >
              Upgrade Now
              <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>

          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-[#16A34A] flex items-center justify-center shrink-0 shadow-sm border-2 border-white">
              <span className="text-white text-sm font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#0F1F0F] truncate">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-[#6B7B6B] truncate">
                {user?.email || ""}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-md text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/40 dark:hover:bg-red-800/50 hover:text-red-600 transition-all shrink-0 flex items-center justify-center"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
