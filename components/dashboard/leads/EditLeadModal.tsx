"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Lead, LeadFormData, LeadStage, LeadUrgency } from "@/types/index";

const SERVICES = [
  "Dental Checkup",
  "Teeth Whitening",
  "Dental Implants",
  "Property Buying",
  "Property Selling",
  "Property Rental",
  "Hair & Styling",
  "Spa & Massage",
  "Physiotherapy",
  "General Inquiry",
];

const URGENCY: LeadUrgency[] = [
  "Today",
  "This Week",
  "Next Week",
  "This Month",
  "Flexible",
];

const SOURCES = [
  "WhatsApp Ad",
  "Organic WhatsApp",
  "Referral",
  "Instagram",
  "Facebook",
  "Website",
  "Walk-in",
  "Other",
];

const STAGES: LeadStage[] = [
  "New",
  "Qualifying",
  "Qualified",
  "Booked",
  "Lost",
];

interface Props {
  open: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSave: (id: string, data: LeadFormData) => void | Promise<void>;
  stages?: string[];
}

export function EditLeadModal({ open, lead, onClose, onSave, stages = STAGES }: Props) {
  const [formData, setFormData] = useState<LeadFormData | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name,
        phone: lead.phone,
        email: lead.email || "",
        service: lead.service,
        urgency: lead.urgency,
        source: lead.source,
        stage: lead.stage,
        assignedTo: lead.assignedTo || "",
        notes: lead.notes || "",
      });
      setErrors({});
    }
  }, [lead, open]);

  if (!formData) return null;

  const isDirty = lead && (
    formData.name !== lead.name ||
    formData.phone !== lead.phone ||
    formData.email !== (lead.email || "") ||
    formData.service !== lead.service ||
    formData.urgency !== lead.urgency ||
    formData.source !== lead.source ||
    formData.stage !== lead.stage ||
    formData.assignedTo !== (lead.assignedTo || "") ||
    formData.notes !== (lead.notes || "")
  );

  function validate() {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {};
    if (!formData!.name.trim()) newErrors.name = "Full name is required";
    if (!formData!.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData!.service) newErrors.service = "Please select a service";
    if (!formData!.urgency) newErrors.urgency = "Please select urgency";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate() || !lead) return;
    try {
      await Promise.resolve(onSave(lead.id, formData!));
      onClose();
    } catch {
      /* parent surfaced error toast — keep dialog open */
    }
  }

  function handleCancel() {
    if (isDirty) {
      setShowConfirmCancel(true);
    } else {
      onClose();
    }
  }

  const inputClass = "bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280] rounded-xl h-10 font-medium focus-visible:ring-[#22C55E]/30";
  const labelClass = "text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]";
  const selectTriggerClass = "bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl h-10";
  const selectContentClass = "bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]";

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && handleCancel()}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#111827]">
          <DialogHeader className="p-6 pb-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
            <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">Edit Lead</DialogTitle>
            <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              Update lead information
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {/* Row 1 */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className={labelClass}>
                  Full Name*
                </Label>
                <Input
                  id="edit-name"
                  placeholder="Sarah Johnson"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`${inputClass} ${errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone" className={labelClass}>
                  Phone Number*
                </Label>
                <Input
                  id="edit-phone"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={`${inputClass} ${errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                {errors.phone && <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>}
              </div>

              {/* Row 2 */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-email" className={labelClass}>
                  Email
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="sarah@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>
                  Service Needed*
                </Label>
                <Select
                  value={formData.service}
                  onValueChange={(v) => setFormData({ ...formData, service: v })}
                >
                  <SelectTrigger className={`${selectTriggerClass} ${errors.service ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {SERVICES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.service && <p className="text-[11px] text-red-500 font-medium">{errors.service}</p>}
              </div>

              {/* Row 3 */}
              <div className="space-y-1.5">
                <Label className={labelClass}>
                  Urgency*
                </Label>
                <Select
                  value={formData.urgency}
                  onValueChange={(v) => setFormData({ ...formData, urgency: v as any })}
                >
                  <SelectTrigger className={`${selectTriggerClass} ${errors.urgency ? "border-red-500" : ""}`}>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {URGENCY.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.urgency && <p className="text-[11px] text-red-500 font-medium">{errors.urgency}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className={labelClass}>
                  Lead Source
                </Label>
                <Select
                  value={formData.source}
                  onValueChange={(v) => setFormData({ ...formData, source: v })}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Row 4 */}
              <div className="space-y-1.5">
                <Label className={labelClass}>
                  Stage
                </Label>
                <Select
                  value={formData.stage}
                  onValueChange={(v) => setFormData({ ...formData, stage: v as any })}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {stages.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-assignedTo" className={labelClass}>
                  Assigned To
                </Label>
                <Input
                  id="edit-assignedTo"
                  placeholder="Team member name"
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className={inputClass}
                />
              </div>

              {/* Row 5 */}
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-notes" className={labelClass}>
                  Notes
                </Label>
                <Textarea
                  id="edit-notes"
                  placeholder="Any additional context..."
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="resize-none bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280] rounded-xl font-medium focus-visible:ring-[#22C55E]/30"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F3F4F6] dark:border-[#1F2937]">
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-8 rounded-xl shadow-md shadow-[#22C55E]/20 active:scale-95 transition-all"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <AlertDialogContent className="max-w-[400px] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-[#111827]">
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/10 flex items-center justify-center mb-6 animate-in zoom-in duration-300">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            
            <AlertDialogHeader className="space-y-2">
              <AlertDialogTitle className="text-2xl font-bold text-[#0F1F0F] dark:text-[#F9FAFB]">
                Discard changes?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-[#6B7B6B] dark:text-[#9CA3AF] leading-relaxed">
                Any unsaved changes will be lost. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <AlertDialogFooter className="p-6 bg-[#F8FAF8] dark:bg-[#0B0F1A] border-t border-[#F0F7F0] dark:border-[#1F2937] flex sm:flex-row gap-3">
            <AlertDialogCancel 
              className="flex-1 h-12 rounded-xl border-[#E2EDE2] dark:border-[#1F2937] text-[#6B7B6B] dark:text-[#9CA3AF] font-bold hover:bg-white dark:hover:bg-[#111827] transition-all"
            >
              Keep Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmCancel(false);
                onClose();
              }}
              className="flex-1 h-12 rounded-xl bg-red-500 text-white hover:bg-red-600 font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all border-none"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
