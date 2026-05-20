"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, QrCode, Smartphone, Wifi, CheckCircle2, XCircle,
  Search, ChevronDown, RefreshCw, AlertTriangle, Clock, Zap
} from "lucide-react";
import { apiFetch } from "@/lib/api-config";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const COUNTRY_CODES = [
  { code: "+1",   iso: "us", country: "United States" },
  { code: "+44",  iso: "gb", country: "United Kingdom" },
  { code: "+91",  iso: "in", country: "India" },
  { code: "+94",  iso: "lk", country: "Sri Lanka" },
  { code: "+61",  iso: "au", country: "Australia" },
  { code: "+971", iso: "ae", country: "UAE" },
  { code: "+65",  iso: "sg", country: "Singapore" },
  { code: "+49",  iso: "de", country: "Germany" },
  { code: "+33",  iso: "fr", country: "France" },
  { code: "+81",  iso: "jp", country: "Japan" },
];

type QRStatus = "idle" | "starting" | "generating" | "qr_ready" | "verifying" | "connected" | "error" | "disconnected";

const STATUS_LABELS: Record<QRStatus, string> = {
  idle:        "Ready to Connect",
  starting:    "Starting Session…",
  generating:  "Generating QR…",
  qr_ready:    "Scan QR Code",
  verifying:   "Verifying…",
  connected:   "Connected!",
  error:       "Connection Failed",
  disconnected:"Disconnected",
};

