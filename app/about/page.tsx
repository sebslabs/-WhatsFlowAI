"use client";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingAIWidget } from "@/components/landing/FloatingAIWidget";
import { motion } from "framer-motion";
import { MessageCircle, Heart, Users, Target } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white font-sans">
      <Navbar />
      
      <main className="flex-grow pt-32">
        {/* Hero Section */}
        <section className="pb-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#dcfce7] text-[#22c55e] text-xs font-bold uppercase tracking-widest mb-6">
                Our Story
              </span>
              <h1 className="text-5xl md:text-6xl font-black text-[#0f172a] mb-8 font-[family-name:var(--font-sora)] leading-tight">
                Empowering Businesses through <span className="text-[#22c55e]">Conversational AI</span>
              </h1>
              <p className="text-xl text-[#6b7280] leading-relaxed">
                WhatsFlow AI was born from a simple observation: modern businesses were losing millions because they couldn't keep up with the speed of messaging.
              </p>
            </div>
          </div>
        </section>

        {/* Mission & Vision */}
        <section className="bg-[#f8fafc] py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-16">
              <div className="bg-white p-12 rounded-[32px] shadow-sm border border-gray-100">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mb-8">
                  <Heart className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-[#0f172a] mb-6 font-[family-name:var(--font-sora)]">Our Mission</h2>
                <p className="text-lg text-[#6b7280] leading-relaxed font-medium">
                  We are on a mission to bridge the gap between businesses and their customers by providing the most intuitive and high-performing AI automation platform for WhatsApp. We believe in technology that feels human.
                </p>
              </div>
              <div className="bg-white p-12 rounded-[32px] shadow-sm border border-gray-100">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 mb-8">
                  <Target className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-bold text-[#0f172a] mb-6 font-[family-name:var(--font-sora)]">Our Vision</h2>
                <p className="text-lg text-[#6b7280] leading-relaxed font-medium">
                  To become the world&apos;s leading platform for conversational business, where every interaction is instant, meaningful, and results in growth for our partners.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* The Team placeholder */}
        <section className="py-24">
          <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-[#0f172a] mb-16 font-[family-name:var(--font-sora)]">The Minds Behind the Flow</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-12">
              {[
                { name: "Achintha Randev", role: "Co-Founder & CEO" },
                { name: "Kevin Rushdi", role: "Co-Founder & COO" },
                { name: "Thrun De Alwis", role: "CMO" },

              ].map((member) => (
                <div key={member.name} className="group">
                  <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center text-[#22c55e]">
                    <Users className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0f172a] mb-1">{member.name}</h3>
                  <p className="text-[#6b7280] font-bold text-sm uppercase tracking-wider">{member.role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingAIWidget />
    </div>
  );
}
