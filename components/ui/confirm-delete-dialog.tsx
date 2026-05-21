import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  onConfirm: () => Promise<void> | void;
  title?: string;
  description?: string;
  trigger?: React.ReactNode;
  isDeleting?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfirmDeleteDialog({
  onConfirm,
  title = "Are you absolutely sure?",
  description = "This action cannot be undone. This will permanently delete the selected data from our servers.",
  trigger,
  isDeleting = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  
  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled && setControlledOpen) {
      setControlledOpen(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    await onConfirm();
    handleOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-[#111827]">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/10 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
            <Trash2 className="w-8 h-8 text-red-500" />
          </div>
          
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-2xl font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B7B6B] dark:text-[#9CA3AF] leading-relaxed">
              {description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <AlertDialogFooter className="p-6 bg-[#F8FAF8] dark:bg-[#0B0F1A] border-t border-[#F0F7F0] dark:border-[#1F2937] flex sm:flex-row gap-3">
          <AlertDialogCancel 
            disabled={isDeleting}
            className="flex-1 h-12 rounded-xl border-[#E2EDE2] dark:border-[#1F2937] text-[#6B7B6B] dark:text-[#9CA3AF] font-bold hover:bg-white dark:hover:bg-[#111827] transition-all"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isDeleting}
            className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all border-none"
          >
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </div>
            ) : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
