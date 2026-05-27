"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { ArrowRight, Play, Zap, CheckCircle2, Bot, Globe, UserCheck, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const chatSequence = [
  { id: 1, sender: "user", text: "Hi! Do you have any slots left for a cleaning today?", delay: 1000 },
  { id: 2, sender: "ai", text: "Checking our calendar... Yes! We have 4:30 PM available. Would you like to book it?", delay: 2000 },
  { id: 3, sender: "user", text: "Yes please, that works perfectly.", delay: 4000 },
  { id: 4, sender: "ai", text: "Great! Your appointment is confirmed for 4:30 PM. I've sent the confirmation to your phone. ✅", delay: 5000 },
];

export function Hero() {
  const [messages, setMessages] = useState<typeof chatSequence>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sequenceKey, setSequenceKey] = useState(0);

  useEffect(() => {
    let timeouts: NodeJS.Timeout[] = [];
    setMessages([]);
    setIsTyping(false);

    chatSequence.forEach((msg, index) => {
      // Show typing indicator before AI messages
      if (msg.sender === "ai") {
        const typingTimeout = setTimeout(() => {
          setIsTyping(true);
        }, msg.delay - 1000);
        timeouts.push(typingTimeout);
      }

      const msgTimeout = setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [...prev, msg]);
      }, msg.delay);
      timeouts.push(msgTimeout);
    });

    // Reset loop after finish
    const resetTimeout = setTimeout(() => {
      setSequenceKey((k) => k + 1);
    }, 10000);
    timeouts.push(resetTimeout);

    return () => timeouts.forEach(clearTimeout);
  }, [sequenceKey]);

  return (
    <section className="relative min-h-[90vh] lg:min-h-screen flex items-center overflow-hidden bg-[#f0f9f0] pt-20 lg:pt-0" style={{ overflowX: 'hidden' }}>
      {/* Refined Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Main large green glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#dcfce7] rounded-full blur-[120px] opacity-40 mix-blend-multiply" />

        {/* Additional decorative blobs */}
        <div className="absolute -top-[10%] -left-[5%] w-[400px] h-[400px] bg-[#22c55e]/5 rounded-full blur-[80px]" />
        <div className="absolute -bottom-[20%] right-[0%] w-[500px] h-[500px] bg-[#16a34a]/10 rounded-full blur-[100px]" />

        {/* Subtle Mesh/Grid pattern */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02] pointer-events-none" />

        {/* Bottom fading-to-white transition */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">

          {/* Left: Text Content */}
          <div className="flex flex-col gap-8 text-center lg:text-left z-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#dcfce7] text-[#22c55e] text-xs font-bold uppercase tracking-widest border border-[#22c55e]/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
                </span>
                AI-Powered Automation
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-[68px] font-black text-[#0f172a] leading-[1.02] tracking-tighter"
            >
              24/7 AI-Response <br />
              <span className="text-[#22c55e]">For Your Business</span> <br className="hidden xl:block" />
              WhatsApp.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-[#6b7280] leading-relaxed max-w-xl mx-auto lg:mx-0"
            >
              Instantly qualify leads and book appointments around the clock. Win back the revenue you&apos;re losing to slow replies while your team focuses on high-impact work.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              <Link href="/auth/register">
                <Button size="lg" className="bg-[#22c55e] hover:bg-[#16a34a] text-white px-8 h-14 rounded-2xl text-base font-bold shadow-xl shadow-green-500/20 group">
                  Book Your Free Demo
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm font-medium text-[#6b7280]"
            >
              {["No Credit Card", "Setup in 5mins", "3,000+ Teams"].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
                  {item}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right: Modern Animated Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative flex justify-center items-center"
          >
            {/* Background Radial Glow */}
            <div className="absolute -inset-10 bg-[#22c55e]/5 rounded-full blur-[80px]" />

            {/* Main Phone Showcase */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="relative z-10"
            >
              {/* SLIM DEVICE FRAME */}
              <div className="w-[280px] sm:w-[300px] h-[560px] sm:h-[600px] bg-[#0f172a] rounded-[48px] p-2.5 sm:p-3 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border-[5px] sm:border-[6px] border-[#1e293b]">
                <div className="w-full h-full bg-white rounded-[38px] overflow-hidden flex flex-col relative">

                  {/* CHAT HEADER */}
                  <div className="bg-white border-b px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 shrink-0">
                        <img
                          src="/logo-robot.png"
                          alt="Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0f172a]">WhatsFlow AI</p>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Assistant · Online</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MESSAGES AREA */}
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#f8fafc]">
                    <AnimatePresence>
                      {messages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] font-medium leading-relaxed drop-shadow-sm ${msg.sender === "user"
                              ? "bg-white text-[#0f172a] rounded-tr-none border border-gray-100"
                              : "bg-[#22c55e] text-white rounded-tl-none shadow-lg shadow-green-500/10"
                              }`}
                          >
                            {msg.text}
                          </div>
                        </motion.div>
                      ))}

                      {isTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-start"
                        >
                          <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* FLOATING PRODUCT BADGES */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -top-6 -right-12 bg-white px-3 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl hidden sm:flex items-center gap-2 sm:gap-3 border border-gray-50"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 shrink-0">
                  <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5 sm:mb-1">Replied in</p>
                  <p className="text-[11px] sm:text-xs font-extrabold text-[#0f172a]">0.8s Seconds</p>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute top-1/2 -left-16 bg-white px-3 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl hidden sm:flex items-center gap-2 sm:gap-3 border border-gray-50"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                  <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5 sm:mb-1">Lead Status</p>
                  <p className="text-[11px] sm:text-xs font-extrabold text-[#0f172a]">Highly Qualified</p>
                </div>
              </motion.div>

              <motion.div
                animate={{ x: [0, 8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute bottom-12 -right-16 bg-white px-3 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl hidden sm:flex items-center gap-2 sm:gap-3 border border-gray-50"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-600 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider leading-none mb-0.5 sm:mb-1">Appointment</p>
                  <p className="text-[11px] sm:text-xs font-extrabold text-[#0f172a]">Auto-Booked</p>
                </div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                className="absolute -bottom-6 left-0 bg-white px-3 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl hidden sm:flex items-center gap-2 sm:gap-3 border border-gray-100"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                  <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <p className="text-[11px] sm:text-xs font-extrabold text-[#0f172a]">AI Online 24/7</p>
              </motion.div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}

