"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Check, Settings2, Sparkles, GripVertical } from "lucide-react";
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

export interface StageConfig {
  label: string;
  color: string;
  bg: string;
  border: string;
  lightBg: string;
}

export interface PipelineItem {
  stage: string;
  config: StageConfig;
}

const PRESET_COLORS = [
  { value: "#3B82F6", name: "Blue", bg: "#EFF6FF", border: "#BFDBFE" },
  { value: "#8B5CF6", name: "Purple", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "#F59E0B", name: "Amber", bg: "#FFFBEB", border: "#FDE68A" },
  { value: "#F97316", name: "Orange", bg: "#FFF7ED", border: "#FED7AA" },
  { value: "#06B6D4", name: "Cyan", bg: "#ECFEFF", border: "#A5F3FC" },
  { value: "#22C55E", name: "Green", bg: "#F0FDF4", border: "#BBF7D0" },
  { value: "#EF4444", name: "Red", bg: "#FEF2F2", border: "#FECACA" },
  { value: "#EC4899", name: "Pink", bg: "#FDF2F8", border: "#FBCFE8" },
  { value: "#64748B", name: "Slate", bg: "#F8FAFC", border: "#E2E8F0" },
  { value: "#4F46E5", name: "Indigo", bg: "#EEF2FF", border: "#C7D2FE" },
  { value: "#7C3AED", name: "Violet", bg: "#F5F3FF", border: "#DDD6FE" },
  { value: "#10B981", name: "Emerald", bg: "#ECFDF5", border: "#A7F3D0" },
  { value: "#14B8A6", name: "Teal", bg: "#F0FDFA", border: "#99F6E4" },
  { value: "#F43F5E", name: "Rose", bg: "#FFF1F2", border: "#FECDD3" },
  { value: "#D946EF", name: "Fuchsia", bg: "#FDF4FF", border: "#F5D0FE" },
  { value: "#EAB308", name: "Yellow", bg: "#FEFCE8", border: "#FEF08A" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  pipeline: PipelineItem[];
  onSave: (newPipeline: PipelineItem[]) => void;
}

export function ManageStatusesModal({ open, onClose, pipeline, onSave }: Props) {
  const [localPipeline, setLocalPipeline] = useState<PipelineItem[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [isCustomColor, setIsCustomColor] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingColor, setEditingColor] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setLocalPipeline(JSON.parse(JSON.stringify(pipeline)));
      setNewLabel("");
      setSelectedColor(PRESET_COLORS[0].value);
      setIsCustomColor(false);
      setEditingIndex(null);
    }
  }, [open, pipeline]);

  function deriveColors(hexColor: string) {
    const preset = PRESET_COLORS.find((c) => c.value.toLowerCase() === hexColor.toLowerCase());
    if (preset) return preset;
    return {
      value: hexColor,
      bg: `${hexColor}10`,
      border: `${hexColor}30`,
    };
  }

  function handleAddStatus() {
    if (!newLabel.trim()) return;
    const stageName = newLabel.trim();
    if (localPipeline.some((p) => p.stage.toLowerCase() === stageName.toLowerCase())) {
      alert("A status with this name already exists!");
      return;
    }

    const derived = deriveColors(selectedColor);
    const newItem: PipelineItem = {
      stage: stageName,
      config: {
        label: stageName,
        color: derived.value,
        bg: derived.bg,
        border: derived.border,
        lightBg: derived.bg,
      },
    };

    setLocalPipeline([...localPipeline, newItem]);
    setNewLabel("");
  }

  function handleDeleteStatus(index: number) {
    const item = localPipeline[index];
    if (["New", "Booked", "Lost"].includes(item.stage)) {
      alert(`Cannot delete standard system status: "${item.stage}"`);
      return;
    }
    setLocalPipeline(localPipeline.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  }

  function handleStartEdit(index: number) {
    setEditingIndex(index);
    setEditingLabel(localPipeline[index].config.label);
    setEditingColor(localPipeline[index].config.color);
  }

  function handleSaveEdit(index: number) {
    if (!editingLabel.trim()) return;
    const derived = deriveColors(editingColor);
    
    const updated = [...localPipeline];
    updated[index] = {
      stage: editingLabel.trim(),
      config: {
        label: editingLabel.trim(),
        color: derived.value,
        bg: derived.bg,
        border: derived.border,
        lightBg: derived.bg,
      },
    };

    setLocalPipeline(updated);
    setEditingIndex(null);
  }

  function handleSaveAll() {
    onSave(localPipeline);
    onClose();
  }

  // Drag and Drop handlers
  function handleDragStart(e: React.DragEvent, index: number) {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const reordered = [...localPipeline];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    setLocalPipeline(reordered);
    setDraggedIndex(null);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#111827]">
        <DialogHeader className="p-6 pb-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
              <Settings2 className="w-4 h-4" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">
              Customize Lead Pipeline
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Drag & drop stages to reorder, add custom names, and configure endless premium colors.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[460px] overflow-y-auto">
          {/* Add Form */}
          <div className="p-4 rounded-2xl bg-[#F9FAFB] dark:bg-[#0B0F1A]/50 border border-[#E5E7EB] dark:border-[#1F2937] space-y-3.5">
            <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#22C55E]" />
              Create Custom Status
            </p>
            <div className="flex gap-2.5">
              <div className="flex-1 space-y-1">
                <Input
                  placeholder="e.g. Negotiation"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="h-10 bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] rounded-xl font-medium focus-visible:ring-[#22C55E]/30"
                />
              </div>
              <Button
                onClick={handleAddStatus}
                className="h-10 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold rounded-xl px-4 flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </Button>
            </div>

            {/* Premium Colors Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-[#6B7280]">Select Curated Tones</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => {
                      setSelectedColor(e.target.value);
                      setIsCustomColor(true);
                    }}
                    className="w-6 h-6 rounded-lg cursor-pointer border border-[#E5E7EB] dark:border-[#1F2937] p-0 overflow-hidden bg-transparent shrink-0"
                  />
                  <span className="text-[11px] font-black text-[#22C55E] uppercase tracking-wider">
                    {isCustomColor ? "Custom Hex ✓" : "Pick Custom"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-8 gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => {
                      setSelectedColor(preset.value);
                      setIsCustomColor(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 relative"
                    style={{ backgroundColor: preset.value }}
                  >
                    {!isCustomColor && selectedColor === preset.value && (
                      <div className="absolute inset-0.5 rounded-full border border-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List of Statuses */}
          <div className="space-y-2.5">
            <Label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Pipeline Stages ({localPipeline.length}) — Drag rows to reorder
            </Label>
            <div className="space-y-2">
              {localPipeline.map((item, index) => {
                const isEditing = editingIndex === index;
                const isSystem = ["New", "Booked", "Lost"].includes(item.stage);
                const isDragged = draggedIndex === index;

                return (
                  <div
                    key={index}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`flex items-center justify-between p-3 rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] hover:bg-[#F9FAFB]/50 dark:hover:bg-[#0B0F1A]/20 transition-all gap-3 cursor-grab active:cursor-grabbing ${
                      isDragged ? "opacity-40 scale-[0.98] border-dashed border-[#22C55E]" : ""
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex-1 flex gap-2.5 flex-col w-full">
                        <div className="flex gap-2">
                          <Input
                            value={editingLabel}
                            onChange={(e) => setEditingLabel(e.target.value)}
                            className="h-9 font-medium rounded-lg"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSaveEdit(index)}
                            className="h-9 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-lg px-3 shrink-0"
                          >
                            Save
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">Edit Color</span>
                            <input
                              type="color"
                              value={editingColor}
                              onChange={(e) => setEditingColor(e.target.value)}
                              className="w-5.5 h-5.5 rounded-md cursor-pointer border border-[#E5E7EB]"
                            />
                          </div>
                          <div className="grid grid-cols-8 gap-1.5">
                            {PRESET_COLORS.map((preset) => (
                              <button
                                key={preset.value}
                                onClick={() => setEditingColor(preset.value)}
                                className="w-5.5 h-5.5 rounded-full flex items-center justify-center relative shrink-0"
                                style={{ backgroundColor: preset.value }}
                              >
                                {editingColor === preset.value && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab shrink-0">
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.config.color }}
                          />
                          <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                            {item.config.label}
                          </p>
                          {isSystem && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider select-none shrink-0">
                              System
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(index)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1F2937] rounded-lg transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!isSystem && (
                            <button
                              onClick={() => handleDeleteStatus(index)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#F3F4F6] dark:border-[#1F2937]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveAll}
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-8 rounded-xl shadow-md shadow-[#22C55E]/20 active:scale-95 transition-all"
          >
            Save Pipeline
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
