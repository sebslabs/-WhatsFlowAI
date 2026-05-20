"use client";

import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  open: boolean;
  leadName: string | null;
  leadCount?: number;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadDialog({
  open,
  leadName,
  leadCount,
  onClose,
  onConfirm,
}: Props) {
  const isBulk = leadCount !== undefined && leadCount > 1;

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-[#111827]">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-2xl font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">
              {isBulk ? `Delete ${leadCount} Leads?` : "Delete Lead?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7B6B] dark:text-[#9CA3AF] leading-relaxed">
              {isBulk ? (
                <>
                  This will permanently delete <span className="font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">{leadCount}</span> selected lead records 
                  and all associated data. This action cannot be undone.
                </>
              ) : (
                <>
                  This will permanently delete <span className="font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">{leadName}</span>'s record 
                  and all associated data. This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="p-6 bg-[#F8FAF8] dark:bg-[#0B0F1A] border-t border-[#F0F7F0] dark:border-[#1F2937] flex sm:flex-row gap-3">
          <AlertDialogCancel 
            className="flex-1 h-12 rounded-xl border-[#E2EDE2] dark:border-[#1F2937] text-[#6B7B6B] dark:text-[#9CA3AF] font-bold hover:bg-white dark:hover:bg-[#111827] transition-all"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onConfirm();
            }}
            className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all border-none"
          >
            {isBulk ? "Delete Selected" : "Delete Lead"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
