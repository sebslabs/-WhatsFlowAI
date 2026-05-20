"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, AlertCircle, Mail, Lock, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // Authenticate with Supabase so middleware receives the cookie
      let { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] flex flex-col items-center justify-center p-4 relative overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#22c55e]/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-[#22c55e]/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md z-10"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 transition-opacity hover:opacity-90">
          <div className="w-10 h-10 shrink-0 relative">
            <div className="absolute inset-0 bg-[#22c55e]/20 rounded-xl blur-lg" />
            <img src="/logo-robot.png" alt="Logo" className="w-full h-full object-contain relative" />
          </div>
          <span className="font-black text-[#0f172a] text-2xl tracking-tighter">
            WhatsFlow<span className="text-[#22c55e]">AI</span>
          </span>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-[32px] p-8 sm:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-[#E2EDE2]">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">Welcome back</h1>
            <p className="text-[#64748b] mt-2 font-medium">Enter your details to access your dashboard</p>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-600 text-sm font-medium overflow-hidden"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold text-slate-700">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    placeholder="name@company.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-bold text-slate-700">Password</Label>
                  <Link href="#" className="text-xs font-bold text-[#22c55e] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-12 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-base shadow-lg shadow-green-500/10 rounded-xl transition-all active:scale-[0.98] group disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>

          </div>

          <p className="text-center mt-8 text-sm text-[#64748b]">
            Don&apos;t have an account?{" "}
            <Link href="/auth/register" className="font-bold text-[#22c55e] hover:underline">
              Create Account
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Trust micro-copy */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 opacity-60 grayscale transition-all hover:grayscale-0 z-10">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <Check className="w-3 h-3 text-[#22c55e]" />
          Secure OAuth 2.0
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <Check className="w-3 h-3 text-[#22c55e]" />
          Encrypted Sessions
        </div>
      </div>

      {/* Footer link */}
      <p className="mt-8 text-xs text-slate-400 relative z-10">
        © 2026 WhatsFlow AI · All rights reserved.
      </p>
    </div>
  );
}

// Loader icon helper if not imported
function Loader2({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
