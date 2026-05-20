"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Building2, 
  User, 
  Calendar, 
  Sparkles,
  CheckCircle2,
  Loader2,
  Mail,
  Lock,
  Phone,
  AlertCircle,
  Zap,
  ChevronDown,
  Search
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type TabType = "register" | "demo";

const countries = [
  { name: "Sri Lanka", dialCode: "+94", code: "LK", flag: "🇱🇰" },
  { name: "United States", dialCode: "+1", code: "US", flag: "🇺🇸" },
  { name: "Canada", dialCode: "+1", code: "CA", flag: "🇨🇦" },
  { name: "United Kingdom", dialCode: "+44", code: "GB", flag: "🇬🇧" },
  { name: "India", dialCode: "+91", code: "IN", flag: "🇮🇳" },
  { name: "Australia", dialCode: "+61", code: "AU", flag: "🇦🇺" },
  { name: "Singapore", dialCode: "+65", code: "SG", flag: "🇸🇬" },
  { name: "United Arab Emirates", dialCode: "+971", code: "AE", flag: "🇦🇪" },
  { name: "Saudi Arabia", dialCode: "+966", code: "SA", flag: "🇸🇦" },
  { name: "Germany", dialCode: "+49", code: "DE", flag: "🇩🇪" },
  { name: "France", dialCode: "+33", code: "FR", flag: "🇫🇷" },
  { name: "Italy", dialCode: "+39", code: "IT", flag: "🇮🇹" },
  { name: "Spain", dialCode: "+34", code: "ES", flag: "🇪🇸" },
  { name: "Malaysia", dialCode: "+60", code: "MY", flag: "🇲🇾" },
  { name: "New Zealand", dialCode: "+64", code: "NZ", flag: "🇳🇿" },
  { name: "Brazil", dialCode: "+55", code: "BR", flag: "🇧🇷" },
  { name: "South Africa", dialCode: "+27", code: "ZA", flag: "🇿🇦" }
];


