"use client";

import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
} from "lucide-react";
import type { LeadFormData } from "@/types/index";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (leads: LeadFormData[]) => void | Promise<void>;
}

export function ImportLeadsModal({ open, onClose, onImport }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedLeads, setParsedLeads] = useState<LeadFormData[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setParsedLeads([]);
      setErrorMessage(null);
      setIsDragging(false);
    }
  }, [open]);

  // Download template logic
  function downloadTemplate() {
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Service",
      "Urgency",
      "Stage",
      "Source",
      "Assigned To",
      "Notes"
    ];
    const sampleRows = [
      [
        "John Doe",
        "+15551234567",
        "john@example.com",
        "General Inquiry",
        "Today",
        "New",
        "Imported",
        "Sarah Cooper",
        "Highly interested, requested callbacks"
      ],
      [
        "Jane Smith",
        "+15559876543",
        "jane@example.com",
        "Property Buying",
        "This Week",
        "Contacted",
        "Website",
        "",
        "Wants a 3-bedroom apartment in suburban area"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...sampleRows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "whatsflow_leads_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Parse CSV Line safely supporting quotes and commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    result.push(current.trim());
    return result;
  };

  function processCSVText(text: string) {
    try {
      const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      if (lines.length < 2) {
        setErrorMessage("CSV file must contain headers and at least one lead row.");
        setParsedLeads([]);
        return;
      }

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
      const dataRows = lines.slice(1);
      const newLeadsData: LeadFormData[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const values = parseCSVLine(row);
        if (values.length === 0 || !values[0]) continue;

        const getValue = (keyPatterns: string[], fallbackIndex: number) => {
          const index = headers.findIndex(h => keyPatterns.some(p => h.includes(p)));
          if (index !== -1 && values[index]) {
            // Remove wrapping quotes if any
            let val = values[index];
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }
            return val;
          }
          if (values[fallbackIndex]) {
            let val = values[fallbackIndex];
            if (val.startsWith('"') && val.endsWith('"')) {
              val = val.substring(1, val.length - 1);
            }
            return val;
          }
          return "";
        };

        const name = getValue(["name"], 0);
        const phone = getValue(["phone"], 1);
        const email = getValue(["email"], 2);
        const service = getValue(["service"], 3);
        const urgency = getValue(["urgency"], 4);
        const stage = getValue(["stage"], 5);
        const source = getValue(["source"], 6);
        const assignedTo = getValue(["assigned", "user"], 7);
        const notes = getValue(["notes", "info"], 8);

        // Validation check for mandatory fields
        if (!name || !phone) {
          continue; // skip invalid row
        }

        newLeadsData.push({
          name,
          phone,
          email: email || "",
          service: service || "General Inquiry",
          urgency: (urgency as any) || "Today",
          stage: (stage as any) || "New",
          source: source || "Imported",
          assignedTo: assignedTo || "",
          notes: notes || "",
        });
      }

      if (newLeadsData.length === 0) {
        setErrorMessage("No valid leads found in CSV. Please ensure Name and Phone columns are filled.");
        setParsedLeads([]);
      } else {
        setParsedLeads(newLeadsData);
        setErrorMessage(null);
      }
    } catch (err) {
      setErrorMessage("Failed to parse CSV file. Please make sure it is a valid comma-separated values file.");
      setParsedLeads([]);
    }
  }

  function handleFile(uploadedFile: File) {
    if (uploadedFile.type !== "text/csv" && !uploadedFile.name.endsWith(".csv")) {
      setErrorMessage("Please select a valid CSV file (.csv)");
      setFile(null);
      setParsedLeads([]);
      return;
    }

    if (uploadedFile.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds the 10MB upload limit.");
      setFile(null);
      setParsedLeads([]);
      return;
    }

    setFile(uploadedFile);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) processCSVText(text);
    };
    reader.readAsText(uploadedFile);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) handleFile(droppedFile);
  }

  function handleClear() {
    setFile(null);
    setParsedLeads([]);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (parsedLeads.length > 0) {
      await Promise.resolve(onImport(parsedLeads));
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#111827]">
        
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#22C55E]/10 dark:bg-[#22C55E]/20 flex items-center justify-center text-[#22C55E]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
                Import Leads
              </DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Upload a CSV file to bulk import leads into your system.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Instructions and Download Template */}
          <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
                Need a template?
              </h4>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] max-w-[320px]">
                Download our pre-formatted CSV template. Populate it with your leads data and re-upload here.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="h-9 text-xs border-[#D1D5DB] dark:border-[#1F2937] text-[#374151] dark:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] font-semibold rounded-xl shrink-0 gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download CSV Template
            </Button>
          </div>

          {/* Upload / Drag and Drop Area */}
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[#22C55E] bg-[#22C55E]/5 scale-[0.99]"
                  : "border-[#D1D5DB] dark:border-[#1F2937] hover:border-[#22C55E]/50 hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6] dark:bg-[#1F2937] flex items-center justify-center text-[#9CA3AF] dark:text-[#6B7280] mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] mb-1">
                Drag and drop your CSV file
              </h3>
              <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mb-3">
                or click to browse your computer
              </p>
              <span className="inline-flex items-center px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/10 text-blue-600">
                Supports .csv files
              </span>
            </div>
          ) : (
            /* Selected File State & Preview */
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#0B0F1A] rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#22C55E]/10 dark:bg-[#22C55E]/20 flex items-center justify-center text-[#22C55E] shrink-0">
                    <FileSpreadsheet className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                      {file.name}
                    </p>
                    <p className="text-[10px] text-[#9CA3AF] font-mono">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClear}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-red-900/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Parsed / Error Indicator */}
              {errorMessage ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold leading-relaxed">
                    {errorMessage}
                  </p>
                </div>
              ) : parsedLeads.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-[#22C55E] bg-[#22C55E]/5 border border-[#22C55E]/10 rounded-xl px-3 py-2 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Successfully parsed {parsedLeads.length} lead{parsedLeads.length === 1 ? "" : "s"}!
                  </div>

                  {/* Leads Preview List */}
                  <div className="border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl overflow-hidden bg-white dark:bg-[#0B0F1A]">
                    <div className="bg-[#F9FAFB] dark:bg-[#111827] border-b border-[#E5E7EB] dark:border-[#1F2937] px-3.5 py-2">
                      <span className="text-[10px] font-black uppercase text-[#6B7280] dark:text-[#9CA3AF] tracking-wider">
                        Leads Preview (Up to 3)
                      </span>
                    </div>
                    <div className="divide-y divide-[#E5E7EB] dark:divide-[#1F2937] max-h-[140px] overflow-y-auto">
                      {parsedLeads.slice(0, 3).map((lead, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between text-xs">
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                              {lead.name}
                            </p>
                            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">
                              {lead.phone}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#F3F4F6] dark:bg-[#1F2937] text-[#4B5563] dark:text-[#9CA3AF]">
                              {lead.service}
                            </span>
                            <p className="text-[8px] text-[#9CA3AF] mt-0.5">{lead.urgency}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Validation Guidelines */}
          {!file && (
            <div className="space-y-1.5">
              <h5 className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">
                Supported Columns
              </h5>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Name", req: true },
                  { name: "Phone", req: true },
                  { name: "Email", req: false },
                  { name: "Service", req: false },
                  { name: "Urgency", req: false },
                  { name: "Stage", req: false },
                  { name: "Source", req: false },
                  { name: "Assigned To", req: false },
                  { name: "Notes", req: false },
                ].map((col) => (
                  <span
                    key={col.name}
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      col.req
                        ? "bg-[#22C55E]/5 text-[#22C55E] border-[#22C55E]/20"
                        : "bg-white dark:bg-[#111827] text-[#6B7280] dark:text-[#9CA3AF] border-[#E5E7EB] dark:border-[#1F2937]"
                    }`}
                  >
                    {col.name} {col.req && "*"}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-[#9CA3AF] dark:text-[#6B7280] mt-1 font-semibold">
                * Name and Phone are required. Other columns default if empty. Case-insensitive header matching.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F3F4F6] dark:border-[#1F2937]">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={parsedLeads.length === 0}
              className="bg-[#22C55E] hover:bg-[#16A34A] disabled:bg-[#E5E7EB] disabled:text-[#9CA3AF] dark:disabled:bg-[#1F2937] text-white font-bold px-8 rounded-xl shadow-md disabled:shadow-none shadow-[#22C55E]/20 active:scale-95 transition-all"
            >
              Import {parsedLeads.length > 0 && `(${parsedLeads.length})`} Leads
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
