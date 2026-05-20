"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Table,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (newProducts: any[]) => void;
}

const TEMPLATE_HEADERS = ["Name", "Description", "Price", "Category", "SKU", "Stock", "Type"];

export function ImportCatalogModal({ open, onClose, onImport }: Props) {
  const [step, setStep] = useState<"upload" | "map" | "preview">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({
    name: "",
    description: "",
    price: "",
    category: "",
    sku: "",
    stock: "",
    type: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetState() {
    setStep("upload");
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMappings({
      name: "",
      description: "",
      price: "",
      category: "",
      sku: "",
      stock: "",
      type: "",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDownloadTemplate() {
    const csvContent = "data:text/csv;charset=utf-8," 
      + TEMPLATE_HEADERS.join(",") + "\n"
      + "Premium Wireless Headphones,High quality audio headphones,199.99,Electronics,WH-001,45,product\n"
      + "Premium Spa Consultation,1-on-1 personalized wellness session,75.00,Wellness,SPA-01,10,service";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "catalog_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File size exceeds the 10MB upload limit.");
      if (e.target) e.target.value = "";
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rawRows = text.split(/\r?\n/).map(line => {
          const cols = [];
          let current = '';
          let inQuotes = false;
          for (let j = 0; j < line.length; j++) {
            if (line[j] === '"') {
              inQuotes = !inQuotes;
            } else if (line[j] === ',' && !inQuotes) {
              cols.push(current.trim());
              current = '';
            } else {
              current += line[j];
            }
          }
          cols.push(current.trim());
          return cols;
        }).filter(r => r.length > 0 && r.some(c => c !== ""));

        if (rawRows.length === 0) {
          alert("Selected CSV is empty");
          return;
        }

        const detectedHeaders = rawRows[0];
        const dataRows = rawRows.slice(1);

        setHeaders(detectedHeaders);
        setRows(dataRows);

        // Auto-match headers to system fields
        const initialMappings: Record<string, string> = {};
        const systemKeys = ["name", "description", "price", "category", "sku", "stock", "type"];

        systemKeys.forEach(key => {
          const matched = detectedHeaders.find(h => 
            h.toLowerCase() === key.toLowerCase() ||
            h.toLowerCase().includes(key.toLowerCase()) ||
            (key === "name" && h.toLowerCase().includes("title")) ||
            (key === "sku" && h.toLowerCase().includes("code"))
          );
          initialMappings[key] = matched || "";
        });

        setMappings(initialMappings);
        setStep("map");
      } catch (e) {
        alert("Failed to parse CSV file");
      }
    };
    reader.readAsText(selectedFile);
  }

  function handleStartImport() {
    if (!mappings.name) {
      alert("Please map the required field 'Name' to proceed.");
      return;
    }

    const mappedProducts = rows.map((row, i) => {
      function getVal(key: string) {
        const headerIdx = headers.indexOf(mappings[key]);
        return headerIdx >= 0 ? row[headerIdx] : "";
      }

      const nameVal = getVal("name");
      if (!nameVal) return null;

      const descVal = getVal("description");
      const priceVal = parseFloat(getVal("price")) || 0;
      const catVal = getVal("category") || "General";
      const skuVal = getVal("sku") || "";
      const stockVal = parseInt(getVal("stock")) || 0;
      const typeVal = getVal("type")?.toLowerCase() === "service" ? "service" : "product";

      return {
        id: `imported-${Date.now()}-${i}`,
        type: typeVal,
        name: nameVal,
        description: descVal,
        price: priceVal,
        category: catVal,
        sku: skuVal,
        stock: stockVal,
        images: [],
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }).filter(p => p !== null);

    onImport(mappedProducts);
    resetState();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl bg-white dark:bg-[#111827]">
        <DialogHeader className="p-6 pb-4 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#22C55E]/10 flex items-center justify-center text-[#22C55E]">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <DialogTitle className="text-xl font-bold text-[#111827] dark:text-[#F9FAFB]">
              Import Products CSV
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Download a standard template or upload any CSV to dynamically map columns into your Catalog.
          </DialogDescription>
        </DialogHeader>

        {/* STEP 1: UPLOAD & DOWNLOAD TEMPLATE */}
        {step === "upload" && (
          <div className="p-6 space-y-6">
            {/* Template Download Option */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#22C55E]/5 to-transparent border border-[#22C55E]/20 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#22C55E]" />
                  Need a standard CSV layout?
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use our sample template preconfigured with recommended headers.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleDownloadTemplate}
                className="h-9 text-[#22C55E] border-[#22C55E]/20 hover:bg-[#22C55E]/5 font-bold rounded-xl bg-white dark:bg-[#111827]"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" /> Template
              </Button>
            </div>

            {/* Drag & Drop Upload Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl py-12 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#22C55E]/40 hover:bg-slate-50/50 dark:hover:bg-[#0B0F1A]/20 transition-all"
            >
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Click to select file or drag & drop here
                </p>
                <p className="text-xs text-slate-400 mt-1">Accepts .csv files only up to 10MB</p>
              </div>
            </div>

            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        )}

        {/* STEP 2: COLUMN MAPPING */}
        {step === "map" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Table className="w-3.5 h-3.5 text-[#22C55E]" />
                Map CSV Columns to Catalog Fields
              </p>
              <span className="text-xs text-slate-500">Detected: {headers.length} Columns</span>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {[
                { key: "name", label: "Product Name*", required: true },
                { key: "description", label: "Description", required: false },
                { key: "price", label: "Price", required: false },
                { key: "category", label: "Category", required: false },
                { key: "sku", label: "SKU / Code", required: false },
                { key: "stock", label: "Stock Quantity", required: false },
                { key: "type", label: "Type (Product/Service)", required: false },
              ].map((field) => (
                <div
                  key={field.key}
                  className="grid grid-cols-2 items-center gap-4 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-[#0B0F1A]/20 transition-colors"
                >
                  <Label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    {field.label}
                  </Label>
                  <select
                    value={mappings[field.key]}
                    onChange={(e) => setMappings({ ...mappings, [field.key]: e.target.value })}
                    className="h-9 px-2 rounded-lg bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 text-sm font-medium focus:border-[#22C55E]"
                  >
                    <option value="">-- Don't Map --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#F3F4F6] dark:border-[#1F2937]">
              <Button variant="ghost" onClick={resetState} className="text-slate-500">
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold px-6 rounded-xl shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finish Import ({rows.length} rows)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
