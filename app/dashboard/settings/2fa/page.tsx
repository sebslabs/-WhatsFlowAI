"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Shield, Copy, Check, ArrowLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export default function TwoFactorAuthPage() {
  const { toast } = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(true);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const fetchSetup = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch("/api/2fa/setup");
      if (!res.ok) throw new Error("Failed to load 2FA setup");
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch (err: any) {
      toast(err.message || "Error setting up 2FA", "error");
    } finally {
      setSetupLoading(false);
    }
  };

  useEffect(() => {
    fetchSetup();
  }, []);

  const handleCopy = () => {
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      toast("Setup key copied to clipboard ✓", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token.length !== 6 || isNaN(Number(token))) {
      toast("Please enter a valid 6-digit number", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsEnabled(true);
        toast("2FA activated successfully ✓", "success");
      } else {
        toast(data.error || "Invalid verification code", "error");
      }
    } catch (err: any) {
      toast(err.message || "Failed to verify code", "error");
    } finally {
      setLoading(false);
    }
  };

  if (setupLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#000000] text-white">
        <Loader2 className="w-8 h-8 text-[#dcff50] animate-spin" />
        <p className="mt-4 font-bold text-[#6B7280] animate-pulse">Establishing Secure Authentication Core...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col items-center justify-center px-4 py-12 select-none antialiased">
      <div className="max-w-md w-full bg-[#111111]/60 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#7b2ce8]/20 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#dcff50]/10 rounded-full blur-3xl -ml-24 -mb-24 pointer-events-none" />

        <div className="relative z-10">
          {/* Top navigation */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-white mb-6 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-xl border border-white/5 transition-all w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Settings
          </button>

          {/* Icon and Title */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#7b2ce8]/20 border border-[#7b2ce8]/30 flex items-center justify-center text-[#7b2ce8]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white">Configure 2FA</h1>
              <p className="text-xs font-medium text-gray-400">Protect your account with an extra verification layer</p>
            </div>
          </div>

          {/* Main Display Card */}
          {isEnabled ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 bg-white/5 border border-white/10 rounded-2xl mt-4 flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 bg-[#dcff50]/20 border border-[#dcff50]/30 rounded-2xl flex items-center justify-center text-[#dcff50] mb-1">
                <Check className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">2FA Successfully Enabled ✓</h2>
              <p className="text-xs font-semibold text-gray-400 max-w-xs leading-relaxed">
                Your account is now fully secured with high-fidelity TOTP. Keep your device safe.
              </p>
              <button
                onClick={() => router.push("/dashboard/settings?tab=profile")}
                className="mt-4 bg-white/5 hover:bg-white/10 text-white font-bold h-11 px-6 rounded-xl border border-white/10 active:scale-95 transition-all text-xs"
              >
                Return to Profile
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 space-y-5"
            >
              {/* QR and fallback Key */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-4">
                <div className="p-2 bg-white rounded-xl border-4 border-white/10 shadow-inner flex items-center justify-center">
                  {qrCode ? (
                    <img src={qrCode} alt="TOTP QR Code" className="w-40 h-40" />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center animate-pulse">
                      <span className="text-gray-400">Loading QR...</span>
                    </div>
                  )}
                </div>

                <div className="w-full">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                    Manual Setup Key
                  </span>
                  <div className="flex items-center justify-between p-2.5 bg-black border border-white/10 rounded-xl select-all font-mono">
                    <span className="text-xs font-black tracking-wider text-[#dcff50] truncate select-all">{secret}</span>
                    <button
                      onClick={handleCopy}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-all shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#dcff50]" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Code Verification Input */}
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={token}
                    onChange={e => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    className="w-full text-center h-12 bg-black border border-white/10 text-white rounded-xl font-bold tracking-widest text-lg focus:outline-none focus:border-[#7b2ce8] focus:ring-2 focus:ring-[#7b2ce8]/20 transition-all placeholder:text-gray-600 placeholder:text-sm placeholder:tracking-normal"
                  />
                </div>

                <button
                  type="submit"
                  disabled={token.length !== 6 || loading}
                  className="w-full h-12 rounded-xl bg-[#7b2ce8] hover:bg-[#6c23cf] font-bold text-white tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#7b2ce8]/25 hover:shadow-[#7b2ce8]/40 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#7b2ce8] disabled:hover:shadow-none text-xs uppercase"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" /> Verifying...
                    </>
                  ) : (
                    "Verify & Enable 2FA"
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
