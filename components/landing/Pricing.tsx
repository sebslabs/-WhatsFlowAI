"use client";

import { useState } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { CheckCircle2, ArrowRight, Zap, Sparkles, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { SectionHeaderBlock } from "./SectionHeaderBlock";

const plans = [
  {
    id: "starter",
    icon: Zap,
    name: "Starter",
    tagline: "Perfect for getting started",
    monthlyPrice: 49,
    onetimePrice: 199,
    highlight: false,
    features: [
      "AI WhatsApp replies",
      "Lead qualification",
      "Booking link automation",
      "Google Sheets capture",
      "1 WhatsApp number",
      "1500 AI conversations/mo",
      "Email support",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
  },
  {
    id: "growth",
    icon: Sparkles,
    name: "Growth",
    tagline: "For businesses scaling fast",
    monthlyPrice: 99,
    onetimePrice: 299,
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Starter",
      "3 WhatsApp numbers",
      "5,000 AI conversations/mo",
      "Follow-up automation",
      "Multi-service support",
      "Broadcast campaigns",
      "Analytics dashboard",
      "Priority support",
      "Monthly optimization call",
    ],
    cta: "Get Started",
    ctaVariant: "default" as const,
  },
  {
    id: "scale",
    icon: Building2,
    name: "Scale",
    tagline: "For high-volume operations",
    monthlyPrice: 199,
    onetimePrice: 399,
    highlight: false,
    features: [
      "Everything in Growth",
      "Unlimited WhatsApp numbers",
      "15,000 AI conversations/mo",
      "Custom AI training",
      "White-label option",
      "Dedicated setup call",
      "Priority phone support",
      "SLA guarantee",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
  },
];

const customFeatures = [
  "Unlimited everything",
  "Custom AI model fine-tuning",
  "Dedicated account manager",
  "Custom integrations & API",
  "On-premise deployment option",
  "Custom SLA & uptime guarantee",
  "Team training & onboarding",
  "White-label & reseller rights",
];

export function Pricing() {
  const [billing, setBilling] = useState<"onetime" | "monthly" | "annual">("annual");
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="pricing" className="py-20 bg-[#F0F7F0]" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <SectionHeaderBlock
            label="Pricing"
            title="Simple, Transparent Pricing"
            center
          />
          <p className="text-lg text-[#6B7B6B] mb-8">
            No hidden fees. No surprises. Scale as you grow.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center bg-white border border-[#E2EDE2] rounded-xl p-1 gap-1 shadow-sm flex-wrap justify-center">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                billing === "monthly"
                  ? "bg-[#16A34A] text-white shadow-md shadow-green-500/20"
                  : "text-[#6B7B6B] hover:text-[#0F1F0F]"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                billing === "annual"
                  ? "bg-[#16A34A] text-white shadow-md shadow-green-500/20"
                  : "text-[#6B7B6B] hover:text-[#0F1F0F]"
              }`}
            >
              Annual
            </button>
            <button
              onClick={() => setBilling("onetime")}
              className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                billing === "onetime"
                  ? "bg-[#16A34A] text-white shadow-md shadow-green-500/20"
                  : "text-[#6B7B6B] hover:text-[#0F1F0F]"
              }`}
            >
              One-time
            </button>
          </div>
        </motion.div>

        {/* Plans Grid / Single Card for One-time */}
        {billing === "onetime" ? (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mx-auto mb-12"
          >
            <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-[#16A34A] shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1 text-center md:text-left">
                <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] flex items-center justify-center mb-6 mx-auto md:mx-0">
                  <Building2 className="w-6 h-6 text-[#16A34A]" />
                </div>
                <h3 className="text-2xl font-bold text-[#0F1F0F] mb-3">One-time / Custom Setup</h3>
                <p className="text-[#6B7B6B] text-lg mb-6 max-w-sm">
                  Looking for a permanent solution without monthly fees? Get a fully customized, one-time deployment for your business.
                </p>
                
                <div className="flex flex-col gap-3">
                  <div className="text-3xl font-black text-[#16A34A]">Contact Us</div>
                  <p className="text-sm text-[#6B7B6B]">Custom pricing based on your requirements</p>
                </div>
              </div>

              <div className="w-px h-40 bg-[#E2EDE2] hidden md:block" />

              <div className="flex-1 w-full">
                <h4 className="font-bold text-[#0F1F0F] mb-4 text-sm uppercase tracking-wider">What's included:</h4>
                <ul className="space-y-3 mb-8">
                  {[
                    "Full system implementation",
                    "Custom AI model training",
                    "Infinite conversations",
                    "Priority 24/7 support",
                    "White-label options",
                    "Dedicated infrastructure"
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-[#0F1F0F]">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="mailto:hello@sebs.lk" className="block">
                  <Button className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white py-6 text-lg font-bold rounded-xl shadow-lg shadow-green-500/20">
                    Get a Quote
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
                <p className="text-xs text-[#6B7B6B] text-center mt-3">Usually responds in 2 hours</p>
              </div>

              {/* Decorative background element */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-50 rounded-full blur-3xl opacity-50" />
            </div>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-8">
            {plans.map((plan, i) => {
              const Icon = plan.icon;
              const displayPrice = billing === "annual" 
                ? Math.floor(plan.monthlyPrice * 0.8) 
                : plan.monthlyPrice;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className={`bg-white rounded-2xl p-7 relative overflow-hidden flex flex-col ${
                    plan.highlight
                      ? "border-2 border-[#16A34A] shadow-md bg-green-50/20"
                      : "border border-[#E2EDE2] shadow-sm"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute top-4 right-4 bg-[#16A34A] text-white text-xs font-bold px-3 py-1 rounded-full">
                      {plan.badge}
                    </div>
                  )}

                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-4 ${
                    plan.highlight ? "bg-[#16A34A]" : "bg-[#E8F5E9]"
                  }`}>
                    <Icon className={`w-4 h-4 ${plan.highlight ? "text-white" : "text-[#16A34A]"}`} />
                  </div>

                  <h3 className="text-lg font-bold text-[#0F1F0F] mb-1">{plan.name}</h3>
                  <p className="text-[#6B7B6B] text-sm mb-5">{plan.tagline}</p>

                  <div className="mb-5 relative">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-[#0F1F0F]">
                        ${displayPrice}
                      </span>
                      <span className="text-[#6B7B6B] text-sm">
                        /month
                      </span>
                      {billing === "annual" && (
                        <span className="ml-2 bg-[#DCFCE7] text-[#16A34A] text-[10px] font-black px-2 py-0.5 rounded-full border border-[#16A34A]/10">
                          SAVE 20%
                        </span>
                      )}
                    </div>
                    {billing === "annual" && (
                      <p className="text-xs text-[#16A34A] font-bold mt-1">
                        Billed annually (~${displayPrice * 12}/yr)
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-7 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-[#0F1F0F]">
                        <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link href="/auth/register">
                    {plan.highlight ? (
                      <Button className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white font-bold">
                        {plan.cta}
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full border-[#E2EDE2] hover:border-[#16A34A] hover:text-[#16A34A] font-bold"
                      >
                        {plan.cta}
                      </Button>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Custom / Enterprise card — full width */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="max-w-5xl mx-auto"
        >
          <div className="bg-[#0F1F0F] rounded-2xl p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
            {/* Left */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#16A34A] flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold text-[#16A34A] tracking-widest uppercase">
                  Enterprise / Custom
                </span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Need more than 15,000 conversations?
              </h3>
              <p className="text-[#6B7B6B] text-sm leading-relaxed">
                Custom pricing tailored to your volume, team size, and integration needs.
                White-label, reseller rights, and dedicated infrastructure available.
              </p>
            </div>

            {/* Features grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 flex-1">
              {customFeatures.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm text-[#D1FAE5]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                  {f}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3 shrink-0">
              <div className="text-center">
                <span className="text-3xl font-bold text-white">Custom</span>

              </div>
              <Link href="/contact">
                <Button className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white whitespace-nowrap">
                  Contact Sales
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <p className="text-xs text-[#4B5563] text-center">Reply within 24 hours</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}