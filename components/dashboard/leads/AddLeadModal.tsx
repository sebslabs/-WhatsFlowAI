"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import type { LeadFormData, LeadStage, LeadUrgency } from "@/types/index";

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
  "Contacted",
  "Qualifying",
  "Qualified",
  "Proposal",
  "Booked",
  "Lost",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (data: LeadFormData) => void | Promise<void>;
  defaultStage?: any;
  stages?: string[];
}

const INITIAL_DATA: LeadFormData = {
  name: "",
  phone: "",
  email: "",
  service: "",
  urgency: "" as any,
  source: "",
  stage: "New" as any,
  assignedTo: "",
  notes: "",
};

export function AddLeadModal({ open, onClose, onAdd, defaultStage, stages = STAGES }: Props) {
  const [formData, setFormData] = useState<LeadFormData>(INITIAL_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});

  useEffect(() => {
    if (open) {
      setFormData({ ...INITIAL_DATA, stage: defaultStage ?? "New" });
      setErrors({});
    }
  }, [open, defaultStage]);

  function validate() {
    const newErrors: Partial<Record<keyof LeadFormData, string>> = {};
    if (!formData.name.trim()) newErrors.name = "Full name is required";
    if (!formData.phone.trim()) newErrors.phone = "Phone number is required";
    if (!formData.service) newErrors.service = "Please select a service";
    if (!formData.urgency) newErrors.urgency = "Please select urgency";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await Promise.resolve(onAdd(formData));
      handleClose();
    } catch {
      /* parent showed toast */
    }
  }

  function handleClose() {
    onClose();
  }

  const inputClass = "bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280] rounded-xl h-10 font-medium focus-visible:ring-[#22C55E]/30";
  const labelClass = "text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]";
  const selectTriggerClass = "bg-white dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl h-10";
  const selectContentClass = "bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#111827]">
        <DialogHeader className="p-6 pb-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">
            Add New Lead
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Fill in the lead details below
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Row 1 */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className={labelClass}>Full Name*</Label>
              <Input
                id="name"
                placeholder="Sarah Johnson"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`${inputClass} ${errors.name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone" className={labelClass}>Phone Number*</Label>
              <Input
                id="phone"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={`${inputClass} ${errors.phone ? "border-red-500 focus-visible:ring-red-500" : ""}`}
              />
              {errors.phone && <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>}
            </div>

            {/* Row 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className={labelClass}>Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="sarah@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label className={labelClass}>Service Needed*</Label>
              <Select value={formData.service} onValueChange={(v) => setFormData({ ...formData, service: v })}>
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
              <Label className={labelClass}>Urgency*</Label>
              <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v as any })}>
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
              <Label className={labelClass}>Lead Source</Label>
              <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
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
              <Label className={labelClass}>Stage</Label>
              <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v as any })}>
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
              <Label htmlFor="assignedTo" className={labelClass}>Assigned To</Label>
              <Input
                id="assignedTo"
                placeholder="Team member name"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                className={inputClass}
              />
            </div>

            {/* Row 5 */}
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="notes" className={labelClass}>Notes</Label>
              <Textarea
                id="notes"
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
              onClick={handleClose}
              className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-8 rounded-xl shadow-md shadow-[#22C55E]/20 active:scale-95 transition-all"
            >
              Add Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
