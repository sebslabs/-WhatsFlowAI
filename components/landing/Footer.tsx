import Link from "next/link";
import {
  Twitter,
  Linkedin,
  Instagram,
  Mail,
  Phone,
  ArrowRight,
  Globe,
  Github
} from "lucide-react";
import { Button } from "@/components/ui/button";

const footerLinks = {
  Product: [
    { name: "Features", href: "/features" },
    { name: "Automation", href: "/features#automation" },
    { name: "Live Chat", href: "/features#live-chat" },
    { name: "Templates", href: "/features#templates" },
    { name: "API Docs", href: "/docs/api" },
  ],
  Company: [
    { name: "Our Story", href: "/about" },
    { name: "Blog", href: "/blog" },
    { name: "Affiliate Program", href: "/affiliate" },
    { name: "Careers", href: "/careers" },
    { name: "Brand Assets", href: "/brand" },
  ],
  Resources: [
    { name: "Help Center", href: "/help" },
    { name: "WhatsApp Guide", href: "/guide" },
    { name: "Community", href: "/community" },
    { name: "Status Page", href: "/status" },
    { name: "Service Status", href: "/status#service" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-white pt-24 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-20">
          
          {/* Brand Column */}
          <div className="lg:col-span-4 space-y-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0">
                <img src="/logo-robot.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-2xl tracking-tighter text-[#0F1F0F]">WhatsFlow <span className="text-[#16A34A]">AI</span></span>
            </Link>
            <p className="text-[#6B7B6B] text-sm leading-relaxed max-w-sm">
              The world&apos;s most advanced AI-powered WhatsApp lead management system. 
              Helping modern businesses convert conversations into revenue, 24/7.
            </p>
            <div className="flex items-center gap-4">
              {[
                { Icon: Twitter, label: "Twitter" },
                { Icon: Linkedin, label: "LinkedIn" },
                { Icon: Instagram, label: "Instagram" },
                { Icon: Github, label: "Github" },
              ].map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#"
                  className="w-9 h-9 rounded-full border border-[#E2EDE2] flex items-center justify-center text-[#6B7B6B] hover:text-[#16A34A] hover:border-[#16A34A] hover:bg-[#F0F9F0] transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-8 text-[#0F1F0F]">
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="font-bold text-[11px] mb-6 uppercase tracking-widest">{category}</h4>
                <ul className="space-y-4">
                  {links.map((link) => (
                    <li key={link.name}>
                      <Link
                        href={link.href}
                        className="text-[13px] text-[#6B7B6B] hover:text-[#16A34A] transition-colors"
                      >
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Newsletter Column */}
          <div className="lg:col-span-3">
            <h4 className="font-bold text-[11px] text-[#0F1F0F] mb-6 uppercase tracking-widest">Newsletter</h4>
            <p className="text-[13px] text-[#6B7B6B] mb-6">Master your WhatsApp automation with weekly secrets.</p>
            <form className="space-y-2">
              <div className="relative">
                <input 
                  type="email" 
                  placeholder="name@email.com"
                  className="w-full bg-[#F8FAF8] border border-[#E2EDE2] rounded-xl px-4 py-3 text-sm text-[#0F1F0F] placeholder:text-[#A1B1A1] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/10 focus:border-[#16A34A] transition-all"
                />
              </div>
              <Button className="w-full bg-[#16A34A] hover:bg-[#15803D] text-white rounded-xl h-11 font-bold text-sm shadow-sm">
                Subscribe
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Giant Brand Watermark */}
      <div className="pt-20 pb-0 overflow-hidden pointer-events-none select-none">
        <h2 
          className="text-[12.5vw] leading-none font-black text-transparent tracking-tighter text-center whitespace-nowrap uppercase"
          style={{ WebkitTextStroke: "1px #16A34A", opacity: 0.15 }}
        >
          WhatsFlow AI
        </h2>
      </div>

      <div className="bg-[#16A34A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Final Bottom Bar */}
          <div className="py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-white">
            <p className="text-[12px] opacity-80 font-medium tracking-wide">
              © {new Date().getFullYear()} WhatsFlow AI · SEBS (Private) Limited.
            </p>
            
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 text-white/80 text-[12px] font-bold uppercase tracking-widest">
                <Globe className="w-3.5 h-3.5" />
                <span>English (US)</span>
              </div>
              <div className="flex items-center gap-6 font-bold uppercase tracking-widest text-[12px]">
                <Link href="/privacy" className="text-white/80 hover:text-white transition-colors">PRIVACY</Link>
                <Link href="/terms" className="text-white/80 hover:text-white transition-colors">TERMS</Link>
                <Link href="/refund" className="text-white/80 hover:text-white transition-colors">REFUND</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
