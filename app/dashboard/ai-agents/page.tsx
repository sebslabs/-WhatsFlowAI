"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Bot, Edit3, Trash2, Send, Wand2, RefreshCw, Pause, Play,
  Loader2, AlertCircle, Brain, BookOpen, X, PlusCircle, Cpu,
  ChevronDown, ChevronUp, Globe, FileText, MessageSquare, Building2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-config";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

// ── Types ────────────────────────────────────────────────────────────────────

type KbSourceType = "business_context" | "faq" | "website_url" | "plain_text" | "existing_asset";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

interface KbSource {
  id: string;
  type: KbSourceType;
  expanded: boolean;
  // business_context
  context?: string;
  // faq
  faqs?: FaqEntry[];
  // website_url
  url?: string;
  // plain_text
  text?: string;
  label?: string;
  assetId?: string;

  // Dynamic Scraper States
  scrapingStatus?: string;
  scrapingProgress?: number;
  scrapingError?: string;
  activeJobId?: string | null;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  instructions: string;
  tone: string;
  model: string;
  kbSources: KbSource[];
  status: "active" | "paused";
  created_at?: string;
  pipeline?: string;
  phoneNumber?: string;
}

interface ChatMessage {
  sender: "user" | "ai";
  text: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TONE_OPTIONS = [
  { value: "Professional", label: "💼 Professional & Direct" },
  { value: "Friendly",     label: "😊 Friendly & Warm" },
  { value: "Enthusiastic", label: "🚀 Enthusiastic & Sales-Driven" },
  { value: "Empathetic",   label: "🤝 Compassionate & Helpful" },
];

const MODEL_OPTIONS = [
  // Google
  { value: "gemini-1-5-flash",   label: "Gemini 1.5 Flash",  badge: "Recommended / Fast", provider: "Google", logo: "https://img.icons8.com/ios-glyphs/30/bard.png" },
  { value: "gemini-1-5-pro",     label: "Gemini 1.5 Pro",    badge: "Large Context", provider: "Google", logo: "https://img.icons8.com/ios-glyphs/30/bard.png" },

  // Groq
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", badge: "Ultra-Fast / Elite", provider: "Groq", logo: "https://img.icons8.com/ios-filled/50/lightning-bolt.png" },
  { value: "llama-3.1-8b-instant",   label: "Llama 3.1 8B (Groq)",   badge: "Pure Speed",        provider: "Groq", logo: "https://img.icons8.com/ios-filled/50/lightning-bolt.png" },

  // OpenAI
  { value: "gpt-4o",             label: "GPT-4o",            badge: "Smart",       provider: "OpenAI", logo: "https://img.icons8.com/ios-glyphs/30/chatgpt.png" },
  { value: "gpt-4o-mini",        label: "GPT-4o Mini",       badge: "Fast",        provider: "OpenAI", logo: "https://img.icons8.com/ios-glyphs/30/chatgpt.png" },
  { value: "o1-preview",         label: "OpenAI o1 Preview", badge: "Reasoning",   provider: "OpenAI", logo: "https://img.icons8.com/ios-glyphs/30/chatgpt.png" },
  { value: "o1-mini",            label: "OpenAI o1 Mini",    badge: "Compact",     provider: "OpenAI", logo: "https://img.icons8.com/ios-glyphs/30/chatgpt.png" },
  { value: "gpt-4-turbo",        label: "GPT-4 Turbo",       badge: "Complex",     provider: "OpenAI", logo: "https://img.icons8.com/ios-glyphs/30/chatgpt.png" },
  
  // Anthropic
  { value: "claude-3-5-sonnet",  label: "Claude 3.5 Sonnet", badge: "Intelligent", provider: "Anthropic", logo: "https://img.icons8.com/ios-glyphs/30/claude-ai.png" },
  { value: "claude-3-5-haiku",   label: "Claude 3.5 Haiku",  badge: "Economy",     provider: "Anthropic", logo: "https://img.icons8.com/ios-glyphs/30/claude-ai.png" },
  { value: "claude-3-opus",      label: "Claude 3 Opus",     badge: "Power",       provider: "Anthropic", logo: "https://img.icons8.com/ios-glyphs/30/claude-ai.png" },

  // Meta
  { value: "llama-3-1-70b",      label: "Llama 3.1 70B",     badge: "Open Source", provider: "Meta",   logo: "https://img.icons8.com/ios-filled/50/meta.png" },
  { value: "llama-3-1-8b",       label: "Llama 3.1 8B",      badge: "Lightweight", provider: "Meta",   logo: "https://img.icons8.com/ios-filled/50/meta.png" },

  // Perplexity
  { value: "sonar-small-online", label: "Sonar Small",       badge: "Online / Search", provider: "Perplexity", logo: "https://img.icons8.com/ios-filled/50/perplexity-ai.png" },
  { value: "sonar-medium-online",label: "Sonar Medium",      badge: "Fast / Smart",  provider: "Perplexity", logo: "https://img.icons8.com/ios-filled/50/perplexity-ai.png" },

  // Mistral AI
  { value: "mistral-large-latest", label: "Mistral Large",   badge: "Enterprise / Smart", provider: "Mistral", logo: "https://img.icons8.com/ios-filled/50/wind.png" },
  { value: "mistral-small-latest", label: "Mistral Small",   badge: "Cost-Effective",     provider: "Mistral", logo: "https://img.icons8.com/ios-filled/50/wind.png" },
  { value: "open-mixtral-8x7b",    label: "Mixtral 8x7B",    badge: "Fast Open Weights",  provider: "Mistral", logo: "https://img.icons8.com/ios-filled/50/wind.png" },

  // DeepSeek
  { value: "deepseek-chat",      label: "DeepSeek Chat",     badge: "Efficiency",    provider: "DeepSeek", logo: "https://img.icons8.com/ios-filled/50/deepseek.png" },
  { value: "deepseek-coder",     label: "DeepSeek Coder",    badge: "Logic",         provider: "DeepSeek", logo: "https://img.icons8.com/ios-filled/50/deepseek.png" },

  // Grok
  { value: "grok-2",             label: "Grok 2",            badge: "Real-time",   provider: "Grok", logo: "https://img.icons8.com/ios-filled/50/grok.png" },

  // Jasper AI
  { value: "jasper-ai",          label: "Jasper AI",         badge: "Marketing",   provider: "Jasper AI", logo: "https://img.icons8.com/ios-filled/50/jasper-ai.png" },

  // OpenRouter (Cost-Cutting)
  { value: "openrouter/google/gemini-flash-1.5",           label: "Gemini 1.5 Flash (OpenRouter)",   badge: "Recommended / Cheap", provider: "OpenRouter", logo: "https://img.icons8.com/ios-glyphs/30/bard.png" },
  { value: "openrouter/meta-llama/llama-3.1-8b-instruct",  label: "Llama 3.1 8B (OpenRouter)",       badge: "Almost Free",         provider: "OpenRouter", logo: "https://img.icons8.com/ios-filled/50/meta.png" },
  { value: "openrouter/deepseek/deepseek-chat",            label: "DeepSeek V2.5 (OpenRouter)",      badge: "Elite / Cheap",       provider: "OpenRouter", logo: "https://img.icons8.com/ios-filled/50/deepseek.png" },
];

const PIPELINE_OPTIONS = [
  { value: "Default Pipeline",       label: "📋 Default Pipeline" },
  { value: "Inbound Sales",          label: "📥 Inbound Sales Pipeline" },
  { value: "Outbound Prospecting",   label: "📤 Outbound Prospecting" },
  { value: "High-Ticket Closing",    label: "💰 High-Ticket Closing" },
  { value: "Follow-up & Nurturing",  label: "🔄 Follow-up & Nurturing" },
];

const KB_SOURCE_TYPES: { type: KbSourceType; label: string; desc: string; icon: React.ElementType }[] = [
  { type: "business_context", label: "Business Context",  desc: "Services, pricing, hours, policies",   icon: Building2 },
  { type: "faq",              label: "FAQ / Q&A",         desc: "Common questions and answers",          icon: MessageSquare },
  { type: "website_url",      label: "Website URL",       desc: "Scrape content from a webpage",        icon: Globe },
  { type: "plain_text",       label: "Plain Text",        desc: "Add any text as a knowledge chunk",    icon: FileText },
  { type: "existing_asset",   label: "Linked Asset",      desc: "Stored knowledge reference",            icon: Database },
];

const selectItemClass =
  "text-[#111827] dark:text-[#F9FAFB] focus:bg-[#22C55E]/10 focus:text-[#22C55E] dark:focus:bg-[#22C55E]/10 dark:focus:text-[#22C55E] data-[state=checked]:bg-[#22C55E]/10 data-[state=checked]:text-[#22C55E] dark:data-[state=checked]:bg-[#22C55E]/10 dark:data-[state=checked]:text-[#22C55E] cursor-pointer";

// ── Main component ────────────────────────────────────────────────────────────

export default function AIAgentsPage() {
  const { toast } = useToast();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tone, setTone] = useState("Professional");
  const [model, setModel] = useState("mistral-large-latest");
  const [pipeline, setPipeline] = useState("Default Pipeline");
  const [phoneNumber, setPhoneNumber] = useState("all");
  const [availableNumbers, setAvailableNumbers] = useState<{ value: string; label: string }[]>([]);

