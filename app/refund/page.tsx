"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingAIWidget } from "@/components/landing/FloatingAIWidget";
import { 
  HelpCircle, 
  ChevronRight, 
  CreditCard, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  Mail,
  Receipt
} from "lucide-react";

export default function RefundPage() {
  const [activeSection, setActiveSection] = useState("guarantee");

  const sections = [
    { id: "guarantee", name: "1. Money-Back Guarantee", icon: ShieldCheck },
    { id: "eligibility", name: "2. Eligibility Criteria", icon: RotateCcw },
    { id: "cancellations", name: "3. Subscription Cancellations", icon: Calendar },
    { id: "non-refundable", name: "4. Non-Refundable Fees", icon: AlertTriangle },
    { id: "processing", name: "5. Processing & Timelines", icon: Clock },
    { id: "chargebacks", name: "6. Chargeback Protection", icon: CreditCard },
    { id: "how-to-request", name: "7. Requesting a Refund", icon: Receipt },
    { id: "contact-support", name: "8. Support Center", icon: Mail }
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
            <span className="text-xs font-bold uppercase tracking-wider text-[#16A34A]">Billing & Refunds</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6">
            Refund <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-[#16A34A]">Policy</span>
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl max-w-2xl font-medium leading-relaxed">
            Transparent and fair terms for all subscription upgrades, cancellations, and billing questions.
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
                    <h4 className="font-bold text-xs text-slate-800">Billing Inquiry?</h4>
                    <p className="text-[11px] text-slate-500 font-semibold">Average response is under 8h.</p>
                  </div>
                </div>
                <a
                  href="mailto:billing@whatsflow.ai"
                  className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3 text-xs font-bold transition-colors"
                >
                  Contact Billing Support
                </a>
              </div>
            </div>
          </aside>

          {/* Main Prose Content */}
          <div className="col-span-1 lg:col-span-8 xl:col-span-9 space-y-12">
            
            {/* Section 1: Money-Back Guarantee */}
            <section id="guarantee" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">1. Money-Back Guarantee</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  At WhatsFlow AI, operated by <strong>SEBS (Private) Limited</strong>, we strive to build the most advanced and reliable AI-powered WhatsApp lead management system on the market. We want you to be completely satisfied with our service.
                </p>
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-6 mt-6 flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] shrink-0 font-extrabold text-lg shadow-sm border border-emerald-200">
                    30D
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">30-Day Money-Back Guarantee</h3>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      We offer a 100% money-back guarantee for first-time subscription payments on any plan. If you decide that the platform does not suit your business context within 30 days of your initial purchase, you are entitled to a full refund, subject to our eligibility criteria.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2: Eligibility Criteria */}
            <section id="eligibility" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <RotateCcw className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">2. Eligibility Criteria</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  To protect the integrity of our AI compute resources and prevent system exploitation, refunds under the 30-day money-back guarantee are subject to the following fair-use conditions:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-sm">
                  <li>
                    <strong>First-Time Purchases Only:</strong> The guarantee applies solely to your initial account registration and first plan upgrade. Renewal fees, additional tenant allocations, and subsequent package upgrades are not eligible.
                  </li>
                  <li>
                    <strong>Reasonable Usage Limits:</strong> To qualify, your connected WhatsApp channels must not have processed more than 150 total AI-powered message conversations during the billing window.
                  </li>
                  <li>
                    <strong>No Terminated Accounts:</strong> Accounts that have been suspended or terminated due to a violation of our Terms of Service (such as spamming, mass-broadcasting, or API abuse) are completely ineligible for refunds.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 3: Subscription Cancellations */}
            <section id="cancellations" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Calendar className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">3. Subscription Cancellations</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  You are free to cancel your active subscription package at any time:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>
                    <strong>Self-Service:</strong> Cancellations can be performed instantly by clicking the &quot;Cancel Subscription&quot; button inside the billing dashboard settings page.
                  </li>
                  <li>
                    <strong>Period End:</strong> Upon cancellation, your account will remain on the upgraded tier until the conclusion of your current paid billing period (monthly or annual).
                  </li>
                  <li>
                    <strong>Auto-Renewal:</strong> Cancellations must be registered at least 24 hours prior to the upcoming renewal date to avoid automated credit card processing charges.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 4: Non-Refundable Fees */}
            <section id="non-refundable" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">4. Non-Refundable Fees</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  The following service charges are strictly non-refundable:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Conversational Overage</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      Any dynamic pay-as-you-go fees charged for conversation volume exceeding standard monthly quotas.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Custom Development</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      One-time service fees paid for customized AI prompt engineering, custom workflow configuration, or database migration.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">WABA Meta Charges</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      Any charges or messaging fees paid directly to Meta for the operation of your WhatsApp Business Account.
                    </p>
                  </div>
                  <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-sm mb-1">Subsequent Renewals</h4>
                    <p className="text-xs text-slate-500 font-semibold">
                      Recurring billing cycles after the initial 30 days are non-refundable unless resulting from a system processing error.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5: Processing & Timelines */}
            <section id="processing" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Clock className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">5. Processing & Timelines</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Once an official refund application is reviewed and approved by our financial compliance desk, the transaction is processed immediately:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-sm">
                  <li>
                    <strong>Payment Route:</strong> Refunds are credited exclusively to the original credit card, bank account, or Stripe account used to make the purchase. We cannot pay refunds to alternate payment methods.
                  </li>
                  <li>
                    <strong>Stripe/Card Timeline:</strong> While our system triggers the refund instantly, it typically takes <strong>5 to 10 business days</strong> for the merchant bank to post the credit to your statement.
                  </li>
                  <li>
                    <strong>Confirmation:</strong> You will receive an automated transaction receipt via email confirming the refund amount and transaction ID.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 6: Chargeback Protection */}
            <section id="chargebacks" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">6. Chargeback Protection</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  We encourage customers to contact our billing team before initiating any credit card chargebacks. Chargebacks increase processing fees and delay resolution.
                </p>
                <p>
                  If a credit chargeback is filed maliciously, we reserve the right to suspend all active WhatsApp integrations, delete account configurations, and refer the matter to legal collections to recover outstanding transaction amounts.
                </p>
              </div>
            </section>

            {/* Section 7: Requesting a Refund */}
            <section id="how-to-request" className="bg-white border border-slate-100 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
              <div className="absolute top-0 left-0 w-2 h-full bg-[#16A34A] rounded-l-3xl" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-[#16A34A]">
                  <Receipt className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold text-slate-950">7. Requesting a Refund</h2>
              </div>
              <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed space-y-4">
                <p>
                  Filing a refund request is simple and straightforward. Please follow these simple steps:
                </p>
                <div className="mt-6 space-y-4">
                  <div className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] font-bold text-xs shrink-0 mt-0.5">1</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Send an Email</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                        Draft an email to <a href="mailto:billing@whatsflow.ai" className="text-[#16A34A] underline">billing@whatsflow.ai</a> from your registered corporate account email.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] font-bold text-xs shrink-0 mt-0.5">2</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Provide Transaction Details</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                        Include your registered Full Name, Company Name, and the Invoice Number/Transaction ID from your Stripe receipt.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[#16A34A] font-bold text-xs shrink-0 mt-0.5">3</span>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">State Reason for Refund</h4>
                      <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                        Briefly state why you are requesting a refund. Your feedback helps us improve our product features!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 8: Support Center */}
            <section id="contact-support" className="bg-slate-900 text-white rounded-3xl p-8 sm:p-10 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(22,163,74,0.15),transparent_50%)]" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-3 max-w-lg">
                  <h2 className="text-2xl font-extrabold">Have a Billing or Invoice Question?</h2>
                  <p className="text-slate-400 text-sm font-semibold leading-relaxed">
                    If you have received an unexpected charge, need an enterprise invoice, or want to discuss customized billing terms, reach out to our dedicated accounts team.
                  </p>
                  <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase bg-white/5 border border-white/10 w-fit px-3 py-1.5 rounded-full mt-4">
                    <Receipt className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span>Average resolution time: 8 hours</span>
                  </div>
                </div>
                
                <div className="shrink-0 flex flex-col gap-3">
                  <a
                    href="mailto:billing@whatsflow.ai"
                    className="inline-flex items-center justify-center bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl py-3 px-6 text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
                  >
                    Email: billing@whatsflow.ai
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
