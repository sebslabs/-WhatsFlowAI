"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Plus, ShoppingBag, Search, Filter, Edit3, Trash2,
  MoreHorizontal, Package, Tag, AlertCircle,
  Loader2, RefreshCw, Archive, ArchiveRestore, Check,
  ImageIcon, X, Upload, Link2, UploadCloud, ExternalLink, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageHeading } from "@/components/dashboard/PageHeading";
import { ImportCatalogModal } from "@/components/dashboard/catalog/ImportCatalogModal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { createClient } from "@/lib/supabase/client";
// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  type?: "product" | "service";
  name: string;
  description?: string;
  price: number;
  compare_price?: number;
  sku?: string;
  category: string;
  stock: number;
  images?: string[];
  image_url?: string;
  url?: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

interface ProductForm {
  type: "product" | "service";
  name: string;
  description: string;
  price: string;
  compare_price: string;
  sku: string;
  category: string;
  customCategory: string;
  stock: string;
  url: string;
  images: string[];
  status: "active" | "archived";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRESET_CATEGORIES = [
  "General", "Food & Beverage", "Electronics", "Clothing & Apparel",
  "Beauty & Personal Care", "Health & Wellness", "Home & Garden",
  "Sports & Outdoors", "Services", "Digital Products", "Other",
];

const BLANK_FORM: ProductForm = {
  type: "product",
  name: "", description: "", price: "", compare_price: "",
  sku: "", category: "General", customCategory: "",
  stock: "0", url: "", images: [], status: "active",
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function stockBadge(stock: number) {
  if (stock === 0) return { label: "Out of stock", cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" };
  if (stock <= 10) return { label: `${stock} left`, cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" };
  return { label: `${stock} in stock`, cls: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" };
}

const CATEGORY_COLORS: Record<string, string> = {
  "Food & Beverage": "#F59E0B", "Electronics": "#3B82F6", "Clothing & Apparel": "#EC4899",
  "Beauty & Personal Care": "#8B5CF6", "Health & Wellness": "#10B981",
  "Home & Garden": "#84CC16", "Sports & Outdoors": "#F97316",
  "Services": "#06B6D4", "Digital Products": "#6366F1", "General": "#6B7280", "Other": "#9CA3AF",
};

function categoryColor(cat: string) { return CATEGORY_COLORS[cat] ?? "#22C55E"; }

// ── Image Uploader ─────────────────────────────────────────────────────────────

function ImageUploader({
  values,
  onChange,
}: {
  values: string[];
  onChange: (urls: string[]) => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  async function uploadFile(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast("Unsupported file type. Use JPG, PNG, WEBP or GIF.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast("Image must be under 5 MB.", "error");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      
      // 1. Get logged in user session details
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("No active credentials or session found. Please log in.");
      }

      // Retrieve tenant_id from members mapping
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('profile_id', user.id)
        .limit(1)
        .single();

      const tenantId = memberData?.tenant_id ?? 'global';

      // 2. Upload file to 'knowledge-base' bucket under 'catalog/' namespace
      const fileKey = `catalog/${tenantId}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(fileKey, file, { contentType: file.type, cacheControl: '3600' });

      if (uploadError) {
        throw new Error(`Cloud upload failed: ${uploadError.message}`);
      }

      // 3. Get the CDN public URL
      const { data: { publicUrl } } = supabase.storage
        .from('knowledge-base')
        .getPublicUrl(fileKey);

      onChange([...values, publicUrl]);
      toast("Catalog image uploaded to cloud storage! ✓", "success");
    } catch (err: any) {
      toast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [values]);

  const addUrl = () => {
    if (urlInput.trim()) {
      onChange([...values, urlInput.trim()]);
      setUrlInput("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
          Product Images
        </Label>
        <button
          type="button"
          onClick={() => setUrlMode(v => !v)}
          className="flex items-center gap-1 text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] transition-colors"
        >
          {urlMode ? <><Upload className="w-3 h-3" /> Upload file</> : <><Link2 className="w-3 h-3" /> Paste URL</>}
        </button>
      </div>

      {urlMode && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addUrl())}
            placeholder="https://example.com/image.jpg"
            type="url"
            className="flex-1 h-10 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-sm"
          />
          <Button type="button" onClick={addUrl} className="h-10 px-4 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl font-bold">
            Add
          </Button>
        </div>
      )}

      {values.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {values.map((v, i) => (
            <div key={i} className="relative rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] h-28 group">
              <img src={v} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => onChange(values.filter((_, idx) => idx !== i))}
                  className="bg-red-500/90 text-white p-2 rounded-xl hover:bg-red-500 transition-all shadow-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {/* Add more button */}
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all select-none",
              dragOver
                ? "border-[#22C55E] bg-[#22C55E]/5"
                : "border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#22C55E]/50 hover:bg-[#22C55E]/5 bg-[#F9FAFB] dark:bg-[#0B0F1A]"
            )}
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 text-[#22C55E] animate-spin" />
            ) : (
              <>
                <UploadCloud className={cn("w-6 h-6 transition-colors", dragOver ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]")} />
                <span className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF]">Add More</span>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Empty Drop zone */
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "h-44 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all select-none",
            dragOver
              ? "border-[#22C55E] bg-[#22C55E]/5"
              : "border-[#E5E7EB] dark:border-[#1F2937] hover:border-[#22C55E]/50 hover:bg-[#22C55E]/5 bg-[#F9FAFB] dark:bg-[#0B0F1A]"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
              <p className="text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF]">Uploading…</p>
            </>
          ) : (
            <>
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                dragOver ? "bg-[#22C55E]/20" : "bg-[#E5E7EB] dark:bg-[#1F2937]"
              )}>
                <UploadCloud className={cn("w-6 h-6 transition-colors", dragOver ? "text-[#22C55E]" : "text-[#6B7280] dark:text-[#9CA3AF]")} />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">
                  {dragOver ? "Drop to upload" : "Click or drag image here"}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                  JPG, PNG, WEBP, GIF · max 5 MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────────

function ProductCard({
  product, onEdit, onView, onDelete, onToggleStatus,
}: {
  product: Product;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
}) {
  const stock = stockBadge(product.stock);
  const discount = product.compare_price && product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : null;
  const color = categoryColor(product.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white dark:bg-[#111827] rounded-2xl border shadow-sm flex flex-col hover:border-[#22C55E]/30 transition-all duration-300",
        product.status === "archived"
          ? "border-[#E5E7EB] dark:border-[#1F2937] opacity-60"
          : "border-[#E5E7EB] dark:border-[#1F2937]"
      )}
    >
      {/* Image */}
      <div className="relative h-44 rounded-t-2xl overflow-hidden bg-[#F9FAFB] dark:bg-[#0B0F1A]">
        {product.images?.[0] || product.image_url ? (
          <img src={product.images?.[0] || product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ background: `${color}15` }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: `${color}25` }}>
              <ShoppingBag className="w-6 h-6" style={{ color }} />
            </div>
            <span className="text-xs font-bold" style={{ color }}>{product.category}</span>
          </div>
        )}
        {discount && (
          <span className="absolute top-2.5 left-2.5 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg">
            -{discount}%
          </span>
        )}
        {product.status === "archived" && (
          <span className="absolute top-2.5 right-2.5 bg-gray-800/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-sm">
            Archived
          </span>
        )}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 rounded-xl bg-white/80 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition-all">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
              <DropdownMenuItem onClick={onView} className="rounded-xl text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                <Eye className="w-3.5 h-3.5 mr-2 text-[#22C55E]" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit} className="rounded-xl text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                <Edit3 className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleStatus} className="rounded-xl text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                {product.status === "active"
                  ? <><Archive className="w-3.5 h-3.5 mr-2" /> Archive</>
                  : <><ArchiveRestore className="w-3.5 h-3.5 mr-2" /> Restore</>}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#E5E7EB] dark:bg-[#1F2937]" />
              <DropdownMenuItem onClick={onDelete} className="rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ color, background: `${color}18` }}>
            {product.category}
          </span>
          {product.sku && (
            <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-mono">#{product.sku}</span>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB] leading-snug line-clamp-1">{product.name}</h3>
          {product.description && (
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-black text-[#111827] dark:text-[#F9FAFB]">{formatPrice(product.price)}</span>
            {product.compare_price && product.compare_price > product.price && (
              <span className="text-xs text-[#9CA3AF] line-through">{formatPrice(product.compare_price)}</span>
            )}
          </div>
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-lg", stock.cls)}>{stock.label}</span>
        </div>

        <div className={cn("grid gap-2 mt-2", product.url ? "grid-cols-2" : "grid-cols-1")}>
          <Button
            variant="ghost" size="sm" onClick={onEdit}
            className="w-full h-8 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] hover:border-[#22C55E]/40 hover:bg-[#22C55E]/5 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Edit
          </Button>
          {product.url && (
            <Button
              variant="default" size="sm"
              className="w-full h-8 rounded-xl text-xs font-bold bg-[#22C55E] hover:bg-[#16A34A] text-white transition-all shadow-sm"
              onClick={() => window.open(product.url, "_blank")}
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Store
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Sheet ──────────────────────────────────────────────────────────────

function ProductSheet({
  open, editing, isViewing, onClose, onSaved,
}: {
  open: boolean;
  editing: Product | null;
  isViewing?: boolean;
  onClose: () => void;
  onSaved: (p: Product) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ProductForm>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const isPreset = PRESET_CATEGORIES.includes(editing.category);
      setUseCustomCategory(!isPreset);
      setForm({
        type: editing.type || "product",
        name: editing.name,
        description: editing.description ?? "",
        price: String(editing.price),
        compare_price: editing.compare_price ? String(editing.compare_price) : "",
        sku: editing.sku ?? "",
        category: isPreset ? editing.category : "Other",
        customCategory: isPreset ? "" : editing.category,
        stock: String(editing.stock),
        url: editing.url ?? "",
        images: editing.images || (editing.image_url ? [editing.image_url] : []),
        status: editing.status,
      });
    } else {
      setForm(BLANK_FORM);
      setUseCustomCategory(false);
    }
  }, [open, editing]);

  function patch(u: Partial<ProductForm>) { setForm(p => ({ ...p, ...u })); }

  async function handleSave() {
    if (!form.name.trim()) { toast("Product name is required", "error"); return; }
    const priceNum = parseFloat(form.price);
    if (isNaN(priceNum) || priceNum < 0) { toast("Enter a valid price", "error"); return; }

    const finalCategory = useCustomCategory && form.customCategory.trim()
      ? form.customCategory.trim() : form.category;

    const payload = {
      type: form.type,
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: priceNum,
      compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
      sku: form.sku.trim() || null,
      category: finalCategory,
      stock: parseInt(form.stock) || 0,
      url: form.url.trim() || undefined,
      images: form.images,
      image_url: form.images[0] || undefined,
      status: form.status,
    };

    setSaving(true);
    try {
      let savedProduct: Product;
      
      if (editing) {
        savedProduct = await apiFetch(`/api/catalog/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        savedProduct = await apiFetch("/api/catalog", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      onSaved(savedProduct);
      toast(editing ? "Product updated successfully ✓" : "Product added to catalog successfully ✓", "success");
      onClose();
    } catch {
      toast("Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full max-w-md p-0 flex flex-col bg-white dark:bg-[#111827] border-l border-[#E5E7EB] dark:border-[#1F2937]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E7EB] dark:border-[#1F2937] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB]">
              {isViewing ? "View Product" : editing ? "Edit Product" : "Add Product"}
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
              {isViewing ? "Product specification details" : editing ? "Update this product's details" : "Add a new product or service to your catalog"}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        
          {/* Type Toggle */}
          {/* Type Toggle */}
          <div className="flex bg-[#F9FAFB] dark:bg-[#0B0F1A] p-1.5 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] relative">
            <button
              type="button"
              onClick={() => patch({ type: "product" })}
              className={cn(
                "relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors z-10",
                form.type === "product" ? "text-[#111827] dark:text-[#F9FAFB]" : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              )}
            >
              {form.type === "product" && (
                <motion.div
                  layoutId="typeToggle"
                  className="absolute inset-0 bg-white dark:bg-[#111827] rounded-lg shadow-sm border border-[#E5E7EB] dark:border-[#F9FAFB]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  style={{ zIndex: -1 }}
                />
              )}
              Product
            </button>
            <button
              type="button"
              onClick={() => patch({ type: "service" })}
              className={cn(
                "relative flex-1 py-2 text-sm font-bold rounded-lg transition-colors z-10",
                form.type === "service" ? "text-[#111827] dark:text-[#F9FAFB]" : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] dark:hover:text-[#F9FAFB]"
              )}
            >
              {form.type === "service" && (
                <motion.div
                  layoutId="typeToggle"
                  className="absolute inset-0 bg-white dark:bg-[#111827] rounded-lg shadow-sm border border-[#E5E7EB] dark:border-[#F9FAFB]"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  style={{ zIndex: -1 }}
                />
              )}
              Service
            </button>
          </div>

          {/* Image upload */}
          {isViewing ? (
            <div className="grid grid-cols-2 gap-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] h-32">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <ImageUploader
              values={form.images}
              onChange={urls => patch({ images: urls })}
            />
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Product / Service Name *</Label>
            <Input
              value={form.name}
              onChange={e => patch({ name: e.target.value })}
              placeholder="e.g. Premium Wireless Headphones"
              className="h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Description <span className="normal-case font-normal">(optional)</span></Label>
            <Textarea
              value={form.description}
              onChange={e => patch({ description: e.target.value })}
              placeholder="Describe this product or service…"
              rows={3}
              className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium resize-none text-sm leading-relaxed"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Category</Label>
            <Select
              value={useCustomCategory ? "__custom__" : form.category}
              onValueChange={v => {
                if (v === "__custom__") { setUseCustomCategory(true); patch({ category: "Other" }); }
                else { setUseCustomCategory(false); patch({ category: v }); }
              }}
            >
              <SelectTrigger className="h-11 rounded-xl bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
                {PRESET_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                <SelectItem value="__custom__">+ Custom category…</SelectItem>
              </SelectContent>
            </Select>
            {useCustomCategory && (
              <Input
                value={form.customCategory}
                onChange={e => patch({ customCategory: e.target.value })}
                placeholder="Enter custom category name"
                className="h-10 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium text-sm mt-1.5"
              />
            )}
          </div>

          {/* Price + Compare Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Price *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF]">$</span>
                <Input value={form.price} onChange={e => patch({ price: e.target.value })} placeholder="0.00"
                  type="number" min="0" step="0.01"
                  className="pl-7 h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                Compare at <span className="normal-case font-normal">(optional)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF]">$</span>
                <Input value={form.compare_price} onChange={e => patch({ compare_price: e.target.value })} placeholder="0.00"
                  type="number" min="0" step="0.01"
                  className="pl-7 h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" />
              </div>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Shows crossed-out original price</p>
            </div>
          </div>

          {/* SKU + Stock */}
          <div className={cn("grid gap-3", form.type === "product" ? "grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">SKU <span className="normal-case font-normal">(optional)</span></Label>
              <Input value={form.sku} onChange={e => patch({ sku: e.target.value })} placeholder="e.g. WH-001"
                className="h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium font-mono" />
            </div>
            {form.type === "product" && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Stock Qty</Label>
                <Input value={form.stock} onChange={e => patch({ stock: e.target.value })} placeholder="0"
                  type="number" min="0"
                  className="h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Status</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["active", "archived"] as const).map(s => {
                const active = form.status === s;
                return (
                  <button key={s} type="button" onClick={() => patch({ status: s })}
                    className={cn(
                      "flex items-center gap-2.5 p-3.5 rounded-xl border-2 text-left transition-all",
                      active ? "border-[#22C55E] bg-[#22C55E]/10" : "border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:border-[#22C55E]/40"
                    )}
                  >
                    <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                      active ? "bg-[#22C55E] border-[#22C55E]" : "border-[#D1D5DB] dark:border-[#374151]")}>
                      {active && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className={cn("text-sm font-bold capitalize", active ? "text-[#22C55E]" : "text-[#111827] dark:text-[#F9FAFB]")}>{s}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* External URL */}
          <div className="space-y-1.5 pb-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">External Link <span className="normal-case font-normal">(optional)</span></Label>
            <Input value={form.url} onChange={e => patch({ url: e.target.value })} placeholder="https://store.example.com/product"
              type="url"
              className="h-11 bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" />
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Link to your e-commerce store or landing page</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-[#E5E7EB] dark:border-[#1F2937] flex items-center gap-3">
          {isViewing ? (
            <Button onClick={onClose}
              className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl font-bold shadow-md active:scale-95 transition-all">
              Done
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}
                className="flex-1 rounded-xl font-bold text-[#6B7280] dark:text-[#9CA3AF] bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}
                className="flex-1 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl font-bold shadow-md shadow-[#22C55E]/15 active:scale-95 transition-all disabled:opacity-50">
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                  : <><Check className="w-4 h-4 mr-2" /> {editing ? "Save Changes" : "Add Product"}</>
                }
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [isViewing, setIsViewing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  async function loadProducts() {
    setLoading(true); 
    setLoadError("");
    try {
      const data = await apiFetch('/api/catalog');
      setProducts(data || []);
    } catch (err) {
      console.error("Error fetching catalog:", err);
      setLoadError("Could not load catalog. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  // Removed localstorage hook

  function openCreate() { setEditing(null); setIsViewing(false); setSheetOpen(true); }
  function openEdit(p: Product) { setEditing(p); setIsViewing(false); setSheetOpen(true); }
  function openView(p: Product) { setEditing(p); setIsViewing(true); setSheetOpen(true); }

  function handleBulkImport(newProducts: Product[]) {
    if (newProducts.length > 0) {
      setProducts(prev => [...newProducts, ...prev]);
      toast(`Successfully imported ${newProducts.length} items ✓`, "success");
    }
  }

  function handleSaved(p: Product) {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      return idx >= 0 ? prev.map(x => x.id === p.id ? p : x) : [p, ...prev];
    });
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/catalog/${id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== id));
      toast("Product deleted successfully", "success");
    } catch {
      toast("Failed to delete product", "error");
    }
  }

  async function handleToggleStatus(product: Product) {
    const newStatus: "active" | "archived" = product.status === "active" ? "archived" : "active";
    try {
      const updated = await apiFetch(`/api/catalog/${product.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...product, status: newStatus }),
      });
      setProducts(prev => prev.map(p => p.id === product.id ? updated : p));
      toast(newStatus === "archived" ? "Product archived successfully" : "Product restored successfully", "success");
    } catch {
      toast("Failed to update product status", "error");
    }
  }

  const activeProducts = products.filter(p => p.status === "active");
  const outOfStock = products.filter(p => p.stock === 0 && p.status === "active").length;
  const categories = Array.from(new Set(products.map(p => p.category)));

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
      || (p.sku ?? "").toLowerCase().includes(search.toLowerCase())
      || p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-[#22C55E] animate-spin" />
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading catalog…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-8 rounded-2xl max-w-md mx-auto my-12 shadow-sm transition-colors duration-300">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center mb-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-bold text-[#111827] dark:text-[#F9FAFB]">{loadError}</p>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-[280px] mx-auto leading-relaxed">
            Please check your connection or ensure the service is active.
          </p>
        </div>
        <Button 
          variant="outline" 
          className="mt-2 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A] px-8 h-11 font-bold shadow-sm transition-all active:scale-95" 
          onClick={loadProducts}
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Catalog"
        count={activeProducts.length}
        description="Manage your products and services to share with WhatsApp customers."
        rightContent={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="h-10 px-4 rounded-xl font-bold bg-white dark:bg-[#111827] text-[#111827] dark:text-[#F9FAFB] border-[#E5E7EB] dark:border-[#1F2937] hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]"
            >
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={openCreate}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 px-5 rounded-xl shadow-md active:scale-95 transition-all">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Products", value: products.length, icon: ShoppingBag, color: "#22C55E", bg: "#22C55E1A" },
          { label: "Active", value: activeProducts.length, icon: Package, color: "#2563EB", bg: "#EFF6FF" },
          { label: "Categories", value: categories.length, icon: Tag, color: "#7C3AED", bg: "#FAF5FF" },
          { label: "Out of Stock", value: outOfStock, icon: AlertCircle, color: outOfStock > 0 ? "#DC2626" : "#6B7280", bg: outOfStock > 0 ? "#FEF2F2" : "#F9FAFB" },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-[#111827] rounded-2xl border border-[#E5E7EB] dark:border-[#1F2937] p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.bg }}>
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#111827] dark:text-[#F9FAFB] leading-none">{stat.value}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, SKU or category…"
            className="pl-10 h-11 bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 w-44 rounded-xl bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium">
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-11 w-40 rounded-xl bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] font-medium">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl">
          <div className="w-16 h-16 bg-[#22C55E]/10 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingBag className="w-8 h-8 text-[#22C55E]" />
          </div>
          <p className="text-lg font-bold text-[#111827] dark:text-[#F9FAFB] mb-1">
            {search || categoryFilter !== "all" || statusFilter !== "active" ? "No products found" : "Your catalog is empty"}
          </p>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6 font-medium">
            {search || categoryFilter !== "all" || statusFilter !== "active"
              ? "Try adjusting your search or filters."
              : "Add your first product or service to get started."}
          </p>
          {!search && categoryFilter === "all" && statusFilter === "active" && (
            <Button onClick={openCreate}
              className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 px-6 rounded-xl shadow-md active:scale-95 transition-all">
              <Plus className="w-4 h-4 mr-2" /> Add Product
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={() => openEdit(product)}
              onView={() => openView(product)}
              onDelete={() => handleDelete(product.id)}
              onToggleStatus={() => handleToggleStatus(product)}
            />
          ))}
        </div>
      )}

      <ProductSheet
        open={sheetOpen}
        editing={editing}
        isViewing={isViewing}
        onClose={() => { setSheetOpen(false); setEditing(null); setIsViewing(false); }}
        onSaved={handleSaved}
      />
      <ImportCatalogModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleBulkImport}
      />
    </div>
  );
}