  // KB state
  const [kbOpen, setKbOpen] = useState(false);
  const [kbSources, setKbSources] = useState<KbSource[]>([]);
  const [addKbType, setAddKbType] = useState("");

  // Sandbox state
  const [sandboxAgentId, setSandboxAgentId] = useState<string>("");
  const [previewInput, setPreviewInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────

  async function loadPhoneNumbers() {
    try {
      const numbers: { value: string; label: string }[] = [{ value: "all", label: "📱 All Numbers (Default)" }];
      
      // Fetch Meta config
      try {
        const metaConfig = await apiFetch("/api/whatsapp/config");
        if (metaConfig && metaConfig.display_phone_number) {
          numbers.push({
            value: metaConfig.display_phone_number.replace(/[^\d]/g, ""),
            label: `🏢 Meta Account: +${metaConfig.display_phone_number}`
          });
        }
      } catch (e) {
        console.log("No Meta number connected.");
      }
      
      // Fetch QR sessions
      try {
        const qrSessions = await apiFetch("/api/whatsapp/qr");
        const activeQr = qrSessions?.find((s: any) => s.status === 'connected');
        if (activeQr && activeQr.phone_number) {
          numbers.push({
            value: activeQr.phone_number.replace(/[^\d]/g, ""),
            label: `🔗 QR Connection: +${activeQr.phone_number}`
          });
        }
      } catch (e) {
        console.log("No QR number connected.");
      }
      
      setAvailableNumbers(numbers);
    } catch (err) {
      console.error("Failed to load active phone numbers:", err);
    }
  }

  async function loadAgents() {
    setLoading(true); setLoadError("");
    try {
      const data = await apiFetch("/api/ai-agents");
      const localExtras = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ai_agents_extras") || "{}") : {};
      const merged = data.map((a: Agent) => ({
        ...a,
        model: localExtras[a.id]?.model ?? a.model ?? "mistral-large-latest",
        pipeline: localExtras[a.id]?.pipeline ?? a.pipeline ?? "Default Pipeline",
        kbSources: (a.kbSources?.length ? a.kbSources : localExtras[a.id]?.kbSources) ?? [],
        phoneNumber: a.phoneNumber ?? "all"
      }));
      setAgents(merged);
      if (merged.length > 0) {
        const first = merged.find((a: Agent) => a.status === "active") ?? merged[0];
        setSandboxAgentId(first.id);
        setChatHistory([{ sender: "ai", text: `Hello! I'm ${first.name}. How can I help you today?` }]);
      }
    } catch {
      setLoadError("Could not load AI agents. Make sure the backend server is running.");
    } finally {
      setLoading(false);
    }
  }

  const [globalKbItems, setGlobalKbItems] = useState<any[]>([]);

  useEffect(() => { 
    loadAgents(); 
    loadPhoneNumbers();
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isTyping]);

  useEffect(() => {
    async function loadGlobalKb() {
      try {
        const data = await apiFetch("/api/knowledge");
        if (data && Array.isArray(data)) {
          setGlobalKbItems(data);
        }
      } catch (err) {
        console.error("Failed to fetch knowledge sources:", err);
      }
    }
    loadGlobalKb();
  }, []);

  const getSourceScrapeProgressMessage = (status?: string, progress?: number, error?: string) => {
    switch (status) {
      case "queued": return "Queueing website scraping task...";
      case "scraping": return "Initializing browser, downloading HTML code...";
      case "processing": return "Cleaning HTML clutter, parsing semantic text blocks...";
      case "embedding": return `Calculating AI vector matrices (${progress ?? 0}%)...`;
      case "completed": return "Website successfully ingested and vectorized!";
      case "failed": return `Scraping failed: ${error || "Unknown error"}`;
      default: return "Scraping...";
    }
  };

  async function handleScrapeWebsite(sourceId: string, url: string, label: string) {
    if (!url.trim()) {
      toast("Please enter a target website URL", "error");
      return;
    }

    try {
      new URL(url); // Basic URL format check
    } catch {
      toast("Please enter a valid URL (including http:// or https://)", "error");
      return;
    }

    updateKbSource(sourceId, {
      scrapingStatus: "queued",
      scrapingProgress: 5,
      scrapingError: ""
    });

    try {
      const res = await apiFetch("/api/scrape", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          label: label.trim() || undefined,
        }),
      });

