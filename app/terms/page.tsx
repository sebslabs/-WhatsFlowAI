"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingAIWidget } from "@/components/landing/FloatingAIWidget";
import { 
  FileText, 
  HelpCircle, 
  ChevronRight, 
  ShieldAlert, 
  Scale, 
  CreditCard, 
  Layers, 
  BookOpen, 
  Settings, 
  Activity, 
  Mail
} from "lucide-react";

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState("acceptance");

  const sections = [
    { id: "acceptance", name: "1. Acceptance of Terms", icon: BookOpen },
    { id: "accounts-security", name: "2. Account & Security", icon: Layers },
    { id: "service-usage", name: "3. Scope of Service & Usage", icon: Settings },
    { id: "billing-payments", name: "4. Fees, Billing & Upgrades", icon: CreditCard },
    { id: "intellectual-property", name: "5. Intellectual Property", icon: Scale },
    { id: "limitation-liability", name: "6. Liability Disclaimers", icon: ShieldAlert },
    { id: "termination", name: "7. Account Termination", icon: Activity },
    { id: "governing-law", name: "8. Governing Law", icon: Scale },
    { id: "contact-us", name: "9. Contact Information", icon: Mail }
  ];

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 120,
        behavior: "smooth"
      });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800 antialiased">
      <Navbar />
      
      {/* Premium Gradient Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0F1F0F] to-slate-950 pt-36 pb-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(22,163,74,0.15),transparent_45%)]" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-[#16A34A]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16A34A]/10 border border-[#16A34A]/20 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A]">Legal & Compliance</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            Terms of <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#16A34A]">Service</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl font-medium leading-relaxed">
            Please read these terms carefully before accessing or using the WhatsFlow AI platform and developer services.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-400 font-semibold border-t border-slate-800 pt-6">
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A]">Last Updated:</span>
              <span>May 19, 2026</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 self-center hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A]">Entity:</span>
              <span>SEBS (Private) Limited</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Sticky Left Navigation (Desktop) */}
          <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
            <div className="sticky top-28 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-4 px-2">Table of Contents</h3>
              <nav className="space-y-1.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-xl transition-all group font-semibold text-sm ${
                        isActive
                          ? "bg-emerald-50 text-[#16A34A]"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive ? "text-[#16A34A]" : "text-slate-400 group-hover:text-slate-600"
                        }`} />
                        <span>{section.name.split(". ")[1]}</span>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${
                        isActive ? "text-[#16A34A] translate-x-0.5" : "text-slate-300 opacity-0 group-hover:opacity-100"
                      }`} />
                    </button>
                  );
                })}
              </nav>
              
              <div className="mt-8 pt-6 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A]">
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-800">Legal Inquiry?</h4>
                    <p className="text-[11px] text-slate-500 font-semibold">Our counsel replies in 48h.</p>
                  </div>
                </div>
                <a
                  href="mailto:legal@whatsflow.ai"
                  className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-bold transition-colors"
                >
                  Contact Legal Counsel
                </a>
              </div>
            </div>
          </aside>

          {/* Main Prose Content */}
          <div className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-12">
            
            {/* Section 1: Acceptance */}
            <section id="acceptance" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">1. Acceptance of Terms</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  These Terms of Service (&quot;Terms,&quot; &quot;Agreement&quot;) constitute a legally binding contractual agreement between you (the &quot;User,&quot; &quot;Customer,&quot; &quot;Licensee&quot;) and <strong>SEBS (Private) Limited</strong> (&quot;Company,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;), regarding your access and use of the <strong>WhatsFlow AI</strong> platform, website, system APIs, and services (collectively, the &quot;Service&quot;).
                </p>
                <p>
                  By registering an account, integrating WhatsApp channels, or deploying our AI agents, you certify that you have read, understood, and agree to be bound by all aspects of these Terms. If you do not agree to these Terms, you are prohibited from utilizing the platform.
                </p>
              </div>
            </section>

            {/* Section 2: Account & Security */}
            <section id="accounts-security" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">2. Account & Security</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  To unlock the capabilities of WhatsFlow AI, you must register a corporate account. You agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>Provide accurate, complete, and updated information during registration.</li>
                  <li>Maintain the confidentiality of password combinations, access credentials, and system API keys.</li>
                  <li>Notify the Company immediately of any unauthorized account access, credential leaks, or API compromises.</li>
                  <li>Accept total responsibility for all activities, automated flows, and API requests executed under your account.</li>
                </ul>
              </div>
            </section>

            {/* Section 3: Scope of Service & Usage */}
            <section id="service-usage" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Settings className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">3. Scope of Service & Usage</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  WhatsFlow AI provides software-as-a-service automated messaging pipelines, customer lead routing, and natural language artificial intelligence integrations for Meta&apos;s WhatsApp Business API.
                </p>
                <div className="bg-amber-50 border border-amber-200/50 rounded-2xl p-5 mt-4 flex gap-4 text-amber-900 text-sm">
                  <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong className="font-bold block mb-1">Strict Prohibition against Spamming & Abuse:</strong>
                    You agree that you will NOT use the Service to broadcast spam, unsolicited communications, deceptive advertisements, phishing vectors, or violate the official WhatsApp Business Messaging policies. Violation of Meta policies will lead to immediate service suspension without refund.
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: Fees, Billing & Upgrades */}
            <section id="billing-payments" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">4. Fees, Billing & Upgrades</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  The structure of subscription rates, monthly quotas, and payment schedules is governed by the pricing tier chosen during subscription checkout:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>
                    <strong>Billing Cycle:</strong> Subscriptions are processed on a recurring basis (monthly or annually) according to the terms of your chosen tier.
                  </li>
                  <li>
                    <strong>Payment Collection:</strong> Payments are processed via secure payment processors (such as Stripe) using valid corporate credit cards or debit accounts.
                  </li>
                  <li>
                    <strong>Quotas & Overage:</strong> If your team exceeds your plan&apos;s monthly conversational token allowance or lead limit, WhatsFlow AI reserves the right to charge appropriate overage rates or throttle active API routing until your billing plan is updated or renewed.
                  </li>
                  <li>
                    <strong>Refund Terms:</strong> Payments are generally non-refundable except as explicitly stated in our <strong>Refund Policy</strong>.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 5: Intellectual Property */}
            <section id="intellectual-property" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Scale className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">5. Intellectual Property</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  The platform, its design system, visual layouts, backend databases, machine learning integrations, and code assets are the exclusive intellectual property of <strong>SEBS (Private) Limited</strong> and its licensors.
                </p>
                <p>
                  We grant you a non-exclusive, non-transferable, revocable license to access the platform during your active subscription. You agree that you will not copy, clone, reverse engineer, decompile, modify, or create derivative products of our proprietary software.
                </p>
              </div>
            </section>

            {/* Section 6: Liability Disclaimers */}
            <section id="limitation-liability" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">6. Liability Disclaimers</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p className="uppercase font-bold text-xs tracking-wider text-slate-400 mb-2">Important Disclaimer</p>
                <p className="font-semibold text-slate-700">
                  THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTY OF ANY KIND.
                </p>
                <p>
                  To the maximum extent permitted by applicable laws, in no event shall <strong>SEBS (Private) Limited</strong> be liable for any indirect, punitive, incidental, special, consequential, or exemplary damages, including without limitation damages for loss of profits, goodwill, use, data, or other intangible losses, arising from:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm text-slate-500 font-semibold">
                  <li>Your use or inability to use the platform.</li>
                  <li>WhatsApp Business Account blocks, suspensions, or messaging bans imposed by Meta.</li>
                  <li>Erroneous responses or classifications produced by artificial intelligence natural language engines.</li>
                  <li>Data corruption, network transit latency, or database failures outside our direct infrastructure control.</li>
                </ul>
              </div>
            </section>

            {/* Section 7: Account Termination */}
            <section id="termination" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Activity className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">7. Account Termination</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  You are free to terminate your account and cancel your subscription at any time via the billing console in your Settings dashboard.
                </p>
                <p>
                  We reserve the absolute right to suspend or terminate your API access, system account, and software license immediately, without prior warning or liability, if we determine that you have violated these Terms, engaged in fraudulent activities, or engaged in abusive business conduct on connected messaging streams.
                </p>
              </div>
            </section>

            {/* Section 8: Governing Law */}
            <section id="governing-law" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Scale className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">8. Governing Law</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  These Terms of Service and any dispute, controversy, or claim arising out of or related to this agreement, its subject matter, or formation shall be governed by, and construed in accordance with, the laws of the jurisdiction in which <strong>SEBS (Private) Limited</strong> is incorporated, without giving effect to any choice or conflict of law provision.
                </p>
                <p>
                  Any legal suit, action, or proceeding arising out of these Terms shall be instituted exclusively in the competent courts of that jurisdiction.
                </p>
              </div>
            </section>

            {/* Section 9: Contact Information */}
            <section id="contact-us" className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.15),transparent_50%)]" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-3 max-w-lg">
                  <h2 className="text-2xl font-extrabold">Have a Legal or Policy Question?</h2>
                  <p className="text-slate-400 text-sm font-semibold leading-relaxed">
                    If you require specific clarifications, customized corporate service agreements, or have compliance inquiries regarding these Terms of Service, please contact our legal desk directly.
                  </p>
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase bg-white/5 border border-white/10 w-fit px-3 py-1.5 rounded-full mt-4">
                    <FileText className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Official Corporate Agreement Documentation</span>
                  </div>
                </div>
                
                <div className="shrink-0 flex flex-col gap-3">
                  <a
                    href="mailto:legal@whatsflow.ai"
                    className="inline-flex items-center justify-center bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl py-3 px-6 text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
                  >
                    Email: legal@whatsflow.ai
                  </a>
                  <p className="text-[10px] text-slate-500 font-bold text-center uppercase tracking-widest">
                    SEBS (Private) Limited.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
      <FloatingAIWidget />
    </div>
  );
}
