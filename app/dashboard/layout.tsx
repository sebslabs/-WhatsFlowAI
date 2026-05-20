"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { WhatsAppNotificationListener } from "@/components/dashboard/WhatsAppNotificationListener";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { ThemeProvider } from "@/components/theme-provider";
import {
  LayoutDashboard,
  Users,
  Settings,
  Megaphone,
  Workflow,
  MessageSquare,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import Link from "next/link";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
  { label: "Chats", href: "/dashboard/conversations", icon: MessageSquare },
  { label: "Automation", href: "/dashboard/automation", icon: Workflow },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Megaphone },
  { label: "Templates", href: "/dashboard/templates", icon: MessageSquare },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB] transition-colors duration-300">
      <Sidebar />
      <MobileSidebar />
      <TopBar />

      <main
        className={cn(
          "transition-all duration-300 ease-in-out pt-14",
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="p-4 sm:p-6 pb-24 lg:pb-6"
        >
          <Breadcrumbs />
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#111827] border-t border-[#E5E7EB] dark:border-[#1F2937] z-40">
        <div className="flex items-center justify-around">
          {mobileNavItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 px-2 flex-1",
                  isActive ? "text-[#16A34A]" : "text-[#6B7B6B]"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced server-side by middleware.ts via Supabase JWT validation.
  // The middleware redirects unauthenticated users to /auth/login before this
  // component is ever rendered. No client-side auth check is needed here.
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <SidebarProvider>
        <NotificationsProvider>
          <WhatsAppNotificationListener />
          <DashboardShell>{children}</DashboardShell>
        </NotificationsProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}
