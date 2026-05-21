"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Copy, RefreshCw, CheckCircle2, XCircle, AlertCircle, Link2, Loader2, Terminal, Info, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { QRConnectionModal } from "@/components/dashboard/whatsapp/QRConnectionModal";

export default function WhatsAppIntegrationPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrSessions, setQrSessions] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    phone_number_id: "",
    business_account_id: "",
    access_token: "",
    webhook_verify_token: "whatsflow_default_verify" // Prefilled
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const data = await apiFetch('/api/whatsapp/config');
      setConfig(data);
      if (data) {
        setFormData(prev => ({
          ...prev,
          phone_number_id: data.phone_number_id || "",
          business_account_id: data.waba_id || "",
          webhook_verify_token: data.verify_token || prev.webhook_verify_token
        }));
      }
      
      const qrRes = await apiFetch('/api/whatsapp/qr');
      setQrSessions(qrRes || []);
    } catch (error) {
      console.error("Error loading WhatsApp config", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.phone_number_id || !formData.access_token) {
      toast("Phone Number ID and Access Token are mandatory", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      
      toast("WhatsApp Infrastructure Successfully Linked!", "success");
      loadConfig(); // Reload to show active status and code
    } catch (err: any) {
      toast(err.message || "Failed to establish connection with Meta Cloud", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      const res = await apiFetch('/api/whatsapp/config', {
        method: 'DELETE',
      });
      
      toast("WhatsApp connection successfully removed.", "success");
      setFormData({
        phone_number_id: "",
        business_account_id: "",
        access_token: "",
        webhook_verify_token: "whatsflow_default_verify"
      });
      loadConfig();
    } catch (err: any) {
      toast(err.message || "Failed to disconnect WhatsApp", "error");
    } finally {
      setSaving(false);
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast("Endpoint string copied to clipboard", "success");
  };

  const isConnected = config?.status === 'connected';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF] animate-pulse">Validating Cloud Protocol Status...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="WhatsApp Integration"
        description="Link Meta Cloud API assets or connect instantly via QR code to establish the upstream real-time communication channel."
      />

      {/* Connection Method Selector */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-sm relative overflow-hidden group hover:border-[#22C55E] transition-all cursor-pointer" onClick={() => setQrModalOpen(true)}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#22C55E]/10 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-[#22C55E]" />
            </div>
            {qrSessions.some(s => s.status === 'connected') && (
              <span className="px-2 py-1 rounded-lg bg-green-100 text-green-700 text-[10px] font-bold">ACTIVE</span>
            )}
          </div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] mb-1">QR Code Connection</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Scan a QR code from your phone. Perfect for quick setups and testing without Meta approval.</p>
        </div>

        <div className="flex-1 bg-white dark:bg-[#111827] rounded-2xl border border-[#22C55E] p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-[#22C55E]/10 rounded-full blur-2xl -mr-10 -mt-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#22C55E] flex items-center justify-center shadow-lg shadow-[#22C55E]/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-[#1F2937] text-gray-600 dark:text-gray-300 text-[10px] font-bold">OFFICIAL</span>
          </div>
          <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] mb-1">Meta Cloud API</h3>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">The official WhatsApp Business API integration. Best for scaling, templates, and high volume.</p>
        </div>
      </div>

      <QRConnectionModal 
        open={qrModalOpen} 
        onOpenChange={setQrModalOpen}
        onConnected={loadConfig}
      />

      {/* Connected QR Session Summary Card */}
      {qrSessions.find(s => s.status === 'connected') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#111827] rounded-2xl border-2 border-[#16A34A] shadow-sm p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#16A34A]/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 z-10 relative">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#16A34A]/10 flex items-center justify-center text-[#16A34A]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
                  QR Connection Live & Connected
                </h3>
                <p className="text-sm font-bold text-[#16A34A] mt-0.5">
                  +{qrSessions.find(s => s.status === 'connected')?.phone_number} (Multi-Device Authorized)
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium">
                  Connected since: {new Date(qrSessions.find(s => s.status === 'connected')?.last_connected_at || qrSessions.find(s => s.status === 'connected')?.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
            
            <ConfirmDeleteDialog
              title="Disconnect WhatsApp QR Session?"
              description="This will permanently sever the multi-device connection. AI Agents will stop responding to this number immediately."
              isDeleting={saving}
              onConfirm={async () => {
                setSaving(true);
                try {
                  const activeSession = qrSessions.find(s => s.status === 'connected');
                  await apiFetch(`/api/whatsapp/qr/${activeSession.id}`, { method: 'DELETE' });
                  toast("WhatsApp QR session successfully disconnected.", "success");
                  loadConfig();
                } catch (err: any) {
                  toast(err.message || "Failed to disconnect QR session", "error");
                } finally {
                  setSaving(false);
                }
              }}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  className="h-10 rounded-xl font-bold border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 text-xs shadow-sm shrink-0"
                >
                  Disconnect QR Session
                </Button>
              }
            />
          </div>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Section: Configuration & Reconnect Form */}
        <div className="lg:col-span-2 space-y-6">
          <motion.form
            onSubmit={handleConnect}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm p-8 relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-[#22C55E]" /> 
                  Meta API Authorization
                </h3>
                <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mt-1">Provide credentials to authenticate upstream hooks.</p>
              </div>
              {isConnected ? (
                <span className="px-3 py-1 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E] text-[10px] font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-ping absolute opacity-75" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] relative" />
                  LIVE CONNECTED
                </span>
              ) : (
                <span className="px-3 py-1 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] text-[10px] font-bold uppercase">
                  DISCONNECTED
                </span>
              )}
            </div>

            <div className="space-y-4 mt-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Phone Number ID</Label>
                  <Input
                    value={formData.phone_number_id}
                    onChange={e => setFormData({ ...formData, phone_number_id: e.target.value })}
                    placeholder="e.g. 1084234..."
                    className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">WhatsApp Business Account ID</Label>
                  <Input
                    value={formData.business_account_id}
                    onChange={e => setFormData({ ...formData, business_account_id: e.target.value })}
                    placeholder="e.g. 209435..."
                    className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Temporary or Permanent Access Token</Label>
                <Input
                  type="password"
                  value={formData.access_token}
                  onChange={e => setFormData({ ...formData, access_token: e.target.value })}
                  placeholder="EAAGz..."
                  className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                />
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3" /> Transferred over TLS and securely stored in production environment via AES-256.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Webhook Verify Token</Label>
                <Input
                  value={formData.webhook_verify_token}
                  onChange={e => setFormData({ ...formData, webhook_verify_token: e.target.value })}
                  placeholder="Choose a custom verify token (e.g. wfb_secure_token_xyz)"
                  className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                />
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1 font-medium">
                  <ShieldCheck className="w-3 h-3" /> Secure handshake token that Meta will use to verify your server endpoint.
                </p>
              </div>

              <div className="pt-6 flex justify-end gap-3">
                {isConnected && (
                  <ConfirmDeleteDialog
                    title="Disconnect WhatsApp Number?"
                    description="This will permanently severe the connection with Meta Cloud API. Active campaigns and agents using this number will fail until reconnected."
                    isDeleting={saving}
                    onConfirm={handleDisconnect}
                    trigger={
                      <Button 
                        type="button"
                        variant="outline"
                        disabled={saving}
                        className="h-11 rounded-xl font-bold border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
                      >
                        Disconnect Number
                      </Button>
                    }
                  />
                )}
                <Button 
                  type="submit"
                  disabled={saving}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-8 h-11 rounded-xl font-bold transition-all shadow-md active:scale-95 gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : isConnected ? <RefreshCw className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                  {saving ? "Synching Protocol..." : isConnected ? "Reconnect WhatsApp" : "Initialize Integration"}
                </Button>
              </div>
            </div>
          </motion.form>

          {/* Webhook Configuration Panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm p-8"
          >
            <div className="flex items-center gap-2 mb-6">
              <Terminal className="w-5 h-5 text-[#22C55E]" />
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Meta Webhook Terminal Binding</h3>
            </div>
            
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium leading-relaxed mb-6">
              Paste these values into the "Webhooks" section of your App Dashboard in developers.facebook.com.
            </p>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Callback URL</Label>
                  <p className="text-sm font-mono text-[#111827] dark:text-[#F9FAFB] mt-1 break-all">
                    {config?.webhook_url || "https://api.whatsflowai.com/api/whatsapp/webhook"}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 gap-2 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] font-bold shadow-sm transition-all active:scale-95" 
                  onClick={() => handleCopy(config?.webhook_url || "https://api.whatsflowai.com/api/whatsapp/webhook")}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Verify Token</Label>
                  <p className="text-sm font-mono text-[#111827] dark:text-[#F9FAFB] mt-1">{formData.webhook_verify_token}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 gap-2 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] font-bold shadow-sm transition-all active:scale-95" 
                  onClick={() => handleCopy(formData.webhook_verify_token)}
                >
                  <Copy className="w-3.5 h-3.5" /> Copy
                </Button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Section: Integration Core Status & 4-Digit Code */}
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#111827] text-white rounded-2xl border border-[#1F2937] p-8 relative overflow-hidden shadow-2xl shadow-[#22C55E]/10"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#22C55E]/20 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <div className="relative z-10">
              <h3 className="text-xs font-bold text-[#22C55E] tracking-widest uppercase mb-2">Integration Instance</h3>
              
              {isConnected && config?.integration_code ? (
                <div className="mt-6 text-center py-6 border-y border-white/10">
                  <span className="block text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-4">Master Identification Code</span>
                  <div className="flex items-center justify-center gap-3">
                    {config.integration_code.split('').map((char: string, i: number) => (
                      <div key={i} className="w-12 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-mono font-black text-[#22C55E] shadow-glow">
                        {char}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-6 font-medium italic px-4">Required for internal component registration and security handshakes.</p>
                </div>
              ) : (
                <div className="mt-6 text-center py-12 border-y border-white/10 opacity-50">
                  <AlertCircle className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-xs font-bold">PENDING ACTIVATION</p>
                </div>
              )}

              <div className="mt-8 flex justify-center">
                <Button 
                  disabled={!isConnected || saving}
                  onClick={handleConnect} // Regenerates by reinvoking connect endpoint logic
                  className="w-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold h-10 rounded-xl border border-white/10 backdrop-blur transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Generate New Integration Code
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2 mb-5">
              <CheckCircle2 className="w-4 h-4" /> Integration Vital Check
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937]">
                <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">OAuth 2.0 Stack</span>
                {isConnected ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <XCircle className="w-4 h-4 text-gray-300" />}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937]">
                <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">Webhook Propagation</span>
                {isConnected ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <XCircle className="w-4 h-4 text-gray-300" />}
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937]">
                <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">Encryption Engine</span>
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
              </div>
            </div>

            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 flex gap-3 items-start">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 leading-relaxed">
                Always use a permanent system user token in production to avoid disconnection cycles every 60 days.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-sm"
          >
            <h3 className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider flex items-center gap-2 mb-5">
              <BookOpen className="w-4 h-4" /> Connection Process
            </h3>
            
            <div className="relative pl-4 border-l-2 border-[#E5E7EB] dark:border-[#1F2937] space-y-6 ml-2 mt-2">
              {[
                { step: 1, title: "Meta Dev Account", desc: "Log in to developers.facebook.com & build a 'Business' application." },
                { step: 2, title: "Initialize Products", desc: "Locate the 'WhatsApp' component in sidebar & active setup." },
                { step: 3, title: "Map Identifiers", desc: "Extract your Phone ID & System Token directly into configuration." },
                { step: 4, title: "Activate Webhooks", desc: "Bridge events by copy-pasting URL & verify tokens from this hub." },
              ].map((s) => (
                <div key={s.step} className="relative">
                  <div className="absolute -left-[25px] top-0 w-[18px] h-[18px] rounded-full bg-[#22C55E] border-4 border-white dark:border-[#111827] shadow-sm flex items-center justify-center z-10" />
                  <p className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] leading-none">{s.title}</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937]">
              <Button 
                variant="outline" 
                asChild
                className="w-full gap-2 rounded-xl h-10 border-[#22C55E] text-[#22C55E] hover:bg-[#22C55E]/10 font-bold text-xs transition-all"
              >
                <a href="/docs/api#config" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5" /> Browse Detailed Docs
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