const STATUS_COLORS: Record<QRStatus, string> = {
  idle:        "text-[#6B7280]",
  starting:    "text-[#F59E0B]",
  generating:  "text-[#3B82F6]",
  qr_ready:    "text-[#22C55E]",
  verifying:   "text-[#8B5CF6]",
  connected:   "text-[#22C55E]",
  error:       "text-red-500",
  disconnected:"text-[#6B7280]",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function QRConnectionModal({ open, onOpenChange, onConnected }: Props) {
  const { toast } = useToast();
  const [status, setStatus]         = useState<QRStatus>("idle");
  const [session, setSession]       = useState<any>(null);
  const [qrCode, setQrCode]         = useState<string | null>(null);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [countdown, setCountdown]   = useState(45);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+94");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(false);
  const pollRef   = useRef<NodeJS.Timeout | null>(null);
  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const sessionRef = useRef<any>(null);

  const filtered = COUNTRY_CODES.filter(c =>
    c.code.includes(search) || c.country.toLowerCase().includes(search.toLowerCase())
  );
  const selected = COUNTRY_CODES.find(c => c.code === countryCode) ?? COUNTRY_CODES[0];

  // Keep ref in sync for use inside intervals
  useEffect(() => { sessionRef.current = session; }, [session]);

  const stopPolling = useCallback(() => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current  = null;
    timerRef.current = null;
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(45);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const rows: any[] = await apiFetch("/api/whatsapp/qr");
        const cur = rows.find((s: any) => s.id === sessionId);
        if (!cur) return;

        const dbStatus: string = cur.status;
        setQrCode(cur.qr_code ?? null);
        setSession((p: any) => ({ ...p, ...cur }));

        if (dbStatus === "qr_ready" && cur.qr_code) {
          setStatus("qr_ready");
          startCountdown();
        } else if (dbStatus === "connecting") {
          setStatus("verifying");
        } else if (dbStatus === "connected") {
          setStatus("connected");
          stopPolling();
          setTimeout(() => {
            toast("WhatsApp connected via QR!", "success");
            onConnected();
            onOpenChange(false);
            resetState();
          }, 1800);
        } else if (dbStatus === "error") {
          setStatus("error");
          setErrorMsg(cur.error_message ?? "Connection failed");
          stopPolling();
        }
      } catch {
        // network blip — keep polling
      }
    }, 1500);
  }, [onConnected, onOpenChange, startCountdown, stopPolling, toast]);

  const resetState = useCallback(() => {
    stopPolling();
    setStatus("idle");
    setSession(null);
    setQrCode(null);
    setErrorMsg(null);
    setCountdown(45);
    setLoading(false);
  }, [stopPolling]);

  // Cleanup on close
  useEffect(() => {
    if (!open) { stopPolling(); }
    return stopPolling;
  }, [open, stopPolling]);

  const generateQR = async () => {
    if (!phoneNumber.trim()) {
      toast("Enter your WhatsApp phone number first", "error");
      return;
    }
    setLoading(true);
    setStatus("starting");
    setErrorMsg(null);
    setQrCode(null);

    try {
      const full = `${countryCode}${phoneNumber.replace(/\D/g, "")}`;
      const res = await apiFetch("/api/whatsapp/qr", {
        method: "POST",
        body: JSON.stringify({ sessionName: full, phoneNumber: full }),
      });
      setSession(res);
      setStatus("generating");
      startPolling(res.id);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message ?? "Failed to start session");
    } finally {
      setLoading(false);
    }
  };

  const refreshQR = async () => {
    if (!session) return;
    setStatus("generating");
    setQrCode(null);
    try {
      await apiFetch(`/api/whatsapp/qr/${session.id}/refresh`, { method: "POST" });
    } catch {
      setStatus("qr_ready"); // fallback — keep showing old QR
    }
  };

  const handleDisconnect = async () => {
    if (!session) { resetState(); return; }
    setLoading(true);
    try {
      await apiFetch(`/api/whatsapp/qr/${session.id}`, { method: "DELETE" });
    } catch { /* ignore */ }
    resetState();
  };

  const isScanning = status === "starting" || status === "generating" || status === "qr_ready" || status === "verifying";

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && session && status !== "connected") handleDisconnect();
      else if (!v) { onOpenChange(false); resetState(); }
      else onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-[460px] p-0 border-none shadow-2xl bg-white dark:bg-[#0D1117] rounded-2xl overflow-hidden">
        {/* Header gradient bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#22C55E] via-[#16A34A] to-[#15803D]" />

        <div className="p-8 space-y-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
                <QrCode className="w-5 h-5 text-[#22C55E]" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
                  QR Code Connection
                </DialogTitle>
                <DialogDescription className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  Scan with WhatsApp to link your number instantly
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Status badge */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#F9FAFB] dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D]">
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", {
                "bg-[#22C55E] animate-pulse": status === "connected" || status === "qr_ready",
                "bg-[#F59E0B] animate-pulse": status === "starting" || status === "generating" || status === "verifying",
                "bg-red-500": status === "error" || status === "disconnected",
                "bg-[#6B7280]": status === "idle",
              })} />
              <span className={cn("text-xs font-bold", STATUS_COLORS[status])}>
                {STATUS_LABELS[status]}
              </span>
            </div>
            {status === "qr_ready" && (
              <span className="text-xs text-[#6B7280] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Refreshes in {countdown}s
              </span>
            )}
          </div>

          {/* Phone input (shown before session starts) */}
          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="phone-form"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                    WhatsApp Number
                  </Label>
                  <div className="flex gap-2">
                    {/* Country picker */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="flex items-center gap-1.5 w-[110px] h-11 px-3 bg-[#F9FAFB] dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D] rounded-xl text-sm font-medium text-[#111827] dark:text-[#F9FAFB] hover:border-[#22C55E] transition-colors"
                      >
                        <img
                          src={`https://flagcdn.com/w20/${selected.iso}.png`}
                          width="18" alt={selected.country}
                          className="rounded-sm shrink-0"
                        />
                        <span className="text-xs">{selected.code}</span>
                        <ChevronDown className={cn("w-3 h-3 opacity-40 ml-auto transition-transform", dropdownOpen && "rotate-180")} />
                      </button>
                      {dropdownOpen && (
                        <div className="absolute top-12 left-0 w-[260px] max-h-[240px] bg-white dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
                          <div className="p-2 border-b border-[#E5E7EB] dark:border-[#21262D]">
                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <Input
                                autoFocus
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search…"
                                className="pl-8 h-8 text-xs bg-[#F9FAFB] dark:bg-[#0D1117] border-transparent text-[#111827] dark:text-[#F9FAFB]"
                              />
                            </div>
                          </div>
                          <div className="overflow-y-auto p-1">
                            {filtered.map(c => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => { setCountryCode(c.code); setDropdownOpen(false); setSearch(""); }}
                                className={cn(
                                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors",
                                  countryCode === c.code
                                    ? "bg-[#22C55E]/10 text-[#22C55E] font-bold"
                                    : "hover:bg-[#F9FAFB] dark:hover:bg-[#21262D] text-[#6B7280] dark:text-[#9CA3AF]"
                                )}
                              >
                                <img src={`https://flagcdn.com/w20/${c.iso}.png`} width="16" alt={c.country} className="rounded-sm" />
                                <span className="w-8 shrink-0">{c.code}</span>
                                <span className="text-[#111827] dark:text-[#F9FAFB] truncate">{c.country}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <Input
                      type="tel"
                      placeholder="712 345 678"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && generateQR()}
                      className="flex-1 h-11 bg-[#F9FAFB] dark:bg-[#161B22] border-[#E5E7EB] dark:border-[#21262D] rounded-xl text-sm font-medium text-[#111827] dark:text-[#F9FAFB]"
                    />
                  </div>
                  <p className="text-[10px] text-[#9CA3AF]">
                    Enter the number linked to your WhatsApp account
                  </p>
                </div>

                <Button
                  onClick={generateQR}
                  disabled={loading || !phoneNumber.trim()}
                  className="w-full h-11 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-xl transition-all active:scale-[0.98] gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Generate QR Code
                </Button>

                {/* Steps guide */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {[
                    { icon: Smartphone, label: "Open WhatsApp" },
                    { icon: QrCode,     label: "Linked Devices" },
                    { icon: Wifi,       label: "Scan & Link" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#161B22] border border-[#E5E7EB] dark:border-[#21262D]">
                      <Icon className="w-4 h-4 text-[#22C55E]" />
                      <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#9CA3AF] text-center">{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* QR scanning states */}
            {isScanning && (
              <motion.div
                key="qr-area"
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-5"
              >
                {/* QR Code display area */}
                <div className="relative w-56 h-56 flex items-center justify-center bg-white dark:bg-[#161B22] border-2 border-[#E5E7EB] dark:border-[#21262D] rounded-2xl overflow-hidden shadow-inner">
                  {/* Corner decorations */}
                  {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map(pos => (
                    <div key={pos} className={`absolute ${pos} w-5 h-5 border-[3px] border-[#22C55E] rounded-sm`} />
                  ))}

                  <AnimatePresence mode="wait">
                    {(status === "generating" || status === "starting") && (
                      <motion.div
                        key="spinner"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full border-4 border-[#22C55E]/20 border-t-[#22C55E] animate-spin" />
                          <QrCode className="w-5 h-5 text-[#22C55E] absolute inset-0 m-auto" />
                        </div>
                        <span className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                          {status === "starting" ? "Starting session…" : "Generating QR…"}
                        </span>
                      </motion.div>
                    )}

                    {status === "verifying" && (
                      <motion.div
                        key="verifying"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex flex-col items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-full border-4 border-[#8B5CF6]/20 border-t-[#8B5CF6] animate-spin" />
                        <span className="text-xs font-medium text-[#8B5CF6]">Verifying scan…</span>
                      </motion.div>
                    )}

                    {status === "qr_ready" && qrCode && (
                      <motion.img
                        key="qrimg"
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-44 h-44 rounded-xl object-contain"
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Instruction steps */}
                <div className="w-full space-y-2">
                  {[
                    { step: 1, text: "Open WhatsApp on your phone" },
                    { step: 2, text: "Go to Settings → Linked Devices" },
                    { step: 3, text: "Tap \"Link a Device\" and scan" },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      <span className="w-5 h-5 rounded-full bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center font-bold text-[10px] shrink-0">
                        {s.step}
                      </span>
                      {s.text}
                    </div>
                  ))}
                </div>

                <div className="w-full flex gap-2">
                  {status === "qr_ready" && (
                    <Button
                      onClick={refreshQR}
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 rounded-xl text-xs gap-1.5 border-[#E5E7EB] dark:border-[#21262D]"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh QR
                    </Button>
                  )}
                  <Button
                    onClick={handleDisconnect}
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-9 rounded-xl text-xs text-[#6B7280] hover:text-red-500"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Success state */}
            {status === "connected" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-6"
              >
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-20 h-20 rounded-full bg-[#22C55E]/10 flex items-center justify-center"
                >
                  <CheckCircle2 className="w-10 h-10 text-[#22C55E]" />
                </motion.div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">Connected!</p>
                  <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1">
                    {session?.phone_number && `+${session.phone_number}`}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {(status === "error" || status === "disconnected") && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 py-4"
              >
                <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-[#111827] dark:text-[#F9FAFB]">Connection Failed</p>
                  {errorMsg && (
                    <p className="text-xs text-[#6B7280] mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                      {errorMsg}
                    </p>
                  )}
                </div>
                <Button
                  onClick={resetState}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white h-10 px-6 rounded-xl font-bold text-sm gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Try Again
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
