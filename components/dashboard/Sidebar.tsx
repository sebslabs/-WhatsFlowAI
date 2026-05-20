"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LifeBuoy,
  LogOut,
  Megaphone,
  Workflow,
  Bot,
  ShoppingBag,
  Sliders,
} from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/context/SidebarContext";
import { createClient } from "@/lib/supabase/client";

const navCategories = [
  {
    category: "Main",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { label: "Leads", href: "/dashboard/leads", icon: Users },
      { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
    ],
  },
  {
    category: "AI & Automation",
    items: [
      { label: "AI Agents",      href: "/dashboard/ai-agents",    icon: Bot },
      { label: "Automation",     href: "/dashboard/automation",   icon: Workflow },
      { label: "Knowledge Base", href: "/dashboard/knowledge",    icon: BookOpen },
    ],
  },

  {
    category: "Marketing",
    items: [
      { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
      { label: "Templates", href: "/dashboard/templates", icon: MessageSquare },
      { label: "Catalog", href: "/dashboard/catalog", icon: ShoppingBag },
    ],
  },
  {
    category: "System",
    items: [
      { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
      { label: "WhatsApp API", href: "/dashboard/whatsapp", icon: WhatsAppIcon },
      { label: "API Logs", href: "/dashboard/logs", icon: BookOpen },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
      { label: "Support", href: "/dashboard/support", icon: LifeBuoy },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [user, setUser] = useState<{ email?: string; name?: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, avatar_url")
          .eq("id", authUser.id)
          .maybeSingle();

        setUser({
          email: authUser.email,
          name: profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || "User",
          avatarUrl: profile?.avatar_url || "",
        });
      }
    }
    fetchUser();

    // Dynamically synchronize profile updates in the Sidebar in real-time
    const handleProfileUpdate = () => {
      fetchUser();
    };
    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, []);

  const handleLogout = async () => {
    try {
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
    <aside
      className={cn(
        "hidden lg:flex fixed left-0 top-0 h-screen bg-white dark:bg-[#111827] border-r border-[#E5E7EB] dark:border-[#1F2937] flex-col z-40 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo Section */}
      <div className={cn(
        "flex items-center gap-2 px-4 h-16 border-b border-[#E5E7EB] dark:border-[#1F2937] relative shrink-0",
        isCollapsed ? "justify-center px-0" : "justify-start"
      )}>
        <div className="w-10 h-10 shrink-0 flex items-center justify-center">
          <img src="/logo-robot.png" alt="Logo" className="w-8 h-8 object-contain" />
        </div>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <span className="font-bold text-[#111827] dark:text-[#F9FAFB] text-base tracking-tight">
              WhatsFlow
            </span>
            <span className="bg-[#22C55E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
              AI
            </span>
          </motion.div>
        )}

        {/* Toggle Button */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#22C55E] hover:border-[#22C55E] shadow-sm z-50 transition-all duration-200 hover:scale-110 group/toggle"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 transition-transform group-hover/toggle:translate-x-0.5" />
          ) : (
            <ChevronLeft className="w-4 h-4 transition-transform group-hover/toggle:-translate-x-0.5" />
          )}
        </button>
      </div>

      {/* Nav Section */}
      <nav className={cn(
        "flex-1 px-3 py-4 space-y-4 scrollbar-hide",
        isCollapsed ? "overflow-visible" : "overflow-y-auto"
      )}>
        {navCategories.map((category) => (
          <div key={category.category} className="space-y-1">
            {!isCollapsed && (
              <p className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider px-3 mb-2 mt-2 select-none">
                {category.category}
              </p>
            )}
            {category.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all group relative",
                    isActive
                      ? "bg-[#22C55E]/10 text-[#22C55E] shadow-sm dark:bg-[#22C55E]/5 glow-accent"
                      : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827] dark:text-[#9CA3AF] dark:hover:bg-[#0B0F1A] dark:hover:text-[#F9FAFB]",
                    isCollapsed && "justify-center px-0"
                  )}
                >
                  <item.icon className={cn(
                    "w-5 h-5 shrink-0 transition-colors duration-200",
                    isActive ? "text-[#22C55E] drop-shadow-[0_0_8px_#22C55E80]" : "text-[#6B7280] dark:text-[#9CA3AF] group-hover:text-[#111827] dark:group-hover:text-[#F9FAFB]"
                  )} />

                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="truncate"
                    >
                      {item.label}
                    </motion.span>
                  )}

                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1.5 bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] text-[11px] font-bold rounded-lg shadow-xl border border-[#E5E7EB] dark:border-[#374151] opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-x-[-8px] group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 pointer-events-none flex items-center">
                      {/* Arrow */}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-white dark:border-r-[#1F2937]" />
                      {item.label}
                    </div>
                  )}

                  {/* Active Indicator (left thin bar) */}
                  {isActive && !isCollapsed && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 w-1 h-6 bg-[#22C55E] rounded-r-full"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Section */}
      <div className={cn(
        "px-3 pb-6 space-y-3 border-t border-[#E5E7EB] dark:border-[#1F2937] pt-4 shrink-0 bg-white dark:bg-[#111827]",
        isCollapsed && "px-0"
      )}>
        {/* User Profile */}
        <div className={cn(
          "flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors cursor-pointer group relative",
          isCollapsed && "justify-center px-0"
        )}>
          <div className="w-9 h-9 rounded-full bg-[#22C55E] flex items-center justify-center shrink-0 shadow-sm text-white font-bold overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name || "User"} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          {!isCollapsed && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate">
                  {user?.email || ""}
                </p>
              </motion.div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }}
                className="p-1.5 rounded-md text-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-900/40 dark:hover:bg-red-800/50 hover:text-red-600 transition-all z-50 pointer-events-auto opacity-100 flex items-center justify-center shrink-0"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>

            </>
          )}

          {isCollapsed && (
            <div className="absolute left-full bottom-2 ml-3 p-3 bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-x-[-8px] group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap z-50 border border-[#E5E7EB] dark:border-[#374151]">
              {/* Arrow */}
              <div className="absolute right-full bottom-5 border-4 border-transparent border-r-white dark:border-r-[#1F2937]" />
              <p className="text-xs font-bold">{user?.name || "User"}</p>
              <p className="text-[10px] opacity-70 mb-2">{user?.email || ""}</p>
              <div 
                onClick={handleLogout}
                className="pt-2 border-t border-[#E5E7EB] dark:border-[#374151] flex items-center gap-2 text-red-400 dark:text-red-500 cursor-pointer hover:text-red-300 dark:hover:text-red-600 transition-colors text-xs font-bold"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
