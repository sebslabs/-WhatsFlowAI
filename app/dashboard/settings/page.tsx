"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { initializePaddle, Paddle } from "@paddle/paddle-js";
import { getClientPlanDetails } from "@/lib/endorsely-client";
import { motion } from "framer-motion";
import { RefreshCw, Download, CreditCard, User, Mail, Phone, Camera, ShieldCheck, Lock, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationToggle } from "@/components/dashboard/AutomationToggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-config";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";



const invoices: Array<{ date: string, amount: string, status: string }> = [];

type SettingsConfig = {
  business_name: string;
  industry: string;
  whatsapp_number: string;
  support_email: string;
  full_name: string;
  personal_email: string;
  tenant_id?: string;
  active_subscription: {
    subscription_status: string;
    plan_name: string;
    price_monthly: string;
    is_yearly: boolean;
    trial_days_remaining: number;
    trial_end_date: string;
    ai_conversation_used: number;
    ai_conversation_limit: number;
    grace_days_remaining?: number;
    grace_period_end?: string;
    [key: string]: any;
  } | null;
  payment_history?: any[];
  [key: string]: unknown;
};

const upgradePlans = [
  { 
    id: "starter",
    name: "Starter Tier", 
    price: "$49", 
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY, 
    features: ["1 WhatsApp Connected Line", "1,500 AI Conversations/mo", "Email Support"] 
  },
  { 
    id: "pro",
    name: "Growth Tier", 
    price: "$99", 
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY, 
    features: ["3 WhatsApp Connected Lines", "5,000 AI Conversations/mo", "Priority System Core Access"],
    highlight: true 
  },
  { 
    id: "enterprise",
    name: "Scale Tier", 
    price: "$199", 
    priceId: process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_MONTHLY, 
    features: ["Unlimited Numbers", "15,000 AI Conversations/mo", "24/7 Hybrid Logic SLA Support"] 
  }
];

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#22C55E]" aria-label="Loading settings" />
        </div>
      }
    >
      <SettingsPageContent />
    </Suspense>
  );
}

function SettingsPageContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const tabParam = searchParams.get("tab");
  const alertParam = searchParams.get("alert");
  const [activeTab, setActiveTab] = useState(tabParam || "general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Avatar upload state & ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // 2FA state
  const [tfaOpen, setTfaOpen] = useState(false);
  const [tfaEnabled, setTfaEnabled] = useState(false);
  const [tfaCode, setTfaCode] = useState("");
  const [tfaSecret, setTfaSecret] = useState("");
  const [tfaQrCode, setTfaQrCode] = useState("");
  const [confirmingTfa, setConfirmingTfa] = useState(false);

  // Password update state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Billing functional states
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  const [config, setConfig] = useState<SettingsConfig>({
    business_name: "",
    industry: "dental",
    whatsapp_number: "",
    support_email: "",
    full_name: "Loading...",
    personal_email: "",
    active_subscription: null,
    payment_history: []
  });

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await apiFetch('/api/settings');
        if (data) {
          setConfig((prev: SettingsConfig) => ({ ...prev, ...(data as Partial<SettingsConfig>) }));
        }
        const tfaStatusRes = await fetch('/api/2fa/status');
        if (tfaStatusRes.ok) {
          const tfaStatus = await tfaStatusRes.json();
          setTfaEnabled(Boolean(tfaStatus?.enabled));
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUpdate = (key: string, value: unknown) => {
    setConfig((prev: SettingsConfig) => ({ ...prev, [key]: value }));
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'POST',
        body: JSON.stringify(config)
      });
      toast("Infrastructure protocols updated ✓", "success");
    } catch (err) {
      toast("Failed to update settings", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenTfa = async () => {
    try {
      const res = await fetch("/api/2fa/setup");
      if (!res.ok) throw new Error("Failed to initialize 2FA");
      const data = await res.json();
      setTfaSecret(data.secret);
      setTfaQrCode(data.qrCode);
      setTfaOpen(true);
    } catch (err: any) {
      toast(err.message || "Failed to load 2FA configuration", "error");
    }
  };

  const handleEnableTfa = async () => {
    if (tfaCode.length !== 6 || isNaN(Number(tfaCode))) {
      toast("Please enter a valid 6-digit code", "error");
      return;
    }
    setConfirmingTfa(true);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tfaCode, secret: tfaSecret }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTfaEnabled(true);
        setTfaOpen(false);
        setTfaCode("");
        toast("Two-factor authentication successfully activated ✓", "success");
      } else {
        toast(data.error || "Invalid verification code", "error");
      }
    } catch (err: any) {
      toast(err.message || "Failed to verify code", "error");
    } finally {
      setConfirmingTfa(false);
    }
  };

  const handleDisableTfa = () => {
    void (async () => {
      try {
        const res = await fetch("/api/2fa/disable", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success !== true) {
          throw new Error(data.error || "Failed to disable 2FA");
        }
        setTfaEnabled(false);
        toast("Two-factor authentication successfully deactivated", "success");
      } catch (err: any) {
        toast(err.message || "Failed to disable 2FA", "error");
      }
    })();
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast("Please fill in all password fields", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New password and confirm password do not match", "error");
      return;
    }
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || "Failed to update password");
      }
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Password successfully updated ✓", "success");
    } catch (err: any) {
      toast(err.message || "Failed to update password", "error");
    } finally {
      setSavingPassword(false);
    }
  };
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast("Image must be smaller than 5 MB", "error");
      return;
    }

    // Validate type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      toast("Only JPG, PNG, WEBP, or GIF images are allowed", "error");
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to upload avatar");
      }

      handleUpdate("avatar_url", data.avatar_url);
      
      // Dispatch a custom event to dynamically synchronize other layout components (Sidebar, TopBar) in real-time
      window.dispatchEvent(new Event('profile-updated'));
      
      toast("Profile avatar updated successfully ✓", "success");
    } catch (err: any) {
      toast(err.message || "Failed to upload profile image", "error");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!config.avatar_url) return;

    if (!confirm("Are you sure you want to remove your profile picture?")) {
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to remove avatar");
      }

      handleUpdate("avatar_url", null);
      
      // Dispatch a custom event to dynamically synchronize other layout components (Sidebar, TopBar) in real-time
      window.dispatchEvent(new Event('profile-updated'));
      
      toast("Profile avatar removed successfully ✓", "success");
    } catch (err: any) {
      toast(err.message || "Failed to remove profile image", "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleManagePayment = async () => {
    setIsPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal');
      const data = await res.json();
      if (data.updateUrl) {
        window.open(data.updateUrl, '_blank');
      } else {
        toast(data.error || 'No active payment configurations discovered.', 'error');
      }
    } catch (err) {
      toast('Unable to safely establish gateway portal context.', 'error');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleTerminatePlan = async () => {
    setIsPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal');
      const data = await res.json();
      if (data.cancelUrl) {
        window.open(data.cancelUrl, '_blank');
      } else {
        toast(data.error || 'Plan cancellation route unavailable at present.', 'error');
      }
    } catch (err) {
      toast('Plan termination request gateway failure.', 'error');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const triggerPaddleCheckout = async (priceId: string | undefined) => {
    console.log("🚀 [Paddle Debug] Launching checkout with details:", {
      priceId,
      token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      environment: process.env.NEXT_PUBLIC_PADDLE_ENV || "sandbox",
    });

    if (!priceId) {
      toast("Selected tier price credentials not available in environment configurations.", "error");
      return;
    }
    setIsCheckingOut(priceId);
    try {
      const paddleInstance = await initializePaddle({
        environment: (process.env.NEXT_PUBLIC_PADDLE_ENV as any) || "sandbox",
        token: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "",
      });

      if (paddleInstance) {
        // Retrieve local storage referral ID to pass along securely with transaction
        const endorselyReferral = typeof window !== 'undefined' ? localStorage.getItem("endorsely_referral") || "" : "";

        // Register checkout event callback to immediately forward affiliate details to our API
        (paddleInstance as any).on('checkout.completed', async (data: any) => {
          console.log("🔔 [Paddle Checkout Client] Completion event captured:", data);
          const refId = typeof window !== 'undefined' ? localStorage.getItem("endorsely_referral") || "" : "";
          if (refId) {
            try {
              const selectedPriceId = data.items?.[0]?.price?.id || priceId;
              const { plan, billingCycle, amount } = getClientPlanDetails(selectedPriceId);

              const trackPayload = {
                referralId: refId,
                email: config.personal_email || "",
                customerId: data.customer?.id || config.tenant_id || "anonymous_cust",
                customerName: config.full_name || "",
                plan,
                billingCycle,
                amount
              };

              console.log("📡 [Paddle Checkout Client] Forwarding checkout details to backend track api...", trackPayload);
              await fetch('/api/affiliate/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(trackPayload)
              });
              console.log("✅ [Paddle Checkout Client] Backend tracking call finished.");
            } catch (err: any) {
              console.error("❌ [Paddle Checkout Client] Affiliate backend tracking call crashed:", err.message || err);
            }
          }
        });

        const checkoutOptions: any = {
          items: [{ priceId, quantity: 1 }],
          customData: {
            tenant_id: config.tenant_id || "",
            endorsely_referral_id: endorselyReferral
          },
          settings: {
            displayMode: "overlay",
            theme: "light",
            locale: "en"
          }
        };

        if (config.personal_email && config.personal_email.trim() !== "" && config.personal_email.includes("@")) {
          checkoutOptions.customer = {
            email: config.personal_email.trim()
          };
        }

        paddleInstance.Checkout.open(checkoutOptions);
        setUpgradeOpen(false);
      } else {
        throw new Error("Paddle dynamic instance script mapping failure.");
      }
    } catch (err: any) {
      toast(err.message || "Strategic gateway runtime configuration crashed.", "error");
    } finally {
      setIsCheckingOut(null);
    }
  };

  const sub = config.active_subscription;
  const isExpiredOrSuspended = sub ? ['expired', 'suspended'].includes(sub.subscription_status) : false;
  const isGracePeriod = sub?.subscription_status === 'grace_period';
  const isLimitReached = sub?.subscription_status === 'limit_reached' || (sub && sub.ai_conversation_used >= sub.ai_conversation_limit);
  const usageRatio = sub ? (sub.ai_conversation_used / sub.ai_conversation_limit) : 0;
  const isUsageWarning = usageRatio >= 0.8 && usageRatio < 1.0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF] animate-pulse">Synchronizing Core Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Settings"
        description="Manage your organizational infrastructure, high-fidelity integrations, and global billing protocols."
      />

      {/* Real-time contextual warnings & system notification alerts */}
      {alertParam === 'expired' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-4"
        >
          <AlertCircle className="w-6 h-6 text-rose-500 mt-0.5 shrink-0 animate-bounce" />
          <div>
            <h4 className="font-extrabold text-[#111827] dark:text-[#F9FAFB] text-sm">Your Free Trial Has Expired</h4>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
              To restore automated AI replies, customer conversations, and premium campaign workflows, please subscribe to one of our professional subscription plans below.
            </p>
          </div>
        </motion.div>
      )}

      {isGracePeriod && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-4"
        >
          <AlertCircle className="w-6 h-6 text-amber-500 mt-0.5 shrink-0 animate-pulse" />
          <div>
            <h4 className="font-extrabold text-[#111827] dark:text-[#F9FAFB] text-sm">Subscription Payment Overdue</h4>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
              Your subscription renewal charge failed. You are currently in a grace period ({sub?.grace_days_remaining ?? 3} days remaining). Please update your payment method to prevent account suspension.
            </p>
          </div>
        </motion.div>
      )}

      {isLimitReached && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-4"
        >
          <AlertCircle className="w-6 h-6 text-rose-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-extrabold text-[#111827] dark:text-[#F9FAFB] text-sm">Monthly Conversation Quota Exceeded</h4>
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1">
              You have fully utilized your plan's monthly AI conversation allowance. Automatic AI responses are temporarily paused. Deploy an upgraded tier below to restore auto-replies instantly.
            </p>
          </div>
        </motion.div>
      )}

      {isUsageWarning && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-4"
        >
          <AlertCircle className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-extrabold text-[#111827] dark:text-[#F9FAFB] text-sm">AI Conversation Allowance Running Low</h4>
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mt-1">
              You have consumed over 80% of your plan's monthly budget ({sub?.ai_conversation_used} / {sub?.ai_conversation_limit}). Upgrade now to ensure your customer replies never experience interruptions.
            </p>
          </div>
        </motion.div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-1 h-auto rounded-xl shadow-sm inline-flex">
          {["general", "profile", "notifications", "billing"].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="px-6 py-2.5 rounded-xl capitalize text-xs font-bold tracking-wide transition-all duration-200 data-[state=active]:bg-[#22C55E]/10 data-[state=active]:text-[#22C55E] text-[#6B7280] dark:text-[#9CA3AF]"
            >
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* GENERAL CONTENT */}
        <TabsContent value="general">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 shadow-sm transition-colors duration-300"
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                  Organization DNA
                </h3>
                <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] mt-1">Foundational Business Identity</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#22C55E]/10 text-[#22C55E] flex items-center justify-center">
                <RefreshCw className="w-5 h-5" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Business Name</Label>
                <Input
                  value={config.business_name}
                  onChange={e => handleUpdate("business_name", e.target.value)}
                  className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] focus:border-[#22C55E] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Industry Ecosystem</Label>
                <Select value={config.industry} onValueChange={v => handleUpdate("industry", v)}>
                  <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="saas">SaaS / Software</SelectItem>
                    <SelectItem value="healthcare">Health & Medical</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                    <SelectItem value="retail">Retail & Logistics</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                    <SelectItem value="finance">FinTech / Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="dental">Dental / Medical Clinic</SelectItem>
                    <SelectItem value="salon">Wellness & Spa</SelectItem>
                    <SelectItem value="physio">Professional Services</SelectItem>
                    <SelectItem value="online">Online / SaaS Digital</SelectItem>
                    <SelectItem value="other">Other Custom Services</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Verified WhatsApp Number</Label>
                <Input
                  value={config.whatsapp_number}
                  onChange={e => handleUpdate("whatsapp_number", e.target.value)}
                  className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Support Email</Label>
                <Input
                  value={config.support_email}
                  onChange={e => handleUpdate("support_email", e.target.value)}
                  type="email"
                  className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#1F2937] flex justify-end">
              <Button
                onClick={saveSettings}
                disabled={saving}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-8 h-11 rounded-xl font-bold shadow-md active:scale-95 transition-all"
              >
                {saving ? "Deploying..." : "Update Global Profile"}
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* PROFILE CONTENT */}
        <TabsContent value="profile">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-6 mb-8">
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="relative group cursor-pointer"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#22C55E] to-[#16A34A] flex items-center justify-center text-white text-2xl font-extrabold shadow-md overflow-hidden relative border-2 border-white dark:border-[#111827] group-hover:scale-105 transition-all duration-300">
                    {config.avatar_url ? (
                      <img 
                        src={config.avatar_url as string} 
                        alt={config.full_name || "Profile Avatar"} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>
                        {config.full_name
                          ? config.full_name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)
                          : "AU"}
                      </span>
                    )}

                    {/* Hover state overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                      <Camera className="w-6 h-6 text-white animate-pulse" />
                    </div>

                    {/* Uploading loading state overlay */}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-1 z-10">
                        <Loader2 className="w-5 h-5 text-[#22C55E] animate-spin" />
                        <span className="text-[8px] font-bold text-white uppercase tracking-wider animate-pulse">Uploading</span>
                      </div>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-[#0B0F1A] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] hover:border-[#22C55E]/50 hover:scale-110 shadow-md active:scale-95 transition-all z-20"
                    title="Change Profile Picture"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#111827] dark:text-[#F9FAFB]">
                    {config.full_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                      Administrator • {config.personal_email}
                    </p>
                    {!!config.avatar_url && (
                      <>
                        <span className="text-[#E5E7EB] dark:text-[#1F2937] text-xs">•</span>
                        <button
                          type="button"
                          onClick={handleRemoveAvatar}
                          className="text-xs font-bold text-red-500 hover:text-red-600 hover:underline transition-colors active:scale-95"
                        >
                          Remove Photo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                    <Input
                      value={config.full_name}
                      onChange={e => handleUpdate("full_name", e.target.value)}
                      className="pl-11 h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Personal Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                    <Input
                      value={config.personal_email}
                      onChange={e => handleUpdate("personal_email", e.target.value)}
                      className="pl-11 h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#1F2937] flex justify-end">
                <Button
                  onClick={saveSettings}
                  disabled={saving}
                  className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-8 h-11 rounded-xl font-bold shadow-md active:scale-95 transition-all"
                >
                  {saving ? "Saving..." : "Save Account Details"}
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-6 shadow-sm">
              <h3 className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider mb-5">Security & Access</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {/* 2FA Card */}
                <div className="p-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <ShieldCheck className={cn("w-5 h-5", tfaEnabled ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]")} />
                    <div>
                      <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] block">Two-Factor Auth</span>
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-semibold">{tfaEnabled ? "Status: Active" : "Status: Disabled"}</span>
                    </div>
                  </div>
                  {tfaEnabled ? (
                    <Button
                      variant="outline"
                      onClick={handleDisableTfa}
                      className="h-9 rounded-xl text-xs font-bold border-red-200 hover:bg-red-50 dark:hover:bg-red-950 text-red-500 transition-all"
                    >
                      DISABLE
                    </Button>
                  ) : (
                    <Dialog open={tfaOpen} onOpenChange={setTfaOpen}>
                      <Button
                        variant="outline"
                        onClick={handleOpenTfa}
                        className="h-9 rounded-xl text-xs font-bold border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#374151]"
                      >
                        ENABLE
                      </Button>
                      <DialogContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] p-6 rounded-2xl max-w-md shadow-xl">
                        <DialogHeader>
                          <DialogTitle className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Configure Two-Factor Auth</DialogTitle>
                          <DialogDescription className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                            Protect your account with a secondary security verification layer.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                          <div className="p-3 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl text-center">
                            <p className="text-[11px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider mb-2">Scan QR Code or Use Setup Key</p>
                            <div className="w-32 h-32 bg-white dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl mx-auto flex items-center justify-center mb-3 overflow-hidden">
                              {tfaQrCode ? (
                                <img src={tfaQrCode} alt="TOTP QR Code" className="w-full h-full object-contain p-1" />
                              ) : (
                                <span className="text-2xl animate-pulse">📱</span>
                              )}
                            </div>
                            <p className="text-xs font-mono font-bold text-[#111827] dark:text-[#F9FAFB] select-all bg-white dark:bg-[#111827] py-1 border border-[#E5E7EB] dark:border-[#1F2937] rounded-lg tracking-wider">
                              {tfaSecret || "WHATS-FLOW-AI-2FA-TOKEN"}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Verification Code</Label>
                            <Input
                              placeholder="6-digit authentication code"
                              value={tfaCode}
                              onChange={e => setTfaCode(e.target.value)}
                              maxLength={6}
                              className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-bold text-center tracking-widest bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                            />
                          </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                          <Button variant="outline" onClick={() => setTfaOpen(false)} className="h-11 px-5 rounded-xl text-xs font-bold">Cancel</Button>
                          <Button
                            onClick={handleEnableTfa}
                            disabled={confirmingTfa}
                            className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-5 h-11 rounded-xl font-bold transition-all shadow-md active:scale-95"
                          >
                            {confirmingTfa ? "Activating..." : "Verify & Activate"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>

                {/* Password Card */}
                <div className="p-4 bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Lock className="w-5 h-5 text-[#22C55E]" />
                    <div>
                      <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] block">Update Password</span>
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-semibold">Change your account password</span>
                    </div>
                  </div>
                  <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                    <Button
                      variant="outline"
                      onClick={() => setPasswordOpen(true)}
                      className="h-9 rounded-xl text-xs font-bold border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#374151]"
                    >
                      CHANGE
                    </Button>
                    <DialogContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] p-6 rounded-2xl max-w-md shadow-xl">
                      <DialogHeader>
                        <DialogTitle className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">Update Password</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                          Ensure your account uses a complex password to protect your workspace.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="mt-4 space-y-3.5">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Current Password</Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">New Password</Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">Confirm New Password</Label>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A] text-[#111827] dark:text-[#F9FAFB]"
                          />
                        </div>
                      </div>
                      <div className="mt-6 flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setPasswordOpen(false)} className="h-11 px-5 rounded-xl text-xs font-bold">Cancel</Button>
                        <Button
                          onClick={handleUpdatePassword}
                          disabled={savingPassword}
                          className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-5 h-11 rounded-xl font-bold transition-all shadow-md active:scale-95"
                        >
                          {savingPassword ? "Updating..." : "Update Password"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>



        {/* NOTIFICATIONS */}
        <TabsContent value="notifications">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 space-y-6 shadow-sm transition-colors duration-300"
          >
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                Alert Protocols
              </h3>
              <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] mt-1">Real-time Intelligence Updates</p>
            </div>

            <div className="grid gap-4">
              {[
                { label: "Lead Acquisition", desc: "Notify when a high-intent lead initiates contact" },
                { label: "Successful Conversion", desc: "Alert when a booking is finalized by the AI" },
                { label: "Human Escalation", desc: "Instantly alert team for complex edge cases" },
                { label: "Daily ROI Analytics", desc: "Receive summary performance reports via email" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 px-6 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#22C55E]/30 transition-all">
                  <div>
                    <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{item.label}</p>
                    <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">{item.desc}</p>
                  </div>
                  <AutomationToggle defaultChecked={true} label="" description="" />
                </div>
              ))}
            </div>

            <div className="space-y-1.5 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937]">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Alert Distribution Email</Label>
              <Input
                defaultValue="hq@whatsflow.ai"
                type="email"
                className="max-w-md h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] font-medium bg-[#F9FAFB] dark:bg-[#0B0F1A]"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-8 h-11 rounded-xl font-bold shadow-md active:scale-95 transition-all">
                Deploy Preferences
              </Button>
            </div>
          </motion.div>
        </TabsContent>

        {/* BILLING PORTAL TAB */}
        <TabsContent value="billing" className="space-y-6">
          {/* Active plan details summary card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 shadow-sm relative overflow-hidden transition-colors duration-300"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/5 rounded-full blur-3xl -mr-32 -mt-32" />

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Active Subscription</h3>
                  <Badge className="bg-[#22C55E] text-white text-[10px] font-bold px-3 py-1 rounded-xl border-none uppercase">
                    {sub?.plan_name || 'Free Trial'}
                  </Badge>
                </div>

                <div className="grid gap-1.5">
                  <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                    Plan Cost: <span className="text-[#111827] dark:text-[#F9FAFB] font-bold">${sub?.price_monthly || '0.00'} / month {sub?.is_yearly ? '(billed annually)' : ''}</span>
                  </p>
                  <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                    Subscription Status: <span className={cn(
                      "font-extrabold capitalize px-2 py-0.5 rounded-lg text-xs inline-block ml-1 border border-current",
                      sub?.subscription_status === 'trial' ? "bg-amber-500/10 text-amber-500" :
                      sub?.subscription_status === 'active' ? "bg-[#22C55E]/10 text-[#22C55E]" :
                      sub?.subscription_status === 'grace_period' ? "bg-amber-500/10 text-amber-500 animate-pulse" :
                      "bg-rose-500/10 text-rose-500"
                    )}>{sub?.subscription_status?.replace('_', ' ') || 'trial'}</span>
                  </p>
                  {sub?.subscription_status === 'trial' && sub?.trial_end_date && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                      ⚠️ Your free trial will automatically expire on {new Date(sub.trial_end_date).toLocaleDateString()} ({sub.trial_days_remaining ?? 7} days remaining).
                    </p>
                  )}
                  {sub?.subscription_status === 'grace_period' && sub?.grace_period_end && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-1">
                      🚨 Service warning: Payment is overdue. Renew subscription within {sub.grace_days_remaining ?? 3} days to avoid complete suspension.
                    </p>
                  )}
                </div>

                {/* AI conversation tracking progress bar */}
                {sub && (
                  <div className="mt-5 max-w-md space-y-2">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-500 dark:text-gray-400">
                      <span>Monthly Leads Count</span>
                      <span className={cn(
                        "font-extrabold",
                        isLimitReached ? "text-rose-500" : isUsageWarning ? "text-amber-500" : "text-green-500"
                      )}>
                        {sub.ai_conversation_used?.toLocaleString()} / {sub.ai_conversation_limit?.toLocaleString()} Used
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937]">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isLimitReached ? "bg-rose-500" : isUsageWarning ? "bg-amber-500" : "bg-[#22C55E]"
                        )}
                        style={{ width: `${Math.min(100, ((sub.ai_conversation_used || 0) / (sub.ai_conversation_limit || 1500)) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">
                      Usage count automatically resets on each billing anniversary date.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setUpgradeOpen(true)}
                  className="h-11 px-6 rounded-xl font-bold border-[#22C55E] text-[#22C55E] bg-white dark:bg-[#1F2937] hover:bg-[#22C55E]/10 dark:hover:bg-[#22C55E]/10 shadow-sm transition-all active:scale-95 shrink-0"
                >
                  Upgrade Tier
                </Button>
                {sub && sub.subscription_status !== 'trial' && sub.subscription_status !== 'expired' && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={isPortalLoading}
                    className="h-11 px-6 rounded-xl font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all shrink-0"
                  >
                    {isPortalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel Plan"}
                  </Button>
                )}
              </div>
            </div>

            {sub && sub.subscription_status !== 'trial' && sub.subscription_status !== 'expired' && (
              <div className="mt-8 p-5 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl flex items-center justify-between border-dashed">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-black dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-lg flex items-center justify-center shadow-sm">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Active Payment Source</p>
                    <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">Secured securely via Paddle Gateway</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleManagePayment}
                  disabled={isPortalLoading}
                  className="h-10 px-5 rounded-xl text-xs font-bold border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#374151]"
                >
                  {isPortalLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Update Card"}
                </Button>
              </div>
            )}
          </motion.div>

          {/* Detailed Pricing Selection & Monthly/Yearly Toggle Card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-8 shadow-sm transition-all">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-6 border-b border-[#E5E7EB] dark:border-[#1F2937]">
              <div>
                <h3 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">Upgrade Your Workspace Intelligence</h3>
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mt-1">Select the subscription model optimized for your WhatsApp and AI message flow volume.</p>
              </div>
              
              {/* Premium Monthly/Yearly Toggle Switch */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-[#0B0F1A] p-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937]">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-extrabold transition-all",
                    billingCycle === 'monthly' ? "bg-white dark:bg-[#111827] text-[#22C55E] shadow-sm border border-[#E5E7EB] dark:border-[#1F2937]" : "text-gray-500"
                  )}
                >
                  Monthly Plan
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5",
                    billingCycle === 'yearly' ? "bg-white dark:bg-[#111827] text-[#22C55E] shadow-sm border border-[#E5E7EB] dark:border-[#1F2937]" : "text-gray-500"
                  )}
                >
                  Yearly Plan
                  <span className="bg-green-500/10 text-green-500 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase">Save 20%</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { 
                  id: "starter",
                  name: "Starter Tier", 
                  price: billingCycle === 'monthly' ? "$49" : "$39",
                  conversations: "1,500 conversations / month",
                  priceId: billingCycle === 'monthly' 
                    ? process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_MONTHLY 
                    : (process.env.NEXT_PUBLIC_PADDLE_PRICE_STARTER_ANNUAL || "pri_01kry9prvj4ckwwqzh6y6x18td"), 
                  features: ["1 WhatsApp Connected Line", "1,500 AI Conversations/mo", "Email Support", "Standard Edge Analytics", "3-Day Expired Grace Period"] 
                },
                { 
                  id: "pro",
                  name: "Growth Tier", 
                  price: billingCycle === 'monthly' ? "$99" : "$79",
                  conversations: "5,000 conversations / month",
                  priceId: billingCycle === 'monthly' 
                    ? process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_MONTHLY 
                    : (process.env.NEXT_PUBLIC_PADDLE_PRICE_GROWTH_ANNUAL || "pri_01kry9xm1m9k635gk2ebebk0d4"), 
                  features: ["3 WhatsApp Connected Lines", "5,000 AI Conversations/mo", "Priority Core Infrastructure", "Advanced Analytics & Funnels", "3-Day Expired Grace Period"],
                  highlight: true 
                },
                { 
                  id: "enterprise",
                  name: "Scale Tier", 
                  price: billingCycle === 'monthly' ? "$199" : "$159",
                  conversations: "15,000 conversations / month",
                  priceId: billingCycle === 'monthly' 
                    ? process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_MONTHLY 
                    : (process.env.NEXT_PUBLIC_PADDLE_PRICE_SCALE_ANNUAL || "pri_01krya2rd80y5ry5hvkh7d2dw7"), 
                  features: ["Unlimited Connected Numbers", "15,000 AI Conversations/mo", "24/7 Dedicated SLA Support", "Full API Logs Access", "7-Day Expired Grace Period"] 
                }
              ].map((p) => (
                <div 
                  key={p.id} 
                  className={cn(
                    "p-6 rounded-2xl border flex flex-col transition-all relative overflow-hidden group hover:shadow-md hover:border-[#22C55E]/30",
                    p.highlight 
                      ? "border-[#22C55E] bg-[#22C55E]/5 shadow-sm" 
                      : "border-[#E5E7EB] dark:border-[#1F2937] bg-transparent"
                  )}
                >
                  {p.highlight && (
                    <div className="absolute top-0 right-0 bg-[#22C55E] text-white font-extrabold text-[9px] px-3 py-1 rounded-bl-xl uppercase tracking-widest">
                      Popular Choice
                    </div>
                  )}

                  <div className="mb-5">
                    <h4 className="font-extrabold text-[#111827] dark:text-[#F9FAFB] text-base">{p.name}</h4>
                    <p className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wide mt-1">{p.conversations}</p>
                    <div className="mt-3 flex items-baseline">
                      <span className="text-3xl font-black text-[#111827] dark:text-[#F9FAFB]">{p.price}</span>
                      <span className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] ml-1">/ month</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <p className="text-[10px] text-green-500 font-bold mt-1">Billed annually at {p.price === '$39' ? '$468' : p.price === '$79' ? '$948' : '$1,908'}/yr</p>
                    )}
                  </div>
                  
                  <ul className="space-y-3 mb-6 flex-1">
                    {p.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-[11px] text-[#4B5563] dark:text-[#D1D5DB] font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] mt-1.5 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => triggerPaddleCheckout(p.priceId)}
                    disabled={isCheckingOut !== null}
                    className={cn(
                      "w-full h-11 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95",
                      p.highlight
                        ? "bg-[#22C55E] hover:bg-[#16A34A] text-white"
                        : "bg-gray-50 dark:bg-[#1F2937] hover:bg-gray-100 dark:hover:bg-[#283548] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F9FAFB]"
                    )}
                  >
                    {isCheckingOut === p.priceId ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : (
                      sub?.plan_type === p.id ? "Current Activated Plan" : "Deploy Subscription Plan"
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Premium invoice billing history logs card */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
              <h3 className="text-base font-bold text-[#111827] dark:text-[#F9FAFB] tracking-tight">Financial Invoices & History</h3>
              <Badge variant="outline" className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                {(config.payment_history || []).length} Records Discovered
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border-b border-[#E5E7EB] dark:border-[#1F2937]">
                    {["Billing Date", "Invoice ID", "Amount Paid", "Payment Method", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] px-6 py-3.5 uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937]">
                  {(!config.payment_history || config.payment_history.length === 0) ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <p className="text-sm font-medium text-[#6B7280] dark:text-[#9CA3AF]">No payment or transaction records generated yet.</p>
                      </td>
                    </tr>
                  ) : (
                    config.payment_history.map((inv: any, idx: number) => (
                      <tr
                        key={inv.id || idx}
                        className="hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] transition-colors"
                      >
                        <td className="px-6 py-4 text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">
                          {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-medium text-gray-500 dark:text-gray-400">
                          {inv.id?.slice(0, 8)}...
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">
                          ${parseFloat(inv.amount || '0').toFixed(2)} {inv.currency || 'USD'}
                        </td>
                        <td className="px-6 py-4 text-xs font-semibold capitalize text-gray-500 dark:text-gray-400">
                          {inv.payment_method || 'card'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-wider",
                            inv.payment_status === 'paid' 
                              ? "bg-green-500/10 text-green-500 border-green-500/20" 
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          )}>
                            {inv.payment_status || 'unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://sandbox-checkout.paddle.com/receipt/${inv.transaction_id}`, '_blank')}
                            className="text-[10px] font-black text-gray-500 hover:text-[#22C55E] rounded-lg px-2.5 h-8 bg-gray-50 dark:bg-gray-800 hover:bg-[#22C55E]/10"
                          >
                            <Download className="w-3.5 h-3.5 mr-1 shrink-0" />
                            RECEIPT
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ⚠️ Subscription Cancellation Verification Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] p-6 rounded-2xl max-w-md shadow-xl [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 animate-pulse" />
              Cancel Subscription Plan?
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mt-2">
              Are you absolutely sure you want to cancel your current subscription plan?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/10 rounded-xl space-y-2.5">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300 leading-relaxed">
              Upon cancellation, the following system events will occur:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              <li>Your active AI automatic message handlers will immediately pause at the end of the billing anniversary.</li>
              <li>Your workspace will automatically downgrade to the Free Trial limit (1,500 conversations/mo).</li>
              <li>Advanced campaigns, multi-agent logic layers, and custom funnel flows will be restricted.</li>
            </ul>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setCancelDialogOpen(false)}
              className="h-10 px-5 rounded-xl text-xs font-bold border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-gray-700 dark:text-gray-300 hover:bg-[#F3F4F6] dark:hover:bg-[#374151]"
            >
              No, Keep My Plan
            </Button>
            <Button
              onClick={() => {
                setCancelDialogOpen(false);
                handleTerminatePlan();
              }}
              disabled={isPortalLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-5 h-10 rounded-xl font-bold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              {isPortalLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Yes, Cancel Plan"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
