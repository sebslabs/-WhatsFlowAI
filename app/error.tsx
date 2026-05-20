"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Uncaught application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0F1A] flex flex-col items-center justify-center p-6 text-center select-none antialiased">
      <div className="max-w-md bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-8 rounded-2xl shadow-xl space-y-4">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-center text-red-500 text-xl font-bold mx-auto mb-2">
          ⚠️
        </div>
        <h1 className="text-xl font-black text-[#111827] dark:text-[#F9FAFB] tracking-tight">
          Something went wrong
        </h1>
        <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed max-w-xs mx-auto">
          We encountered an unexpected error while rendering this page.
        </p>
        <div className="p-3 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl text-left select-all overflow-hidden max-w-sm">
          <p className="text-[10px] text-red-500 font-mono tracking-tight font-bold break-words leading-relaxed">
            {error?.message || "Unknown Application Exception"}
          </p>
        </div>
        <div className="pt-2">
          <Button
            onClick={() => reset()}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white px-6 h-11 rounded-xl font-bold transition-all shadow-md active:scale-95"
          >
            Attempt recovery
          </Button>
        </div>
      </div>
    </div>
  );
}
