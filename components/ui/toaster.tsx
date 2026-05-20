"use client";

import React, { useEffect, useState, forwardRef } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/hooks/use-toast";
import type { ToastItem } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ToastNotification = forwardRef<HTMLDivElement, { toast: ToastItem }>(({ toast }, ref) => {
  const iconMap = {
    success: <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />,
    error: <XCircle className="w-4 h-4 text-red-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 shrink-0" />,
  };

  const bgMap = {
    success: "border-[#16A34A]/30 bg-white",
    error: "border-red-300 bg-white",
    info: "border-blue-300 bg-white",
  };

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg min-w-[280px] max-w-[360px]",
        bgMap[toast.variant]
      )}
    >
      {iconMap[toast.variant]}
      <p className="text-sm font-medium text-[#0F1F0F] flex-1">
        {toast.message}
      </p>
    </motion.div>
  );
});
ToastNotification.displayName = "ToastNotification";

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const store = useToastStore();

  useEffect(() => {
    const unsubscribe = store.subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastNotification key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
