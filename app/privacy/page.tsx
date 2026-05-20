"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingAIWidget } from "@/components/landing/FloatingAIWidget";
import { 
  Shield, 
  Eye, 
  Lock, 
  Database, 
  Mail, 
  ChevronRight, 
  Building,
  UserCheck,
  Server,
  Globe,
  FileText,
  HelpCircle
} from "lucide-react";

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("introduction");

  const sections = [
    { id: "introduction", name: "1. Introduction", icon: Shield },
    { id: "information-collection", name: "2. Information We Collect", icon: Database },
    { id: "how-we-use", name: "3. How We Use Information", icon: Eye },
    { id: "whatsapp-api", name: "4. WhatsApp API Specifics", icon: Server },
    { id: "data-security", name: "5. Data Security & Storage", icon: Lock },
    { id: "user-rights", name: "6. Your Privacy Rights", icon: UserCheck },
    { id: "compliance", name: "7. Regulatory Compliance", icon: Globe },
    { id: "contact-us", name: "8. Contact Support", icon: Mail }
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
            <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A]">Trust & Safety Hub</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#16A34A]">Policy</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl font-medium leading-relaxed">
            At WhatsFlow AI, your data privacy is our absolute priority. Learn how we handle, process, and safeguard your and your customers&apos; information.
          </p>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-400 font-semibold border-t border-slate-800 pt-6">
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A]">Effective Date:</span>
              <span>May 19, 2026</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-slate-700 self-center hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-[#16A34A]">Version:</span>
              <span>v2.1 (GDPR & CCPA Compliant)</span>
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
                    <h4 className="font-bold text-xs text-slate-800">Need Assistance?</h4>
                    <p className="text-[11px] text-slate-500 font-semibold">We answer within 24h.</p>
                  </div>
                </div>
                <a
                  href="mailto:privacy@whatsflow.ai"
                  className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-bold transition-colors"
                >
                  Contact Privacy Team
                </a>
              </div>
            </div>
          </aside>

          {/* Main Prose Content */}
          <div className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-12">
            
            {/* Section 1: Introduction */}
            <section id="introduction" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Shield className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">1. Introduction</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Welcome to <strong>WhatsFlow AI</strong>. WhatsFlow AI (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is operated by <strong>SEBS (Private) Limited</strong>. We respect your privacy and are committed to protecting the personal data of our users, partners, and their end-customers.
                </p>
                <p>
                  This Privacy Policy describes how we collect, use, store, process, and share your personal data when you use the WhatsFlow AI platform, our website (whatsflow.ai), and all associated tools, integrations, and services (collectively, the &quot;Service&quot;).
                </p>
                <p>
                  By accessing or using our Service, you agree to the collection and use of information in accordance with this Privacy Policy. If you do not agree with any terms of this policy, please do not use our Service.
                </p>
              </div>
            </section>

            {/* Section 2: Information We Collect */}
            <section id="information-collection" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Database className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">2. Information We Collect</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-6">
                <p>
                  We collect several different types of information for various purposes to provide and improve our Service to you.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50">
                    <h3 className="font-bold text-slate-900 mb-3 text-base flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#16A34A]" /> Account & Personal Data
                    </h3>
                    <p className="text-sm text-slate-600">
                      While registering on WhatsFlow AI, we may collect personally identifiable information that can be used to contact or identify you, including:
                    </p>
                    <ul className="list-disc pl-5 mt-2 text-xs space-y-1 text-slate-500 font-semibold">
                      <li>Full name and job title</li>
                      <li>Business email address and phone number</li>
                      <li>Company details and corporate structure</li>
                      <li>Billing address and payment processor tokens</li>
                    </ul>
                  </div>

                  <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50">
                    <h3 className="font-bold text-slate-900 mb-3 text-base flex items-center gap-2">
                      <Building className="w-4 h-4 text-[#16A34A]" /> Business Context & Integrations
                    </h3>
                    <p className="text-sm text-slate-600">
                      To operationalize your automated flows, we ingest operational context which includes:
                    </p>
                    <ul className="list-disc pl-5 mt-2 text-xs space-y-1 text-slate-500 font-semibold">
                      <li>WhatsApp Business Account (WABA) credentials</li>
                      <li>Meta developer credentials and access keys</li>
                      <li>System prompts, lead parameters, and custom guidelines</li>
                      <li>API keys for third-party CRMs and ERP systems</li>
                    </ul>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl p-5 bg-slate-50 mt-6">
                  <h3 className="font-bold text-slate-900 mb-3 text-base flex items-center gap-2">
                    <Server className="w-4 h-4 text-[#16A34A]" /> End-Customer Communications & Metadata
                  </h3>
                  <p className="text-sm text-slate-600">
                    As an AI-powered conversational agent, we temporarily process messaging streams flowing through your connected WhatsApp channels. This includes:
                  </p>
                  <ul className="list-disc pl-5 mt-2 text-xs space-y-1 text-slate-500 font-semibold">
                    <li>Incoming message content (text, media, interactive responses)</li>
                    <li>End-customer phone numbers, display names, and locale</li>
                    <li>Message delivery statuses, timestamp, and read receipts</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3: How We Use Information */}
            <section id="how-we-use" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Eye className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">3. How We Use Information</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  WhatsFlow AI processes your data to deliver, optimize, and secure our automated lead management experience:
                </p>
                <div className="space-y-4 mt-6">
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] shrink-0 font-bold text-xs">1</div>
                    <p className="text-slate-600 text-sm">
                      <strong>AI Agent Training & Processing:</strong> To enable LLMs (Large Language Models) to autonomously converse with and classify leads coming through your WhatsApp Business line in accordance with your guidelines.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] shrink-0 font-bold text-xs">2</div>
                    <p className="text-slate-600 text-sm">
                      <strong>Platform Optimization:</strong> To monitor and analyze system interactions, resolve processing latency, and enhance overall natural language model performance.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] shrink-0 font-bold text-xs">3</div>
                    <p className="text-slate-600 text-sm">
                      <strong>Billing & Access Control:</strong> To administer active subscriptions, calculate usage statistics (AI conversation counts), and prevent fraudulent service exploits.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] shrink-0 font-bold text-xs">4</div>
                    <p className="text-slate-600 text-sm">
                      <strong>Communications:</strong> To send account notifications, system updates, security advisories, and relevant marketing updates (subject to opt-out preferences).
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4: WhatsApp API Specifics */}
            <section id="whatsapp-api" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Server className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">4. WhatsApp API Specifics</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Our system connects with Meta&apos;s cloud API services. Please note:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-sm">
                  <li>
                    <strong>Terms Alignment:</strong> By utilizing our integration, you agree to remain compliant with the WhatsApp Business Terms of Service and Developer Policies.
                  </li>
                  <li>
                    <strong>Temporary Storage:</strong> Customers&apos; chat histories are treated as ephemeral. We store individual text blocks exclusively for dynamic context loading needed for AI prompt formation and display within your private customer dashboard.
                  </li>
                  <li>
                    <strong>No Data Brokerage:</strong> We do not sell, rent, or lease your customer communication records, telephone indexes, or conversation histories to any third-party marketing, analytics, or broker corporations.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 5: Data Security & Storage */}
            <section id="data-security" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">5. Data Security & Storage</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  We implement robust enterprise security measures to protect your database assets:
                </p>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 mt-6">
                  <div className="flex items-start gap-3">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-[#16A34A] rounded-full uppercase shrink-0 mt-0.5">TLS 1.3</span>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      All connection states and messaging pipelines between your WhatsApp accounts, the Meta servers, and the WhatsFlow platform are fully encrypted using modern TLS 1.3 protocol.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-[#16A34A] rounded-full uppercase shrink-0 mt-0.5">AES-256</span>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Sensitive API authorization credentials, database keys, and configuration secrets are fully encrypted at rest inside our system database cluster utilizing Advanced Encryption Standard (AES-256).
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="inline-block px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-[#16A34A] rounded-full uppercase shrink-0 mt-0.5">SUPABASE SSO</span>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      Secure authentication is handled with strict JSON Web Tokens (JWT) and multi-tenant isolation patterns, ensuring that no tenant can ever cross-read data outside their own environment.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 6: Your Privacy Rights */}
            <section id="user-rights" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">6. Your Privacy Rights</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Depending on your physical residency jurisdiction, you are entitled to several statutory privacy entitlements concerning your personal records:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Right to Access & Rectify</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      You can request copies of your stored personal details and correct any inaccurate information at any time.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Right to Erasure (&quot;Right to be Forgotten&quot;)</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      You have the right to request the complete deletion of your profile metadata and associated WhatsApp logs from our storage servers.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Right to Object & Restrict</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      You can restrict how we process your business data and opt-out of automated user profiling.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Right to Data Portability</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      You are entitled to export your configuration parameters and chat history archives in structured JSON or CSV format.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 7: Regulatory Compliance */}
            <section id="compliance" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Globe className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">7. Regulatory Compliance</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Our services are engineered from the ground up to respect primary international regulatory standards:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>
                    <strong>GDPR (European Union):</strong> We act as the Data Processor for incoming WhatsApp customer records under the General Data Protection Regulation. All processing activities adhere strictly to the Data Processing Addendum (DPA) signed by our users.
                  </li>
                  <li>
                    <strong>CCPA/CPRA (California):</strong> We do not sell or exchange California consumer records for commercial gains, maintaining compliance with California privacy protections.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 8: Contact Support */}
            <section id="contact-us" className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.15),transparent_50%)]" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-3 max-w-lg">
                  <h2 className="text-2xl font-extrabold">Got Questions About Your Privacy?</h2>
                  <p className="text-slate-400 text-sm font-semibold leading-relaxed">
                    Our compliance team and dedicated Data Protection Officer (DPO) are available to answer your questions or handle individual data protection request filings.
                  </p>
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase bg-white/5 border border-white/10 w-fit px-3 py-1.5 rounded-full mt-4">
                    <Mail className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Response under 24 business hours</span>
                  </div>
                </div>
                
                <div className="shrink-0 flex flex-col gap-3">
                  <a
                    href="mailto:privacy@whatsflow.ai"
                    className="inline-flex items-center justify-center bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl py-3 px-6 text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
                  >
                    Email: privacy@whatsflow.ai
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
