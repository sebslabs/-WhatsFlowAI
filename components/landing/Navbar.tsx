"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const navLinks = [
  { label: "Features", href: "/features" },
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "API Docs", href: "/docs/api" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/contact" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsAuthenticated(!!user);
      } catch {
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  const getHref = (href: string) => {
    if (href.startsWith("/#")) {
      return pathname === "/" ? href.substring(1) : href;
    }
    return href;
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-500 px-4 sm:px-6 lg:px-8 ${scrolled ? "py-4" : "py-6"
        }`}
    >
      <div
        className={`max-w-7xl mx-auto h-16 rounded-2xl transition-all duration-500 border ${scrolled
            ? "bg-white/80 backdrop-blur-xl border-white/20 shadow-[0_8px_32px_rgba(34,197,94,0.08)] px-6"
            : "bg-transparent border-transparent px-2"
          } flex items-center justify-between`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 shrink-0 relative transition-transform duration-500 group-hover:scale-110">
            <div className="absolute inset-0 bg-[#22c55e]/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
            <img
              src="/logo-robot.png"
              alt="WhatsFlow AI Logo"
              className="w-full h-full object-contain relative"
            />
          </div>
          <span className="font-black text-[#0f172a] text-xl lg:text-2xl tracking-tighter transition-colors group-hover:text-[#22c55e]">
            WhatsFlow<span className="text-[#22c55e]">AI</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={getHref(link.href)}
              className="px-4 py-2 text-sm font-semibold text-[#64748b] hover:text-[#0f172a] transition-all relative group"
            >
              {link.label}
              <span className="absolute bottom-1.5 left-4 right-4 h-0.5 bg-[#22c55e] scale-x-0 group-hover:scale-x-100 transition-transform origin-center" />
            </Link>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-2">
          {isAuthenticated === null ? (
            <div className="w-24 h-10 bg-slate-100 animate-pulse rounded-xl" />
          ) : isAuthenticated ? (
            <Link href="/dashboard">
              <Button
                className="bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold rounded-xl px-6 group shadow-lg shadow-green-500/10"
              >
                Go to Dashboard
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/auth/login">
                <Button variant="ghost" className="text-[#64748b] font-bold hover:text-[#0f172a] hover:bg-gray-50/50">
                  Log In
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button
                  className="bg-[#0f172a] hover:bg-[#1e293b] text-white font-bold rounded-xl px-6 group"
                >
                  Get Started
                  <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="lg:hidden p-2 rounded-xl text-[#0f172a] hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="absolute top-24 left-4 right-4 lg:hidden rounded-3xl bg-white/95 backdrop-blur-2xl border border-gray-100 shadow-2xl p-6 z-50"
          >
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={getHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-lg font-bold text-[#0f172a] hover:bg-[#f0fdf4] hover:text-[#22c55e] rounded-2xl transition-all"
                >
                  {link.label}
                </Link>
              ))}
               <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                {isAuthenticated === null ? (
                  <div className="col-span-2 w-full h-12 bg-slate-100 animate-pulse rounded-2xl" />
                ) : isAuthenticated ? (
                  <Link href="/dashboard" className="col-span-2 w-full" onClick={() => setMobileOpen(false)}>
                    <Button className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold h-12 rounded-2xl shadow-lg shadow-green-500/10">
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/auth/login" className="w-full" onClick={() => setMobileOpen(false)}>
                      <Button variant="outline" className="w-full font-bold h-12 rounded-2xl">
                        Log In
                      </Button>
                    </Link>
                    <Link href="/auth/register" className="w-full" onClick={() => setMobileOpen(false)}>
                      <Button className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold h-12 rounded-2xl">
                        Register
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

