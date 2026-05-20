"use client";

import { motion } from "framer-motion";
import { Zap, ShieldCheck, BrainCircuit, BarChart3, Users2, Rocket } from "lucide-react";
import { SectionHeaderBlock } from "./SectionHeaderBlock";

const BENEFITS = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Zero Usage Markups",
    desc: "Unlike other platforms that charge 15-35% on top of Meta fees, we charge exactly what Meta charges. Keep more of your revenue."
  },
  {
    icon: <BrainCircuit className="w-6 h-6" />,
    title: "Reasoning AI (Not Keyword Bots)",
    desc: "Our agents use GPT-4o and Claude 3.5 to understand intent, handle complex questions, and close sales, not just reply to keywords."
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: "Integrated CRM & Leads",
    desc: "A full leads management system built directly into your WhatsApp workflow. No need for expensive third-party CRM integrations."
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: "Official Meta Business API",
    desc: "Fully compliant with WhatsApp's policies. No risk of number banning. Direct billing from Meta for maximum transparency."
  },
  {
    icon: <Users2 className="w-6 h-6" />,
    title: "Multi-Agent Handover",
    desc: "Seamlessly transition conversations from AI to your human sales or support team when complex human intervention is needed."
  },
  {
    icon: <Rocket className="w-6 h-6" />,
    title: "Live Product Catalog",
    desc: "Share your products directly in chat. Let customers browse, inquire, and purchase without ever leaving WhatsApp."
  }
];

export function Benefits() {
  return (
    <section className="py-24 bg-white dark:bg-[#111827]">
      <div className="container mx-auto px-6">
        <motion.div 
           initial={{ opacity: 0, y: 20 }}
           whileInView={{ opacity: 1, y: 0 }}
           viewport={{ once: true }}
           className="text-center max-w-3xl mx-auto mb-16"
        >
          <SectionHeaderBlock 
            label="The WhatsFlow Advantage"
            title="Why Choose Us Over Other AI Solutions?" 
            center 
          />
          <p className="text-lg text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed -mt-8">
            We've built the world's most transparent and powerful WhatsApp automation platform, focusing on ROI and deep AI reasoning rather than simple automated replies.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFITS.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-8 rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#0B0F1A] shadow-sm hover:border-[#22C55E]/40 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8FBF0] dark:bg-[#22C55E]/10 flex items-center justify-center mb-6 text-[#16A34A] dark:text-[#22C55E]">
                {benefit.icon}
              </div>
              <h3 className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB] mb-3 tracking-tight">
                {benefit.title}
              </h3>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">
                {benefit.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