export default function RegisterPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("register");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Registration Success State
  const [isRegisterSuccess, setIsRegisterSuccess] = useState(false);
  // Demo Booking Success State
  const [isDemoSuccess, setIsDemoSuccess] = useState(false);
  
  // Billing Toggle State
  const [isYearly, setIsYearly] = useState(true);
  
  // Account Registration State
  const [registerData, setRegisterData] = useState({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
    confirmPassword: "",
    whatsapp: "",
    industry: "",
    otherIndustry: "",
    supportEmail: ""
  });

  // Demo Booking State
  const [bookingData, setBookingData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsapp: "",
    company: "",
    industry: "",
    size: "",
    date: "",
    time: "",
    notes: ""
  });

  // Combined country code phone selector states
  const [regCountryCode, setRegCountryCode] = useState("LK");
  const [regPhoneInput, setRegPhoneInput] = useState("");
  const [bookCountryCode, setBookCountryCode] = useState("LK");
  const [bookPhoneInput, setBookPhoneInput] = useState("");

  // Searchable dropdown state variables
  const [regDropdownOpen, setRegDropdownOpen] = useState(false);
  const [regSearchQuery, setRegSearchQuery] = useState("");
  const [bookDropdownOpen, setBookDropdownOpen] = useState(false);
  const [bookSearchQuery, setBookSearchQuery] = useState("");

  // Handle direct account sign up with Supabase
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (registerData.password !== registerData.confirmPassword) {
      setError("Passwords do not match. Please check both fields.");
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();
      
      const emailRedirect = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

      // Sign up with Supabase, sending user metadata for the DB trigger to provision the workspace automatically
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: registerData.email,
        password: registerData.password,
        options: {
          emailRedirectTo: emailRedirect,
          data: {
            full_name: registerData.fullName,
            organization_name: registerData.companyName,
            whatsapp_number: registerData.whatsapp,
            industry_ecosystem: registerData.industry === 'other' ? registerData.otherIndustry : registerData.industry,
            support_email: registerData.supportEmail,
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setIsSubmitting(false);
        return;
      }

      if (data?.session) {
        localStorage.setItem("isLoggedIn", "true");
        window.location.href = "/dashboard";
      } else {
        setIsRegisterSuccess(true);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during registration.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Demo Booking Form Submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // In a real scenario, you would call your API route here:
      // const response = await fetch('/api/booking', {
      //   method: 'POST',
      //   body: JSON.stringify(bookingData)
      // });
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      console.log("Form Data to be sent to achintha@sebslabs.com:", bookingData);
      setIsDemoSuccess(true);
    } catch (err: any) {
      setError(err?.message || "An error occurred while booking the demo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success screen for direct registration with Pricing / Trial Step
  if (isRegisterSuccess) {
    return (
      <div className="min-h-screen bg-[#F8FAF8] flex flex-col items-center justify-center p-4 py-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mb-6"
        >
          <div className="w-10 h-10 bg-[#F0FDF4] rounded-xl flex items-center justify-center mx-auto mb-3 border border-[#22c55e]/20 shadow-inner">
            <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
          </div>
          <h1 className="text-2xl font-black text-[#0f172a] mb-2 tracking-tight">Almost there! Check your inbox 📬</h1>
          <p className="text-[#64748b] text-sm font-medium max-w-xl mx-auto leading-relaxed">
            Welcome, <span className="text-[#0f172a] font-bold">{registerData.fullName}</span>! Verification link sent to <span className="text-[#22c55e] font-bold underline underline-offset-4">{registerData.email}</span>.
          </p>
          <p className="mt-3 text-xs font-bold text-[#64748b] uppercase tracking-wider flex items-center justify-center gap-2">
            <span className="w-8 h-px bg-slate-200"></span>
            Select your launching track below
            <span className="w-8 h-px bg-slate-200"></span>
          </p>
          
          <div className="flex items-center justify-center mt-6 gap-3">
            <span className={`text-sm font-bold ${!isYearly ? 'text-[#0f172a]' : 'text-slate-400'}`}>Monthly</span>
            <button 
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full bg-[#E2EDE2] transition-colors hover:bg-[#D1E0D1] flex items-center px-1"
            >
              <motion.div 
                layout
                animate={{ x: isYearly ? 28 : 0 }}
                className="w-5 h-5 rounded-full bg-[#22c55e] shadow-md"
              />
            </button>
            <span className={`text-sm font-bold flex items-center gap-1.5 ${isYearly ? 'text-[#0f172a]' : 'text-slate-400'}`}>
              Yearly 
              <span className="bg-[#DCFCE7] text-[#16A34A] text-[9px] font-black px-1.5 py-0.5 rounded-full">SAVE 20%</span>
            </span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-[960px] mx-auto">
          {/* Card 1: Starter */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white border border-slate-200 rounded-[24px] p-5 relative overflow-hidden flex flex-col"
          >
            <div className="mb-4">
              <div className="w-6 h-6 rounded-md bg-[#F0FDF4] flex items-center justify-center mb-2">
                <Zap className="w-3 h-3 text-[#22c55e]" />
              </div>
              <h3 className="text-base font-extrabold text-[#0f172a]">Starter</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Perfect for getting started</p>
            </div>
            <div className="mb-4 border-b border-slate-100 pb-4">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-2xl font-black text-[#0f172a]">${isYearly ? "39" : "49"}</span>
                <span className="text-slate-500 font-medium text-xs">/month</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {isYearly ? "Billed annually (~$468/yr)" : "Billed monthly"}
              </p>
            </div>
            <div className="space-y-2 mb-4 flex-1">
              {[
                "AI WhatsApp replies",
                "Lead qualification",
                "Booking link automation",
                "Google Sheets capture",
                "1 WhatsApp number",
                "1500 AI conversations/mo",
                "Email support"
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-3 w-3 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 leading-tight">{feature}</span>
                </div>
              ))}
            </div>
            <Link href="/auth/login">
              <Button variant="outline" className="w-full h-8 rounded-lg font-bold text-[11px] border-[#E2EDE2] text-[#0f172a] hover:bg-[#F0FDF4] hover:border-[#22c55e] transition-all">
                Start 7-Day Free Trial
              </Button>
            </Link>
          </motion.div>

          {/* Card 2: Growth */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white border-2 border-[#22c55e] rounded-[24px] p-5 relative overflow-hidden shadow-xl shadow-green-500/5 flex flex-col ring-4 ring-[#22c55e]/5"
          >
            <div className="absolute top-4 right-4 bg-[#22c55e] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              Most Popular
            </div>
            
            <div className="mb-4">
              <div className="w-6 h-6 rounded-md bg-[#22c55e] flex items-center justify-center mb-2">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <h3 className="text-base font-extrabold text-[#0f172a]">Growth</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">For businesses scaling fast</p>
            </div>

            <div className="mb-4 border-b border-slate-100 pb-4">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-2xl font-black text-[#0f172a]">${isYearly ? "79" : "99"}</span>
                <span className="text-slate-500 font-medium text-xs">/month</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {isYearly ? "Billed annually (~$948/yr)" : "Billed monthly"}
              </p>
            </div>

            <div className="space-y-2 mb-4 flex-1">
              {[
                "Everything in Starter",
                "3 WhatsApp numbers",
                "5,000 AI conversations/mo",
                "Follow-up automation",
                "Multi-service support",
                "Broadcast campaigns",
                "Analytics dashboard",
                "Priority support",
                "Monthly optimization call"
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-3 w-3 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 leading-tight">{feature}</span>
                </div>
              ))}
            </div>

            <Link href="/auth/login">
              <Button className="w-full h-9 rounded-md text-xs font-bold bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-lg shadow-green-500/20 transition-all group">
                Start 7-Day Free Trial
                <ArrowRight className="w-3 h-3 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>

          {/* Card 3: Scale */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white border border-slate-200 rounded-[24px] p-5 relative overflow-hidden flex flex-col"
          >
            <div className="mb-4">
              <div className="w-6 h-6 rounded-md bg-[#F0FDF4] flex items-center justify-center mb-2">
                <Building2 className="w-3 h-3 text-[#22c55e]" />
              </div>
              <h3 className="text-base font-extrabold text-[#0f172a]">Scale</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">For high-volume operations</p>
            </div>
            
            <div className="mb-4 border-b border-slate-100 pb-4">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-2xl font-black text-[#0f172a]">${isYearly ? "159" : "199"}</span>
                <span className="text-slate-500 font-medium text-xs">/month</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1">
                {isYearly ? "Billed annually (~$1908/yr)" : "Billed monthly"}
              </p>
            </div>

            <div className="space-y-2 mb-4 flex-1">
              {[
                "Everything in Growth",
                "Unlimited WhatsApp numbers",
                "15,000 AI conversations/mo",
                "Custom AI training",
                "White-label option",
                "Dedicated setup call",
                "Priority phone support",
                "SLA guarantee"
              ].map((feature, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="h-3 w-3 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
                  </div>
                  <span className="text-xs font-medium text-slate-700 leading-tight">{feature}</span>
                </div>
              ))}
            </div>

            <Link href="/auth/login">
              <Button variant="outline" className="w-full h-9 rounded-md text-xs font-bold border-[#E2EDE2] text-[#0f172a] hover:bg-[#F0FDF4] hover:border-[#22c55e] transition-all">
                Start 7-Day Free Trial
              </Button>
            </Link>
          </motion.div>
        </div>

        {/* Custom Package Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-4 w-full max-w-[960px] mx-auto bg-[#0B150B] rounded-[24px] p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1D361D] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-[#22c55e]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-0.5">Custom AI model/flow</h3>
              <p className="text-xs text-[#8B9A8B] max-w-lg">
                Need a dedicated AI agent tailored exclusively to your complex operations? We build end-to-end custom models.
              </p>
            </div>
          </div>
          <Button onClick={() => setActiveTab('demo')} className="shrink-0 h-9 px-5 rounded-md text-xs font-bold border-2 border-[#22c55e] text-[#22c55e] hover:bg-[#22c55e] hover:text-white transition-all bg-transparent">
            Contact Sales
          </Button>
        </motion.div>

        <Link href="/" className="mt-6 text-xs font-bold text-slate-500 hover:text-[#0f172a] transition-colors underline underline-offset-4">
          Return to Homepage
        </Link>
      </div>
    );
  }

  // Success screen for demo booking
  if (isDemoSuccess) {
    return (
      <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[40px] p-12 max-w-xl w-full text-center shadow-2xl border border-[#E2EDE2]"
        >
          <div className="w-20 h-20 bg-[#F0FDF4] rounded-3xl flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-10 h-10 text-[#22c55e]" />
          </div>
          <h1 className="text-3xl font-black text-[#0f172a] mb-4">Request Received!</h1>
          <p className="text-[#64748b] text-lg mb-8 leading-relaxed">
            Thank you, <span className="font-bold text-[#0f172a]">{bookingData.firstName}</span>. 
            We&apos;ve received your request and sent a confirmation to <span className="font-bold text-[#0f172a]">{bookingData.email}</span>. 
            Our team will reach out within 24 hours to confirm your session.
          </p>
          <Link href="/">
            <Button className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 h-12 font-bold rounded-xl shadow-lg shadow-green-500/20">
              Return to Homepage
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAF8] flex flex-col items-center justify-center p-4 py-12 relative overflow-x-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[40%] h-[40%] bg-[#22c55e]/5 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] bg-[#22c55e]/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-2xl z-10"
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
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-[#F0FDF4] text-[#22c55e] px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-[#22c55e]/10">
              <Sparkles className="w-3.5 h-3.5" />
              SaaS Automation Platform
            </div>
            <h1 className="text-3xl font-black text-[#0f172a] tracking-tight">
              Get Started with WhatsFlow AI
            </h1>
            <p className="text-[#64748b] mt-2 font-medium">
              Transform your business with AI-driven WhatsApp automation
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex bg-[#F1F5F9] p-1 rounded-2xl mb-8 relative">
            <button
              onClick={() => { setActiveTab("register"); setError(""); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${
                activeTab === "register" ? "text-[#0f172a]" : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <User className="w-4 h-4" />
              Create Account
            </button>
            <button
              onClick={() => { setActiveTab("demo"); setError(""); }}
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300 relative z-10 flex items-center justify-center gap-2 ${
                activeTab === "demo" ? "text-[#0f172a]" : "text-[#64748b] hover:text-[#0f172a]"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Book a Demo
            </button>
            {/* Sliding bubble */}
            <motion.div
              layoutId="tab-bubble"
              className="absolute top-1 bottom-1 rounded-xl bg-white shadow-sm border border-slate-100"
              initial={false}
              animate={{
                left: activeTab === "register" ? "4px" : "50%",
                right: activeTab === "register" ? "50%" : "4px",
              }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          </div>

          {/* Errors */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3 text-red-600 text-sm font-medium mb-6 overflow-hidden"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Forms switcher */}
          <AnimatePresence mode="wait">
            {activeTab === "register" ? (
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegisterSubmit}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name" className="text-sm font-bold text-slate-700">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reg-name"
                        required
                        placeholder="Alex Johnson"
                        value={registerData.fullName}
                        onChange={(e) => setRegisterData({...registerData, fullName: e.target.value})}
                        className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email" className="text-sm font-bold text-slate-700">Work Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reg-email"
                        required
                        type="email"
                        placeholder="alex@company.com"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                        className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="text-sm font-bold text-slate-700">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reg-password"
                        required
                        type="password"
                        placeholder="••••••••"
                        value={registerData.password}
                        onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                        className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="reg-confirm-password" className="text-sm font-bold text-slate-700">Confirm Password</Label>
                      {registerData.confirmPassword && (
                        <span className={`text-[10px] uppercase tracking-wider font-black flex items-center gap-1 transition-all ${
                          registerData.password === registerData.confirmPassword ? 'text-green-600' : 'text-red-500 animate-pulse'
                        }`}>
                          {registerData.password === registerData.confirmPassword ? (
                            <>Match <Check className="w-3 h-3" /></>
                          ) : (
                            <>No Match <AlertCircle className="w-3 h-3" /></>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <ShieldCheck className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-300 ${
                        !registerData.confirmPassword 
                          ? 'text-slate-400' 
                          : registerData.password === registerData.confirmPassword 
                            ? 'text-green-500' 
                            : 'text-red-400'
                      }`} />
                      <Input
                        id="reg-confirm-password"
                        required
                        type="password"
                        placeholder="••••••••"
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                        className={`h-12 pl-11 border-[#E2EDE2] font-medium rounded-xl transition-all duration-300 ${
                          !registerData.confirmPassword 
                            ? 'bg-slate-50/20 focus:border-[#22c55e] focus:ring-[#22c55e]/10' 
                            : registerData.password === registerData.confirmPassword 
                              ? 'border-green-300 bg-green-50/30 ring-4 ring-green-500/5 focus:border-green-500 focus:ring-green-500/20' 
                              : 'border-red-300 bg-red-50/30 ring-4 ring-red-500/5 focus:border-red-500 focus:ring-red-500/20'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="py-2">
                  <div className="border-t border-slate-100 my-2"></div>
                  <h3 className="text-xs font-black text-[#22c55e] uppercase tracking-wider mb-4">Foundational Business Identity</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-company" className="text-sm font-bold text-slate-700">Business Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reg-company"
                        required
                        placeholder="Acme Inc."
                        value={registerData.companyName}
                        onChange={(e) => setRegisterData({...registerData, companyName: e.target.value})}
                        className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-industry" className="text-sm font-bold text-slate-700">Industry Ecosystem</Label>
                    <Select required onValueChange={(val) => setRegisterData({...registerData, industry: val})}>
                      <SelectTrigger id="reg-industry" className="h-12 border-[#E2EDE2] focus:border-[#22c55e] bg-slate-50/20 font-medium rounded-xl">
                        <SelectValue placeholder="Select Ecosystem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="saas">SaaS / Software</SelectItem>
                        <SelectItem value="healthcare">Health & Medical</SelectItem>
                        <SelectItem value="real-estate">Real Estate</SelectItem>
                        <SelectItem value="retail">Retail & Logistics</SelectItem>
                        <SelectItem value="hospitality">Hospitality</SelectItem>
                        <SelectItem value="finance">FinTech / Finance</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                        <SelectItem value="other">Other Services / Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <AnimatePresence>
                  {registerData.industry === 'other' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2 pb-4">
                        <Label htmlFor="reg-industry-other" className="text-sm font-bold text-slate-700">Please Specify Industry</Label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#22c55e]" />
                          <Input
                            id="reg-industry-other"
                            required
                            placeholder="e.g., Agriculture, Construction, Logistics"
                            value={registerData.otherIndustry}
                            onChange={(e) => setRegisterData({...registerData, otherIndustry: e.target.value})}
                            className="h-12 pl-11 border-[#22c55e]/30 focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-[#F0FDF4]/20 font-medium rounded-xl transition-colors"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-whatsapp" className="text-sm font-bold text-slate-700">WhatsApp Number</Label>
                    <div className="flex gap-2">
                      <div className="w-[120px] shrink-0 relative">
                        <button
                          type="button"
                          onClick={() => setRegDropdownOpen(!regDropdownOpen)}
                          className="h-12 border border-[#E2EDE2] hover:border-[#22c55e] focus:outline-none focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/5 bg-slate-50/20 font-bold rounded-xl px-2.5 flex items-center justify-between gap-1 shadow-sm w-full transition-all text-left"
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <img 
                              src={`https://flagcdn.com/w40/${regCountryCode.toLowerCase()}.png`} 
                              alt=""
                              className="w-5 h-3.5 object-cover rounded shrink-0 shadow-sm border border-slate-100"
                            />
                            <span className="font-extrabold text-slate-700 text-sm">
                              {countries.find(c => c.code === regCountryCode)?.dialCode || "+94"}
                            </span>
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>

                        {regDropdownOpen && (
                          <>
                            <div 
                              className="fixed inset-0 z-[9998]" 
                              onClick={() => {
                                setRegDropdownOpen(false);
                                setRegSearchQuery("");
                              }}
                            />
                            <div className="absolute top-[52px] left-0 w-[260px] bg-white border border-slate-200 shadow-xl rounded-2xl z-[9999] p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                              <div className="relative shrink-0">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="text"
                                  placeholder="Search country or code..."
                                  value={regSearchQuery}
                                  onChange={(e) => setRegSearchQuery(e.target.value)}
                                  className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/5 font-medium rounded-lg"
                                  autoFocus
                                />
                              </div>

                              <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
                                {countries
                                  .filter(c => 
                                    c.name.toLowerCase().includes(regSearchQuery.toLowerCase()) || 
                                    c.dialCode.includes(regSearchQuery) ||
                                    c.code.toLowerCase().includes(regSearchQuery.toLowerCase())
                                  )
                                  .map((c) => (
                                    <button
                                      key={`reg-custom-${c.code}`}
                                      type="button"
                                      onClick={() => {
                                        setRegCountryCode(c.code);
                                        setRegisterData({
                                          ...registerData,
                                          whatsapp: `${c.dialCode}${regPhoneInput.replace(/\D/g, '')}`
                                        });
                                        setRegDropdownOpen(false);
                                        setRegSearchQuery("");
                                      }}
                                      className={`w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors text-left ${
                                        regCountryCode === c.code 
                                          ? "bg-[#22c55e]/10 text-[#16a34a]" 
                                          : "text-slate-700 hover:bg-slate-50"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <img 
                                          src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} 
                                          alt=""
                                          className="w-5 h-3.5 object-cover rounded shrink-0 shadow-sm border border-slate-100"
                                        />
                                        <span className="truncate">{c.name}</span>
                                      </span>
                                      <span className="font-extrabold text-slate-500 shrink-0">{c.dialCode}</span>
                                    </button>
                                  ))}
                                {countries.filter(c => 
                                  c.name.toLowerCase().includes(regSearchQuery.toLowerCase()) || 
                                  c.dialCode.includes(regSearchQuery) ||
                                  c.code.toLowerCase().includes(regSearchQuery.toLowerCase())
                                ).length === 0 && (
                                  <div className="text-center py-4 text-xs font-bold text-slate-400">
                                    No results found
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="relative flex-1">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          id="reg-whatsapp"
                          required
                          type="tel"
                          placeholder="712345678"
                          value={regPhoneInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setRegPhoneInput(val);
                            const selected = countries.find(c => c.code === regCountryCode);
                            if (selected) {
                              setRegisterData({
                                ...registerData,
                                whatsapp: `${selected.dialCode}${val}`
                              });
                            }
                          }}
                          className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl shadow-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-support-email" className="text-sm font-bold text-slate-700">Support Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="reg-support-email"
                        required
                        type="email"
                        placeholder="support@company.com"
                        value={registerData.supportEmail}
                        onChange={(e) => setRegisterData({...registerData, supportEmail: e.target.value})}
                        className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-[#F8FAF8] border border-[#E2EDE2] rounded-xl p-4 flex gap-3 mt-6">
                  <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-[#64748b] leading-tight">
                    By signing up, you agree to our 
                    <Link href="/terms" className="font-bold text-[#22c55e] hover:underline mx-1">Terms of Service</Link>
                    and
                    <Link href="/privacy" className="font-bold text-[#22c55e] hover:underline mx-1">Privacy Policy</Link>.
                  </p>
                </div>

                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-14 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-base shadow-lg shadow-green-500/10 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Your Free Workspace
                      <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </motion.form>
            ) : (
              <motion.form
                key="booking-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleBookingSubmit}
                className="space-y-6"
              >
                {/* Section 1: Client Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <User className="w-4 h-4 text-[#22c55e]" />
                    </div>
                    <h2 className="font-bold text-[#0f172a] text-base">Contact Information</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-first">First name</Label>
                      <Input
                        id="book-first"
                        required
                        placeholder="Alex"
                        value={bookingData.firstName}
                        onChange={(e) => setBookingData({...bookingData, firstName: e.target.value})}
                        className="h-12 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="book-last">Last name</Label>
                      <Input
                        id="book-last"
                        required
                        placeholder="Johnson"
                        value={bookingData.lastName}
                        onChange={(e) => setBookingData({...bookingData, lastName: e.target.value})}
                        className="h-12 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-email">Work email</Label>
                      <Input
                        id="book-email"
                        required
                        type="email"
                        placeholder="alex@company.com"
                        value={bookingData.email}
                        onChange={(e) => setBookingData({...bookingData, email: e.target.value})}
                        className="h-12 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="book-whatsapp">WhatsApp Number</Label>
                      <div className="flex gap-2">
                        <div className="w-[120px] shrink-0 relative">
                          <button
                            type="button"
                            onClick={() => setBookDropdownOpen(!bookDropdownOpen)}
                            className="h-12 border border-[#E2EDE2] hover:border-[#22c55e] focus:outline-none focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/5 bg-slate-50/20 font-bold rounded-xl px-2.5 flex items-center justify-between gap-1 shadow-sm w-full transition-all text-left"
                          >
                            <span className="flex items-center gap-1.5 min-w-0">
                              <img 
                                src={`https://flagcdn.com/w40/${bookCountryCode.toLowerCase()}.png`} 
                                alt=""
                                className="w-5 h-3.5 object-cover rounded shrink-0 shadow-sm border border-slate-100"
                              />
                              <span className="font-extrabold text-slate-700 text-sm">
                                {countries.find(c => c.code === bookCountryCode)?.dialCode || "+94"}
                              </span>
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </button>

                          {bookDropdownOpen && (
                            <>
                              <div 
                                className="fixed inset-0 z-[9998]" 
                                onClick={() => {
                                  setBookDropdownOpen(false);
                                  setBookSearchQuery("");
                                }}
                              />
                              <div className="absolute top-[52px] left-0 w-[260px] bg-white border border-slate-200 shadow-xl rounded-2xl z-[9999] p-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                                <div className="relative shrink-0">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search country or code..."
                                    value={bookSearchQuery}
                                    onChange={(e) => setBookSearchQuery(e.target.value)}
                                    className="w-full h-9 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#22c55e] focus:ring-4 focus:ring-[#22c55e]/5 font-medium rounded-lg"
                                    autoFocus
                                  />
                                </div>

                                <div className="max-h-[200px] overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
                                  {countries
                                    .filter(c => 
                                      c.name.toLowerCase().includes(bookSearchQuery.toLowerCase()) || 
                                      c.dialCode.includes(bookSearchQuery) ||
                                      c.code.toLowerCase().includes(bookSearchQuery.toLowerCase())
                                    )
                                    .map((c) => (
                                      <button
                                        key={`book-custom-${c.code}`}
                                        type="button"
                                        onClick={() => {
                                          setBookCountryCode(c.code);
                                          setBookingData({
                                            ...bookingData,
                                            whatsapp: `${c.dialCode}${bookPhoneInput.replace(/\D/g, '')}`
                                          });
                                          setBookDropdownOpen(false);
                                          setBookSearchQuery("");
                                        }}
                                        className={`w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold rounded-lg transition-colors text-left ${
                                          bookCountryCode === c.code 
                                            ? "bg-[#22c55e]/10 text-[#16a34a]" 
                                            : "text-slate-700 hover:bg-slate-50"
                                        }`}
                                      >
                                        <span className="flex items-center gap-2 min-w-0">
                                          <img 
                                            src={`https://flagcdn.com/w40/${c.code.toLowerCase()}.png`} 
                                            alt=""
                                            className="w-5 h-3.5 object-cover rounded shrink-0 shadow-sm border border-slate-100"
                                          />
                                          <span className="truncate">{c.name}</span>
                                        </span>
                                        <span className="font-extrabold text-slate-500 shrink-0">{c.dialCode}</span>
                                      </button>
                                    ))}
                                  {countries.filter(c => 
                                    c.name.toLowerCase().includes(bookSearchQuery.toLowerCase()) || 
                                    c.dialCode.includes(bookSearchQuery) ||
                                    c.code.toLowerCase().includes(bookSearchQuery.toLowerCase())
                                  ).length === 0 && (
                                    <div className="text-center py-4 text-xs font-bold text-slate-400">
                                      No results found
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="relative flex-1">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <Input
                            id="book-whatsapp"
                            required
                            type="tel"
                            placeholder="712345678"
                            value={bookPhoneInput}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              setBookPhoneInput(val);
                              const selected = countries.find(c => c.code === bookCountryCode);
                              if (selected) {
                                setBookingData({
                                  ...bookingData,
                                  whatsapp: `${selected.dialCode}${val}`
                                });
                              }
                            }}
                            className="h-12 pl-11 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl shadow-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Business Details */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-[#22c55e]" />
                    </div>
                    <h2 className="font-bold text-[#0f172a] text-base">Business Details</h2>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="book-company">Company Name</Label>
                    <Input
                      id="book-company"
                      required
                      placeholder="Acme Inc."
                      value={bookingData.company}
                      onChange={(e) => setBookingData({...bookingData, company: e.target.value})}
                      className="h-12 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-industry">Industry</Label>
                      <Select onValueChange={(val) => setBookingData({...bookingData, industry: val})}>
                        <SelectTrigger className="h-12 border-[#E2EDE2] bg-slate-50/20 font-medium rounded-xl">
                          <SelectValue placeholder="Select industry" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ecommerce">E-commerce</SelectItem>
                          <SelectItem value="saas">SaaS / Software</SelectItem>
                          <SelectItem value="fintech">FinTech / Finance</SelectItem>
                          <SelectItem value="real-estate">Real Estate</SelectItem>
                          <SelectItem value="retail">Retail & Logistics</SelectItem>
                          <SelectItem value="hospitality">Hospitality & Tourism</SelectItem>
                          <SelectItem value="healthcare">Healthcare</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="agency">Marketing Agency</SelectItem>
                          <SelectItem value="services">Professional Services</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="book-size">Company Size</Label>
                      <Select onValueChange={(val) => setBookingData({...bookingData, size: val})}>
                        <SelectTrigger className="h-12 border-[#E2EDE2] bg-slate-50/20 font-medium rounded-xl">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 employees</SelectItem>
                          <SelectItem value="11-50">11-50 employees</SelectItem>
                          <SelectItem value="51-200">51-200 employees</SelectItem>
                          <SelectItem value="201-500">201-500 employees</SelectItem>
                          <SelectItem value="500+">500+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Preferences */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#22c55e]" />
                    </div>
                    <h2 className="font-bold text-[#0f172a] text-base">Preferred Schedule</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="book-date">Available Date</Label>
                      <Input
                        id="book-date"
                        required
                        type="date"
                        value={bookingData.date}
                        onChange={(e) => setBookingData({...bookingData, date: e.target.value})}
                        className="h-12 border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="book-time">Preferred Time Slot (UTC)</Label>
                      <Select onValueChange={(val) => setBookingData({...bookingData, time: val})}>
                        <SelectTrigger className="h-12 border-[#E2EDE2] bg-slate-50/20 font-medium rounded-xl">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Morning (9 AM - 12 PM)</SelectItem>
                          <SelectItem value="afternoon">Afternoon (12 PM - 4 PM)</SelectItem>
                          <SelectItem value="evening">Evening (4 PM - 7 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="book-notes">Specific Requirements or Questions</Label>
                    <Textarea
                      id="book-notes"
                      placeholder="Tell us about your current challenges..."
                      value={bookingData.notes}
                      onChange={(e) => setBookingData({...bookingData, notes: e.target.value})}
                      className="min-h-[100px] border-[#E2EDE2] focus:border-[#22c55e] focus:ring-[#22c55e]/10 bg-slate-50/20 font-medium py-3 rounded-xl"
                    />
                  </div>
                </div>

                <div className="bg-[#F8FAF8] border border-[#E2EDE2] rounded-xl p-4 flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3 h-3 text-white" />
                  </div>
                  <p className="text-xs text-[#64748b] leading-tight">
                    Our team will contact you within 24 hours to confirm your demo slot. By booking, you agree to our 
                    <Link href="/terms" className="font-bold text-[#22c55e] hover:underline mx-1">Terms</Link>
                    and
                    <Link href="/privacy" className="font-bold text-[#22c55e] hover:underline mx-1">Privacy Policy</Link>.
                  </p>
                </div>

                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-14 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-base shadow-lg shadow-green-500/10 rounded-2xl transition-all active:scale-[0.98] group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm Demo Booking Request
                      <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Alternate Link */}
          <p className="text-center mt-8 text-sm text-[#64748b]">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-bold text-[#22c55e] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Trust micro-copy */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 opacity-60 grayscale transition-all hover:grayscale-0 z-10">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <Check className="w-3 h-3 text-[#22c55e]" />
          No credit card required
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <Check className="w-3 h-3 text-[#22c55e]" />
          Instant Access
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f172a]">
          <Check className="w-3 h-3 text-[#22c55e]" />
          Bank-Level Security
        </div>
      </div>

      {/* Footer link */}
      <p className="mt-8 text-xs text-slate-400 relative z-10">
        © 2026 WhatsFlow AI · All rights reserved.
      </p>
    </div>
  );
}
