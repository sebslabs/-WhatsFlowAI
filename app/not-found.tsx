"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Home, ArrowLeft, HelpCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F8FAF8] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.4, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-[10%] left-[10%] w-[45%] h-[45%] bg-[#22c55e]/5 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute -bottom-[10%] right-[15%] w-[45%] h-[45%] bg-[#22c55e]/5 rounded-full blur-[140px]"
        />
      </div>

      <div className="max-w-2xl w-full text-center relative z-10 flex flex-col items-center">
        {/* Animated Robot Illustration */}
        <div className="relative mb-8 w-48 h-48 flex items-center justify-center">
          {/* Outer glowing pulsing circle */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.15, 0.3, 0.15],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-[#22c55e] rounded-full blur-2xl"
          />

          {/* Floating Flow Orbit */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-2 border-2 border-dashed border-[#22c55e]/20 rounded-full"
          />

          {/* Orbiting flow dot */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute inset-2 rounded-full"
          >
            <div className="w-4 h-4 bg-[#22c55e] rounded-full absolute -top-2 left-1/2 -translate-x-1/2 shadow-lg shadow-green-500/50" />
          </motion.div>

          {/* Floating Robot Body */}
          <motion.div
            animate={{
              y: [0, -12, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="relative w-36 h-36 bg-white border border-[#E2EDE2] rounded-[40px] shadow-[0_20px_50px_rgba(34,197,94,0.06)] flex flex-col items-center justify-center p-6"
          >
            {/* Robot Head / Screen */}
            <div className="w-20 h-14 bg-[#0f172a] rounded-2xl relative flex items-center justify-center overflow-hidden border-2 border-[#E2EDE2]">
              {/* Confused / Lost Eyes */}
              <div className="flex gap-4">
                <motion.span
                  animate={{
                    scaleY: [1, 0.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                  className="w-3 h-3 bg-[#22c55e] rounded-full shadow-[0_0_8px_#22c55e]"
                />
                <motion.span
                  animate={{
                    scaleY: [1, 0.1, 1],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatDelay: 2,
                  }}
                  className="w-3 h-3 bg-[#22c55e] rounded-full shadow-[0_0_8px_#22c55e]"
                />
              </div>

              {/* Grid background effect on screen */}
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
            </div>

            {/* Confused badge */}
            <div className="absolute -bottom-3 bg-[#f0fdf4] text-[#22c55e] border border-[#22c55e]/10 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
              404 Lost
            </div>
          </motion.div>
        </div>

        {/* Text Copy */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <h1 className="text-7xl font-black text-[#0f172a] tracking-tight mb-2">
            404
          </h1>
          <h2 className="text-2xl font-extrabold text-[#0f172a] tracking-tight mb-4">
            Flow Connection Lost
          </h2>
          <p className="text-[#64748b] text-base md:text-lg max-w-md mx-auto mb-10 font-medium leading-relaxed">
            Oops! The page you are looking for has drifted out of our automation flow. Let&apos;s get you back on track.
          </p>
        </motion.div>

        {/* Dynamic Interactive CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-sm px-4"
        >
          <Link href="/" className="w-full">
            <Button
              className="w-full h-12 bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-sm shadow-lg shadow-green-500/10 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Return Home
            </Button>
          </Link>
          <button
            onClick={() => window.history.back()}
            className="w-full"
          >
            <Button
              variant="outline"
              className="w-full h-12 border-[#E2EDE2] text-[#0f172a] font-bold text-sm rounded-xl hover:bg-slate-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </button>
        </motion.div>

        {/* Mini Help footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-16 flex items-center gap-6 text-xs font-bold text-slate-500"
        >
          <Link href="/help" className="flex items-center gap-1.5 hover:text-[#22c55e] transition-colors">
            <HelpCircle className="w-3.5 h-3.5" />
            Help Center
          </Link>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <Link href="/contact" className="flex items-center gap-1.5 hover:text-[#22c55e] transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
            Contact Support
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
