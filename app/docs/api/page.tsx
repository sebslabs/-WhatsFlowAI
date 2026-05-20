"use client";

import { motion } from "framer-motion";
import { MessageCircle, Copy, Check, Terminal, Globe, Shield, Zap, Settings, Link, Info } from "lucide-react";
import { useState, useEffect } from "react";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

const sections = [
  { id: "intro", title: "Introduction" },
  { id: "config", title: "WhatsApp Setup" },
  { id: "auth", title: "Authentication" },
  { id: "send", title: "Send Message" },
  { id: "leads", title: "Lead Management" },
  { id: "webhooks", title: "Webhooks" },
];

export default function APIDocsPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("intro");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    const handleIntersect = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: "-20% 0px -70% 0px", // Adjust to trigger when section is in top half
      threshold: 0,
    });

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-12">
          
          {/* Sidebar Nav */}
          <aside className="hidden lg:block lg:col-span-3 sticky top-32 h-fit">
            <div className="relative pl-4 border-l border-gray-100">
              <h4 className="font-bold text-[#0F1F0F] text-[10px] uppercase tracking-widest mb-6 -ml-4">Documentation</h4>
              
              {/* Animated Indicator Track */}
              <div className="absolute left-0 top-10 bottom-0 w-[2px] bg-gray-100/50" />
              
              <nav className="flex flex-col gap-1 relative">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={`text-sm font-medium transition-all py-2 pr-4 flex items-center relative ${
                      activeSection === s.id ? "text-[#16A34A] font-bold" : "text-[#6B7B6B] hover:text-[#0F1F0F]"
                    }`}
                  >
                    {activeSection === s.id && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute -left-[17px] w-[3px] h-6 bg-[#16A34A] rounded-full shadow-[0_0_10px_rgba(22,163,74,0.4)] z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="col-span-full lg:col-span-9 space-y-24">
            
            {/* Intro */}
            <section id="intro" className="scroll-mt-32">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A] text-[10px] font-bold uppercase tracking-wider mb-6">
                API v1.0
              </span>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F1F0F] mb-6 tracking-tight">API Reference</h1>
              <p className="text-lg text-[#6B7B6B] leading-relaxed max-w-2xl">
                The WhatsFlow AI API allows you to programmatically manage your WhatsApp conversations, leads, and automation workflows. Integrate WhatsFlow directly into your own applications, CRM, or custom tools.
              </p>
            </section>

            {/* WhatsApp Setup */}
            <section id="config" className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                  <Settings className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold">WhatsApp Setup</h2>
              </div>
              <p className="text-[#6B7B6B] mb-6 leading-relaxed">
                Connect your official Meta WhatsApp Business Account to WhatsFlow AI using simple technical steps to unlock automated conversation pipelines.
              </p>

              <div className="grid gap-6">
                <div className="bg-white border border-[#E2EDE2] rounded-2xl p-6 flex gap-4 items-start">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#E2EDE2] flex items-center justify-center text-[#0F1F0F] font-bold text-sm">1</div>
                  <div>
                    <h3 className="font-bold text-[#0F1F0F] mb-1">Gather Meta Credentials</h3>
                    <p className="text-sm text-[#6B7B6B] mb-3">Locate your credentials inside the Meta Developer Dashboard under "WhatsApp {'>'} API Setup".</p>
                    <ul className="space-y-1.5 text-sm text-[#6B7B6B]">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> <span className="font-mono text-xs text-[#0F1F0F]">Phone Number ID</span></li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> <span className="font-mono text-xs text-[#0F1F0F]">WhatsApp Business Account ID</span></li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> <span className="font-mono text-xs text-[#0F1F0F]">System User Access Token</span></li>
                    </ul>
                  </div>
                </div>

                <div className="bg-white border border-[#E2EDE2] rounded-2xl p-6 flex gap-4 items-start">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#E2EDE2] flex items-center justify-center text-[#0F1F0F] font-bold text-sm">2</div>
                  <div className="w-full">
                    <h3 className="font-bold text-[#0F1F0F] mb-1">Submit API Connection</h3>
                    <p className="text-sm text-[#6B7B6B] mb-4">Send an authorized request to bind your Meta credentials securely to WhatsFlow.</p>
                    <div className="bg-[#0F1F0F] rounded-xl p-4">
                      <pre className="text-[11px] text-[#16A34A] font-mono whitespace-pre-wrap leading-relaxed">
{`POST /api/whatsapp/connect
{
  "phone_number_id": "1059...",
  "business_account_id": "8842...",
  "access_token": "EAAGZ..."
}`}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E2EDE2] rounded-2xl p-6 flex gap-4 items-start">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#E2EDE2] flex items-center justify-center text-[#0F1F0F] font-bold text-sm">3</div>
                  <div>
                    <h3 className="font-bold text-[#0F1F0F] mb-1">Register Callback Webhook</h3>
                    <p className="text-sm text-[#6B7B6B] mb-2">Enter the global WhatsFlow listener into Meta webhook config so the AI sees incoming texts:</p>
                    <div className="bg-[#F8FAF8] border border-[#E2EDE2] rounded-lg px-3 py-2 font-mono text-xs text-[#16A34A] font-bold">
                      https://api.whatsflow.ai/v1/whatsapp/webhook
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Auth */}
            <section id="auth" className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                  <Shield className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold">Authentication</h2>
              </div>
              <p className="text-[#6B7B6B] mb-6 leading-relaxed">
                All API requests must include your API Key in the <code className="bg-[#F8FAF8] px-1.5 py-0.5 rounded border border-[#E2EDE2] text-[#16A34A]">Authorization</code> header. You can find your API key in the Dashboard under Settings.
              </p>
              <div className="bg-[#0F1F0F] rounded-2xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">HTTP Header</span>
                  <button onClick={() => copyToClipboard("Authorization: Bearer YOUR_API_KEY", "auth-header")} className="text-gray-400 hover:text-white transition-colors">
                    {copiedId === "auth-header" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <code className="text-sm text-gray-300 font-mono">
                    Authorization: Bearer <span className="text-[#16A34A]">YOUR_API_KEY</span>
                  </code>
                </div>
              </div>
            </section>

            {/* Send Message */}
            <section id="send" className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                  <Zap className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold">Send Message</h2>
              </div>
              <p className="text-[#6B7B6B] mb-6 leading-relaxed">
                Trigger an outgoing WhatsApp message to a specific phone number. You can send plain text, template messages, or even media files.
              </p>
              
              <div className="bg-[#F8FAF8] border border-[#E2EDE2] rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-[#16A34A] text-white text-[10px] font-black px-2 py-0.5 rounded">POST</span>
                  <code className="text-sm font-bold text-[#0F1F0F]">/v1/messages/send</code>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Example Request (cURL)</h4>
                    <div className="bg-[#0F1F0F] rounded-xl overflow-hidden p-4">
                      <pre className="text-[11px] text-gray-300 font-mono whitespace-pre-wrap leading-relaxed">
{`curl -X POST https://api.whatsflow.ai/v1/messages/send \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "15551234567",
    "text": "Hello from API!"
  }'`}
                      </pre>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Example Response</h4>
                    <div className="bg-[#0F1F0F] rounded-xl overflow-hidden p-4">
                      <pre className="text-[11px] text-[#16A34A] font-mono leading-relaxed">
{`{
  "id": "msg_59283",
  "status": "sent",
  "timestamp": "2025-05-18T12:00:00Z"
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Leads */}
            <section id="leads" className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold">Lead Management</h2>
              </div>
              <p className="text-[#6B7B6B] mb-6 leading-relaxed">
                Retrieve and manage lead information programmatically. Sync WhatsFlow leads with your internal CRM in real-time.
              </p>
              
              <div className="bg-[#F8FAF8] border border-[#E2EDE2] rounded-2xl p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-[#16A34A] text-white text-[10px] font-black px-2 py-0.5 rounded">GET</span>
                  <code className="text-sm font-bold text-[#0F1F0F]">/v1/leads/{`{lead_id}`}</code>
                </div>
                <div className="bg-[#0F1F0F] rounded-xl p-4">
                  <pre className="text-[11px] text-[#16A34A] font-mono whitespace-pre-wrap leading-relaxed">
{`{
  "id": "lead_9283",
  "name": "Alex Johnson",
  "phone": "+1 555-0192",
  "status": "qualified",
  "intent_score": 0.94
}`}
                  </pre>
                </div>
              </div>
            </section>

            {/* Webhooks */}
            <section id="webhooks" className="scroll-mt-32">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center text-[#16A34A]">
                  <Globe className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-bold">Webhooks</h2>
              </div>
              <p className="text-[#6B7B6B] mb-6 leading-relaxed">
                Receive real-time notifications about incoming messages, status updates, and lead activities. Configure your webhook URL in the developer settings.
              </p>
              <div className="border border-[#E2EDE2] rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#F8FAF8] border-b border-[#E2EDE2]">
                    <tr>
                      <th className="px-6 py-4 font-bold text-[#0F1F0F]">Event Type</th>
                      <th className="px-6 py-4 font-bold text-[#0F1F0F]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2EDE2]">
                    {[
                      { event: "message.received", desc: "Triggered whenever a customer sends you a text." },
                      { event: "message.delivered", desc: "Sent when your outgoing message is delivered (double tick)." },
                      { event: "lead.qualified", desc: "Triggered when the AI successfully qualifies a lead." },
                      { event: "appointment.booked", desc: "Sent when a customer completes a booking through AI." },
                    ].map((row) => (
                      <tr key={row.event}>
                        <td className="px-6 py-4"><code className="text-[#16A34A] font-bold">{row.event}</code></td>
                        <td className="px-6 py-4 text-[#6B7B6B]">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