      if (res && res.jobId) {
        updateKbSource(sourceId, {
          activeJobId: res.jobId,
          scrapingStatus: res.status || "queued"
        });
        toast("Website scraping background task started!", "success");
      } else {
        throw new Error("Invalid response received from scraping service.");
      }
    } catch (err: any) {
      updateKbSource(sourceId, {
        scrapingStatus: "failed",
        scrapingProgress: 0,
        scrapingError: err.message || "Failed to start scraping."
      });
      toast(err.message || "Failed to trigger scrape operation.", "error");
    }
  }

  // Poll scraping progress for any active scraper jobs in kbSources
  useEffect(() => {
    const activeJobs = kbSources.filter(s => s.activeJobId && s.scrapingStatus !== "completed" && s.scrapingStatus !== "failed");
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const job of activeJobs) {
        try {
          const data = await apiFetch(`/api/scrape/status/${job.activeJobId}`);
          if (data) {
            if (data.status === "completed") {
              toast("Website successfully scraped and trained! ✓", "success");
              
              // 1. Reload global KB items
              let freshKbItems: any[] = [];
              try {
                const freshData = await apiFetch("/api/knowledge");
                if (freshData && Array.isArray(freshData)) {
                  setGlobalKbItems(freshData);
                  freshKbItems = freshData;
                }
              } catch (e) {
                console.error("Failed to reload KB items:", e);
              }

              // 2. Find the asset that was created
              const matchingAsset = freshKbItems.find((item: any) => item.sourceUrl === job.url || item.title === job.url || item.title === job.label);
              
              // 3. Convert source to existing_asset type
              updateKbSource(job.id, {
                type: "existing_asset",
                assetId: matchingAsset?.id || job.activeJobId,
                label: matchingAsset?.title || job.label || "Linked Scraping Asset",
                scrapingStatus: "completed",
                activeJobId: null,
                scrapingProgress: 100
              });
            } else if (data.status === "failed") {
              updateKbSource(job.id, {
                scrapingStatus: "failed",
                activeJobId: null,
                scrapingError: data.error_message || "Website scraping failed."
              });
              toast(data.error_message || "Scraping failed.", "error");
            } else {
              updateKbSource(job.id, {
                scrapingStatus: data.status,
                scrapingProgress: data.progress
              });
            }
          }
        } catch (err: any) {
          console.error("Error polling scrape status for source:", job.id, err);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [kbSources]);

  // ── KB helpers ────────────────────────────────────────────────────────────

  function addKbSource() {
    if (!addKbType) return;
    let base: KbSource;
    if (addKbType.startsWith("asset:")) {
      const assetId = addKbType.split(":")[1];
      const asset = globalKbItems.find(a => a.id === assetId);
      base = { 
        id: crypto.randomUUID(), 
        type: "existing_asset", 
        expanded: false, 
        label: asset?.title || "Linked Knowledge Asset",
        assetId 
      };
    } else {
      base = { id: crypto.randomUUID(), type: addKbType as KbSourceType, expanded: true };
      if (addKbType === "faq") base.faqs = [];
    }
    setKbSources(prev => [...prev, base]);
    setAddKbType("");
  }

  function removeKbSource(id: string) {
    setKbSources(prev => prev.filter(s => s.id !== id));
  }

  function toggleKbSource(id: string) {
    setKbSources(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  }

  function updateKbSource(id: string, patch: Partial<KbSource>) {
    setKbSources(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }

  function addFaqEntry(sourceId: string) {
    setKbSources(prev => prev.map(s => s.id === sourceId
      ? { ...s, faqs: [...(s.faqs ?? []), { id: crypto.randomUUID(), question: "", answer: "" }] }
      : s
    ));
  }

  function removeFaqEntry(sourceId: string, faqId: string) {
    setKbSources(prev => prev.map(s => s.id === sourceId
      ? { ...s, faqs: s.faqs?.filter(f => f.id !== faqId) }
      : s
    ));
  }

  function updateFaqEntry(sourceId: string, faqId: string, field: "question" | "answer", value: string) {
    setKbSources(prev => prev.map(s => s.id === sourceId
      ? { ...s, faqs: s.faqs?.map(f => f.id === faqId ? { ...f, [field]: value } : f) }
      : s
    ));
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  function resetForm() {
    setEditingAgent(null);
    setName(""); setRole(""); setInstructions(""); setTone("Professional");
    setModel("mistral-large-latest"); setPipeline("Default Pipeline"); setKbSources([]); setKbOpen(false); setAddKbType("");
    setPhoneNumber("all");
  }

  async function handleSaveAgent() {
    if (!name.trim() || !role.trim() || !instructions.trim()) {
      toast("Please fill in all fields", "error");
      return;
    }
    setSaving(true);
    const payload = { name, role, instructions, tone, model, kbSources, phoneNumber };
    try {
      if (editingAgent) {
        const updated = await apiFetch(`/api/ai-agents/${editingAgent.id}`, {
          method: "PUT", body: JSON.stringify(payload),
        });
        const localExtras = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ai_agents_extras") || "{}") : {};
        localExtras[editingAgent.id] = { model, pipeline, kbSources };
        if (typeof window !== "undefined") localStorage.setItem("ai_agents_extras", JSON.stringify(localExtras));
        const fullUpdated = { ...updated, model, pipeline, kbSources, phoneNumber };

        setAgents(prev => prev.map(a => a.id === editingAgent.id ? fullUpdated : a));
        if (sandboxAgentId === editingAgent.id)
          setChatHistory([{ sender: "ai", text: `Hello! I'm ${fullUpdated.name}. How can I help you today?` }]);
        toast("Agent updated successfully", "success");
      } else {
        const created = await apiFetch("/api/ai-agents", {
          method: "POST", body: JSON.stringify(payload),
        });
        const localExtras = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ai_agents_extras") || "{}") : {};
        localExtras[created.id] = { model, pipeline, kbSources };
        if (typeof window !== "undefined") localStorage.setItem("ai_agents_extras", JSON.stringify(localExtras));
        const fullCreated = { ...created, model, pipeline, kbSources, phoneNumber };

        setAgents(prev => [fullCreated, ...prev]);
        if (!sandboxAgentId) {
          setSandboxAgentId(created.id);
          setChatHistory([{ sender: "ai", text: `Hello! I'm ${fullCreated.name}. How can I help you today?` }]);
        }
        toast("Agent created successfully", "success");
      }
      setIsCreating(false); resetForm();
    } catch {
      toast("Failed to save agent", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleEditClick(agent: Agent) {
    setEditingAgent(agent);
    setName(agent.name); setRole(agent.role);
    setInstructions(agent.instructions); setTone(agent.tone);
    setModel(agent.model ?? "mistral-large-latest");
    setPipeline(agent.pipeline ?? "Default Pipeline");
    setKbSources(agent.kbSources ?? []);
    setKbOpen((agent.kbSources ?? []).length > 0);
    setPhoneNumber(agent.phoneNumber ?? "all");
    setIsCreating(true);
  }

  async function handleDeleteAgent(id: string) {
    try {
      await apiFetch(`/api/ai-agents/${id}`, { method: "DELETE" });
      const localExtras = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("ai_agents_extras") || "{}") : {};
      delete localExtras[id];
      if (typeof window !== "undefined") localStorage.setItem("ai_agents_extras", JSON.stringify(localExtras));

      const remaining = agents.filter(a => a.id !== id);
      setAgents(remaining);
      if (sandboxAgentId === id) {
        const next = remaining.find(a => a.status === "active") ?? remaining[0];
        if (next) { setSandboxAgentId(next.id); setChatHistory([{ sender: "ai", text: `Hello! I'm ${next.name}. How can I help you today?` }]); }
        else { setSandboxAgentId(""); setChatHistory([]); }
      }
      toast("Agent deleted", "success");
    } catch { toast("Failed to delete agent", "error"); }
  }

  async function handleToggleStatus(agent: Agent) {
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      const updated = await apiFetch(`/api/ai-agents/${agent.id}/status`, {
        method: "PATCH", body: JSON.stringify({ status: newStatus }),
      });
      setAgents(prev => prev.map(a => a.id === agent.id ? updated : a));
    } catch { toast("Failed to update status", "error"); }
  }

  async function handleTestMessage() {
    if (!previewInput.trim() || !sandboxAgentId || isTyping) return;
    const msg = previewInput.trim();
    setPreviewInput("");
    setChatHistory(prev => [...prev, { sender: "user", text: msg }]);
    setIsTyping(true);
    try {
      const apiHistory = chatHistory.map(m => ({
        role: m.sender === "user" ? "user" as const : "assistant" as const,
        content: m.text,
      }));
      const { reply } = await apiFetch(`/api/ai-agents/${sandboxAgentId}/chat`, {
        method: "POST", body: JSON.stringify({ message: msg, history: apiHistory }),
      });
      setChatHistory(prev => [...prev, { sender: "ai", text: reply }]);
    } catch {
      setChatHistory(prev => [...prev, { sender: "ai", text: "Sorry, I couldn't connect to the AI service right now." }]);
    } finally { setIsTyping(false); }
  }

  function handleSandboxAgentChange(id: string) {
    setSandboxAgentId(id);
    const agent = agents.find(a => a.id === id);
    setChatHistory(agent ? [{ sender: "ai", text: `Hello! I'm ${agent.name}. How can I help you today?` }] : []);
  }

  // ── Shared style tokens ────────────────────────────────────────────────────

  const sandboxAgent = agents.find(a => a.id === sandboxAgentId);
  const selectedModel = MODEL_OPTIONS.find(m => m.value === model);

  const fieldClass = "bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl h-10 font-medium placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280]";
  const labelClass = "text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]";
  const selectTriggerClass = "bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl h-10";
  const selectContentClass = "bg-white dark:bg-[#111827] border-[#E5E7EB] dark:border-[#1F2937]";
  const innerFieldClass = "bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-lg font-medium placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280]";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] dark:text-[#F9FAFB]">AI Agents</h1>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
            Configure AI personalities to automatically reply, qualify leads, and handle chats.
          </p>
        </div>
        {!isCreating && (
          <Button
            className="bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-10 rounded-xl px-4 shadow-md shadow-[#22C55E]/15 active:scale-95 transition-all self-start md:self-center"
            onClick={() => { resetForm(); setIsCreating(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Agent
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — list or form */}
        <div className="lg:col-span-2 space-y-5">
          <AnimatePresence mode="wait">
            {isCreating ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-6 rounded-2xl shadow-sm space-y-5"
              >
                {/* Form header */}
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#111827] dark:text-[#F9FAFB]">
                    {editingAgent ? "Edit AI Agent" : "New AI Agent"}
                  </h3>
                  <Button
                    variant="ghost"
                    className="text-xs h-7 text-[#6B7280] dark:text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                    onClick={() => { setIsCreating(false); resetForm(); }}
                  >
                    Cancel
                  </Button>
                </div>

                {/* ── Identity ── */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-[#22C55E]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#22C55E]">Identity</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Agent Name</Label>
                      <Input placeholder="e.g. Sales Closer AI" value={name} onChange={e => setName(e.target.value)} className={fieldClass} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Role</Label>
                      <Input placeholder="e.g. Lead qualification" value={role} onChange={e => setRole(e.target.value)} className={fieldClass} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className={labelClass}>Tone & Voice</Label>
                      <Select value={tone} onValueChange={setTone}>
                        <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                        <SelectContent className={selectContentClass}>
                          {TONE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className={labelClass}>AI Model</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className={selectTriggerClass}>
                          <div className="flex items-center gap-2 overflow-hidden">
                            {selectedModel?.logo ? (
                              <img src={selectedModel.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />
                            ) : (
                              <Cpu className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                            )}
                            <span className="truncate text-sm">{selectedModel?.label ?? model}</span>
                            {selectedModel && (
                              <span className="ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#22C55E]/10 text-[#22C55E]">
                                {selectedModel.badge}
                              </span>
                            )}
                          </div>
                        </SelectTrigger>
                        <SelectContent className={cn(selectContentClass, "max-h-[320px]")} side="bottom">
                          <div className="px-2 pt-2 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#22C55E]">🌪️ Mistral (Default)</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Mistral").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#D1FAE5] dark:bg-[#064E3B] text-[#047857] dark:text-[#34D399]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}

                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Google</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Google").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}

                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#22C55E]">🔥 Groq (Ultra Fast)</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Groq").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#D1FAE5] dark:bg-[#064E3B] text-[#047857] dark:text-[#34D399]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}

                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">OpenAI</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "OpenAI").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}


                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Meta</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Meta").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Perplexity</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Perplexity").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">DeepSeek</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "DeepSeek").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Grok</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Grok").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}
                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Jasper AI</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "Jasper AI").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}

                          <div className="px-2 pt-3 pb-1">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#22C55E]">🌪️ OpenRouter (Cost-Cutting)</p>
                          </div>
                          {MODEL_OPTIONS.filter(m => m.provider === "OpenRouter").map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                              <div className="flex items-center justify-between w-full gap-6">
                                <div className="flex items-center gap-2">
                                  {opt.logo && <img src={opt.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />}
                                  <span>{opt.label}</span>
                                </div>
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#D1FAE5] dark:bg-[#064E3B] text-[#047857] dark:text-[#34D399]">{opt.badge}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Targeted Phone Number</Label>
                    <Select value={phoneNumber} onValueChange={setPhoneNumber}>
                      <SelectTrigger className={selectTriggerClass}><SelectValue /></SelectTrigger>
                      <SelectContent className={selectContentClass}>
                        {availableNumbers.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                      Direct this AI Agent to reply only when messages are received on this specific phone number.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Instructions (System Prompt)</Label>
                    <Textarea
                      placeholder="Describe how this agent should behave, what questions to ask, what to offer..."
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      rows={4}
                      className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl font-medium resize-none leading-relaxed placeholder:text-[#9CA3AF] dark:placeholder:text-[#6B7280]"
                    />
                  </div>
                </div>

                {/* ── Knowledge Base (collapsible) ── */}
                <div className="border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl overflow-hidden">
                  {/* Header — click to expand/collapse */}
                  <button
                    type="button"
                    onClick={() => setKbOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#F9FAFB] dark:bg-[#0B0F1A] hover:bg-[#F3F4F6] dark:hover:bg-[#111827] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#22C55E]" />
                      <span className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Knowledge Base</span>
                      {kbSources.length > 0 && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E]">
                          {kbSources.length} source{kbSources.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">
                        {kbOpen ? "Collapse" : "Configure"}
                      </span>
                      {kbOpen
                        ? <ChevronUp className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                        : <ChevronDown className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                      }
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {kbOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                            Add knowledge sources so the agent responds accurately about your business.
                          </p>

                          {/* Existing sources */}
                          {kbSources.length > 0 && (
                            <div className="space-y-2">
                              {kbSources.map(source => {
                                const meta = KB_SOURCE_TYPES.find(t => t.type === source.type)!;
                                const Icon = meta.icon;
                                return (
                                  <div
                                    key={source.id}
                                    className="border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl overflow-hidden"
                                  >
                                    {/* Source header */}
                                    <div className="flex items-center justify-between px-3 py-2.5 bg-[#F9FAFB] dark:bg-[#0B0F1A]">
                                      <button
                                        type="button"
                                        onClick={() => toggleKbSource(source.id)}
                                        className="flex items-center gap-2 flex-1 text-left"
                                      >
                                        <Icon className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                                        <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">{meta.label}</span>
                                        {source.label && (
                                          <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate max-w-[160px]">— {source.label}</span>
                                        )}
                                        {source.type === "faq" && (source.faqs?.length ?? 0) > 0 && (
                                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E]">
                                            {source.faqs!.length} Q&A
                                          </span>
                                        )}
                                        {source.expanded
                                          ? <ChevronUp className="w-3.5 h-3.5 text-[#9CA3AF] ml-auto" />
                                          : <ChevronDown className="w-3.5 h-3.5 text-[#9CA3AF] ml-auto" />
                                        }
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeKbSource(source.id)}
                                        className="ml-2 text-[#9CA3AF] hover:text-red-500 transition-colors shrink-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Source body */}
                                    <AnimatePresence initial={false}>
                                      {source.expanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.15 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="p-3 space-y-3">
                                            {/* Label field for all types */}
                                            <Input
                                              placeholder="Label (optional, e.g. 'Main clinic info')"
                                              value={source.label ?? ""}
                                              onChange={e => updateKbSource(source.id, { label: e.target.value })}
                                              className={`${innerFieldClass} h-8 text-xs`}
                                            />

                                            {/* Existing Asset Reference */}
                                            {source.type === "existing_asset" && (
                                              <div className="flex items-center gap-3 p-3 bg-[#22C55E]/5 border border-[#22C55E]/20 rounded-xl">
                                                <Database className="w-5 h-5 text-[#22C55E] shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                  <p className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB] truncate">
                                                    {globalKbItems.find(a => a.id === source.assetId)?.title || source.label || "Linked Asset"}
                                                  </p>
                                                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] font-medium">
                                                    Asset ID: {source.assetId}
                                                  </p>
                                                </div>
                                              </div>
                                            )}

                                            {/* Business Context */}
                                            {source.type === "business_context" && (
                                              <Textarea
                                                placeholder={`Describe your business, services, pricing, opening hours, location...\n\ne.g. SmilePlus Dental — New York\nServices: Checkup $80 · Whitening $250 · Implants from $1,200\nHours: Mon–Sat 9am–6pm`}
                                                value={source.context ?? ""}
                                                onChange={e => updateKbSource(source.id, { context: e.target.value })}
                                                rows={5}
                                                className={`${innerFieldClass} resize-none leading-relaxed text-xs`}
                                              />
                                            )}

                                            {/* Website URL */}
                                            {source.type === "website_url" && (
                                              <div className="space-y-3">
                                                {(!source.scrapingStatus || source.scrapingStatus === "idle") ? (
                                                  <div className="flex gap-2">
                                                    <Input
                                                      placeholder="https://yourwebsite.com/about"
                                                      value={source.url ?? ""}
                                                      onChange={e => updateKbSource(source.id, { url: e.target.value })}
                                                      className={`${innerFieldClass} h-9 text-xs flex-1`}
                                                    />
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      onClick={() => handleScrapeWebsite(source.id, source.url ?? "", source.label ?? "")}
                                                      className="h-9 px-3 bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 font-bold text-xs rounded-lg shrink-0"
                                                    >
                                                      <Globe className="w-3.5 h-3.5 mr-1.5" /> Scrape
                                                    </Button>
                                                  </div>
                                                ) : source.scrapingStatus === "failed" ? (
                                                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl p-4 space-y-3">
                                                    <p className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                      {getSourceScrapeProgressMessage(source.scrapingStatus, source.scrapingProgress, source.scrapingError)}
                                                    </p>
                                                    <Button
                                                      type="button"
                                                      size="sm"
                                                      onClick={() => updateKbSource(source.id, { scrapingStatus: "idle", scrapingProgress: 0, scrapingError: "" })}
                                                      className="h-8 px-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold text-xs rounded-lg animate-pulse"
                                                    >
                                                      Retry Scraping
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-xl p-4 space-y-3">
                                                    <div className="flex items-center justify-between text-[10px] font-bold text-[#111827] dark:text-[#F9FAFB] uppercase tracking-wider">
                                                      <span>Scraping Website...</span>
                                                      <Loader2 className="w-3.5 h-3.5 text-[#22C55E] animate-spin" />
                                                    </div>
                                                    <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                                                      <div 
                                                        className="bg-[#22C55E] h-2 rounded-full transition-all duration-500 ease-out" 
                                                        style={{ width: `${source.scrapingProgress ?? 0}%` }}
                                                      />
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-[#6B7280] dark:text-[#9CA3AF]">
                                                      {getSourceScrapeProgressMessage(source.scrapingStatus, source.scrapingProgress)}
                                                    </p>
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {/* Plain Text */}
                                            {source.type === "plain_text" && (
                                              <Textarea
                                                placeholder="Paste any text you want the agent to know about..."
                                                value={source.text ?? ""}
                                                onChange={e => updateKbSource(source.id, { text: e.target.value })}
                                                rows={5}
                                                className={`${innerFieldClass} resize-none leading-relaxed text-xs`}
                                              />
                                            )}

                                            {/* FAQ */}
                                            {source.type === "faq" && (
                                              <div className="space-y-2">
                                                {(source.faqs ?? []).length === 0 && (
                                                  <p className="text-[11px] text-[#9CA3AF] dark:text-[#6B7280] text-center py-2">No FAQ entries yet.</p>
                                                )}
                                                {(source.faqs ?? []).map((faq, i) => (
                                                  <div key={faq.id} className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-lg p-2.5 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                      <span className="text-[9px] font-bold text-[#9CA3AF] uppercase tracking-wider">#{i + 1}</span>
                                                      <button type="button" onClick={() => removeFaqEntry(source.id, faq.id)} className="text-[#9CA3AF] hover:text-red-500 transition-colors">
                                                        <X className="w-3 h-3" />
                                                      </button>
                                                    </div>
                                                    <Input
                                                      placeholder="Question: e.g. What are your hours?"
                                                      value={faq.question}
                                                      onChange={e => updateFaqEntry(source.id, faq.id, "question", e.target.value)}
                                                      className={`${innerFieldClass} h-8 text-xs`}
                                                    />
                                                    <Textarea
                                                      placeholder="Answer: e.g. We're open Mon–Sat 9am–6pm."
                                                      value={faq.answer}
                                                      onChange={e => updateFaqEntry(source.id, faq.id, "answer", e.target.value)}
                                                      rows={2}
                                                      className={`${innerFieldClass} resize-none text-xs`}
                                                    />
                                                  </div>
                                                ))}
                                                <button
                                                  type="button"
                                                  onClick={() => addFaqEntry(source.id)}
                                                  className="flex items-center gap-1.5 text-xs font-bold text-[#22C55E] hover:text-[#16A34A] transition-colors mt-1"
                                                >
                                                  <PlusCircle className="w-3.5 h-3.5" /> Add Q&A pair
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add new source row */}
                          <div className="flex gap-2">
                            <Select value={addKbType} onValueChange={v => setAddKbType(v)}>
                              <SelectTrigger className="flex-1 h-9 bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl text-xs">
                                <SelectValue placeholder="Add source or select existing asset…" />
                              </SelectTrigger>
                              <SelectContent className={selectContentClass}>
                                <div className="px-2 pt-2 pb-1">
                                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Create Manual Source</p>
                                </div>
                                {KB_SOURCE_TYPES.filter(t => t.type !== "existing_asset").map(t => {
                                  const Icon = t.icon;
                                  return (
                                    <SelectItem key={t.type} value={t.type} className={selectItemClass}>
                                      <div className="flex items-center gap-2.5">
                                        <Icon className="w-3.5 h-3.5 shrink-0" />
                                        <div>
                                          <p className="text-xs font-bold">{t.label}</p>
                                          <p className="text-[10px] text-[#9CA3AF]">{t.desc}</p>
                                        </div>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                                {globalKbItems.length > 0 && (
                                  <>
                                    <div className="px-2 pt-3 pb-1 border-t border-[#E5E7EB] dark:border-[#1F2937] mt-1">
                                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">Link Existing Knowledge</p>
                                    </div>
                                    {globalKbItems.map(asset => (
                                      <SelectItem key={asset.id} value={`asset:${asset.id}`} className={selectItemClass}>
                                        <div className="flex items-center gap-2.5">
                                          <Database className="w-3.5 h-3.5 shrink-0 text-[#22C55E]" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold truncate">{asset.title}</p>
                                            <p className="text-[9px] text-[#9CA3AF] uppercase">{asset.type}</p>
                                          </div>
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              onClick={addKbSource}
                              disabled={!addKbType}
                              className="h-9 px-4 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold text-xs rounded-xl shrink-0 disabled:opacity-40"
                            >
                              <Plus className="w-3.5 h-3.5 mr-1" /> Add
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Save */}
                <Button
                  className="w-full bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold h-11 rounded-xl shadow-md active:scale-95 transition-all"
                  onClick={handleSaveAgent}
                  disabled={saving}
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                    : <><Wand2 className="w-4 h-4 mr-2" /> {editingAgent ? "Save Changes" : "Save AI Agent"}</>
                  }
                </Button>
              </motion.div>

            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-[#6B7280] dark:text-[#9CA3AF] gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Loading agents…</span>
                  </div>
                ) : loadError ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/10 rounded-2xl flex items-center justify-center">
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
                      onClick={loadAgents}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                    </Button>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center border border-dashed border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl">
                    <div className="w-12 h-12 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center">
                      <Bot className="w-6 h-6 text-[#22C55E]" />
                    </div>
                    <p className="text-sm font-semibold text-[#111827] dark:text-[#F9FAFB]">No AI agents yet</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Create your first agent to start automating conversations.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {agents.map(agent => (
                      <div
                        key={agent.id}
                        className={cn(
                          "bg-white dark:bg-[#111827] border rounded-2xl p-5 shadow-sm hover:border-[#22C55E]/30 transition-all flex flex-col justify-between",
                          sandboxAgentId === agent.id
                            ? "border-[#22C55E]/50 dark:border-[#22C55E]/40"
                            : "border-[#E5E7EB] dark:border-[#1F2937]"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-9 h-9 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 text-[#22C55E] rounded-xl flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">{agent.name}</h4>
                                <p className="text-[10px] text-[#22C55E] font-semibold">{agent.tone}</p>
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md",
                              agent.status === "active"
                                ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            )}>{agent.status}</span>
                          </div>

                           {agent.model && (
                            <div className="flex items-center gap-1.5 mb-3">
                               {MODEL_OPTIONS.find(m => m.value === agent.model)?.logo ? (
                                 <img src={MODEL_OPTIONS.find(m => m.value === agent.model)?.logo} alt="" className="w-4 h-4 shrink-0 object-contain rounded bg-white p-0.5" />
                              ) : (
                                <Cpu className="w-3 h-3 text-[#6B7280] dark:text-[#9CA3AF]" />
                              )}
                              <span className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                                {MODEL_OPTIONS.find(m => m.value === agent.model)?.label ?? agent.model}
                              </span>
                              {agent.pipeline && (
                                <>
                                  <span className="text-[#E5E7EB] dark:text-[#1F2937]">·</span>
                                  <span className="text-[10px] font-bold text-[#22C55E]">
                                    {PIPELINE_OPTIONS.find(p => p.value === agent.pipeline)?.label ?? agent.pipeline}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-1">Role</p>
                          <p className="text-xs text-[#111827] dark:text-[#F9FAFB] font-medium leading-relaxed mb-3">{agent.role}</p>
                          <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] mb-1">Instructions</p>
                          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium leading-relaxed italic line-clamp-3">"{agent.instructions}"</p>

                          {(agent.kbSources ?? []).length > 0 && (
                            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937]">
                              <BookOpen className="w-3 h-3 text-[#22C55E]" />
                              <span className="text-[10px] text-[#22C55E] font-semibold">
                                {agent.kbSources.length} knowledge source{agent.kbSources.length > 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#1F2937]">
                          <button
                            onClick={() => handleSandboxAgentChange(agent.id)}
                            className={cn(
                              "text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all",
                              sandboxAgentId === agent.id
                                ? "bg-[#22C55E]/10 text-[#22C55E]"
                                : "text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] hover:bg-[#22C55E]/10"
                            )}
                          >
                            {sandboxAgentId === agent.id ? "Testing ✓" : "Test in sandbox"}
                          </button>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(agent)}
                              title={agent.status === "active" ? "Pause agent" : "Activate agent"}
                              className="h-8 w-8 p-0 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] rounded-xl hover:bg-[#22C55E]/10">
                              {agent.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(agent)}
                              className="h-8 w-8 p-0 text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#22C55E] rounded-xl hover:bg-[#22C55E]/10">
                              <Edit3 className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeletingAgent(agent)}
                              className="h-8 w-8 p-0 text-[#6B7280] dark:text-[#9CA3AF] hover:text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right — AI sandbox */}
        <div>
          <div className="bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl shadow-sm p-4 h-[calc(100vh-14rem)] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] dark:border-[#1F2937] pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full", sandboxAgent?.status === "active" ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
                <span className="text-xs font-bold text-[#111827] dark:text-[#F9FAFB]">Agent Sandbox</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => { if (!sandboxAgent) return; setChatHistory([{ sender: "ai", text: `Hello! I'm ${sandboxAgent.name}. How can I help you today?` }]); }}
                className="h-6 text-[10px] px-2 font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                <RefreshCw className="w-3 h-3 mr-1" /> Reset
              </Button>
            </div>

            {agents.length > 0 && (
              <div className="mb-3 shrink-0">
                <Select value={sandboxAgentId} onValueChange={handleSandboxAgentChange}>
                  <SelectTrigger className="h-8 text-xs bg-[#F9FAFB] dark:bg-[#0B0F1A] border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl">
                    <SelectValue placeholder="Select agent to test…" />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id} className={selectItemClass}>
                        <span className="text-xs">{a.name}</span>
                        {a.status === "paused" && <span className="ml-1 text-[10px] text-gray-400">(paused)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sandboxAgent?.model && (
              <div className="flex items-center gap-1.5 mb-3 shrink-0 flex-wrap">
                <Cpu className="w-3 h-3 text-[#9CA3AF]" />
                <span className="text-[10px] text-[#9CA3AF]">
                  {MODEL_OPTIONS.find(m => m.value === sandboxAgent.model)?.label ?? sandboxAgent.model}
                </span>
                {sandboxAgent.pipeline && (
                  <>
                    <span className="text-[#E5E7EB] dark:text-[#1F2937]">·</span>
                    <span className="text-[10px] font-bold text-[#22C55E]">{PIPELINE_OPTIONS.find(p => p.value === sandboxAgent.pipeline)?.label ?? sandboxAgent.pipeline}</span>
                  </>
                )}
                {(sandboxAgent.kbSources ?? []).length > 0 && (
                  <>
                    <span className="text-[#E5E7EB] dark:text-[#1F2937]">·</span>
                    <Brain className="w-3 h-3 text-[#22C55E]" />
                    <span className="text-[10px] text-[#22C55E]">{sandboxAgent.kbSources.length} KB source{sandboxAgent.kbSources.length > 1 ? "s" : ""}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
              {!sandboxAgentId ? (
                <div className="flex items-center justify-center h-full text-center">
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Create or select an agent<br />to start testing</p>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex", msg.sender === "user" ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 text-xs font-medium leading-relaxed",
                        msg.sender === "user"
                          ? "bg-[#22C55E] text-white rounded-tr-sm shadow-sm"
                          : "bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-tl-sm"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] rounded-2xl rounded-tl-sm px-3 py-2 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </>
              )}
            </div>

            <div className="border-t border-[#E5E7EB] dark:border-[#1F2937] pt-3 mt-3 shrink-0">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={sandboxAgentId ? "Type a message…" : "Select an agent first"}
                  value={previewInput}
                  onChange={e => setPreviewInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleTestMessage()}
                  disabled={!sandboxAgentId || isTyping}
                  className="bg-[#F9FAFB] dark:bg-[#0B0F1A] border border-[#E5E7EB] dark:border-[#1F2937] text-[#111827] dark:text-[#F9FAFB] rounded-xl h-10 font-medium text-xs focus-visible:ring-[#22C55E]/20 disabled:opacity-50"
                />
                <Button
                  onClick={handleTestMessage}
                  disabled={!sandboxAgentId || !previewInput.trim() || isTyping}
                  className="h-10 w-10 p-0 bg-[#22C55E] hover:bg-[#16A34A] text-white rounded-xl shadow-md active:scale-95 transition-all shrink-0 disabled:opacity-50"
                >
                  {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              {sandboxAgent && (
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] mt-1.5 text-center">
                  Powered by {MODEL_OPTIONS.find(m => m.value === sandboxAgent.model)?.label ?? "GPT-4o"} · reflects agent's actual prompt
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {deletingAgent && (
        <ConfirmDeleteDialog
          open={!!deletingAgent}
          onOpenChange={(open) => !open && setDeletingAgent(null)}
          title={`Delete AI Agent "${deletingAgent.name}"?`}
          description="This will permanently delete this AI agent and its configuration. This agent will no longer be available to handle any automated chats."
          onConfirm={async () => {
            await handleDeleteAgent(deletingAgent.id);
            setDeletingAgent(null);
          }}
          trigger={<span className="hidden" />}
        />
      )}
    </div>
  );
}
