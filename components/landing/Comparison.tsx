"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, HelpCircle, ArrowRight, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

import { SectionHeaderBlock } from "./SectionHeaderBlock";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PLATFORMS = [
  { id: "wati", name: "Wati", markup: 0.20 },
  { id: "aisensy", name: "AiSensy", markup: 0.35 },
  { id: "interakt", name: "Interakt", markup: 0.15 },
  { id: "gallabox", name: "Gallabox", markup: 0.25 },
];

const CURRENCIES = [
  { code: "USD", symbol: "$", rate: 1 },
  { code: "EUR", symbol: "€", rate: 0.92 },
  { code: "GBP", symbol: "£", rate: 0.79 },
  { code: "AED", symbol: "AED", rate: 3.67 },
  { code: "INR", symbol: "₹", rate: 83.00 },
  { code: "LKR", symbol: "Rs", rate: 300.00 },
  { code: "SAR", symbol: "SR", rate: 3.75 },
  { code: "QAR", symbol: "QR", rate: 3.64 },
  { code: "BRL", symbol: "R$", rate: 5.10 },
  { code: "CAD", symbol: "C$", rate: 1.36 },
  { code: "AUD", symbol: "A$", rate: 1.51 },
  { code: "SGD", symbol: "S$", rate: 1.34 },
  { code: "MYR", symbol: "RM", rate: 4.70 },
  { code: "THB", symbol: "฿", rate: 36.50 },
  { code: "IDR", symbol: "Rp", rate: 16000 },
  { code: "PHP", symbol: "₱", rate: 58.00 },
  { code: "VND", symbol: "₫", rate: 25400 },
  { code: "PKR", symbol: "Rs", rate: 278.00 },
  { code: "BDT", symbol: "৳", rate: 117.00 },
  { code: "NGN", symbol: "₦", rate: 1450.00 },
  { code: "ZAR", symbol: "R", rate: 18.50 },
  { code: "KES", symbol: "KSh", rate: 130.00 },
  { code: "EGP", symbol: "E£", rate: 47.00 },
  { code: "TRY", symbol: "₺", rate: 32.20 },
  { code: "MXN", symbol: "Mex$", rate: 16.70 },
  { code: "JPY", symbol: "¥", rate: 156.00 },
  { code: "CNY", symbol: "¥", rate: 7.24 },
  { code: "HKD", symbol: "HK$", rate: 7.81 },
  { code: "NZD", symbol: "NZ$", rate: 1.63 },
  { code: "CHF", symbol: "CHF", rate: 0.91 },
  { code: "SEK", symbol: "kr", rate: 10.60 },
  { code: "NOK", symbol: "kr", rate: 10.70 },
  { code: "DKK", symbol: "kr", rate: 6.88 },
  { code: "PLN", symbol: "zł", rate: 3.93 },
  { code: "KWD", symbol: "KD", rate: 0.31 },
  { code: "BHD", symbol: "BD", rate: 0.38 },
  { code: "OMR", symbol: "RO", rate: 0.38 },
  { code: "JOD", symbol: "JD", rate: 0.71 },
  { code: "GHS", symbol: "GH₵", rate: 14.50 },
  { code: "UGX", symbol: "USh", rate: 3800 },
  { code: "TZS", symbol: "TSh", rate: 2600 },
  { code: "MAD", symbol: "DH", rate: 10.00 },
  { code: "ILS", symbol: "₪", rate: 3.70 },
  { code: "CLP", symbol: "CLP$", rate: 900 },
  { code: "COP", symbol: "COL$", rate: 3800 },
  { code: "PEN", symbol: "S/", rate: 3.70 },
  { code: "HUF", symbol: "Ft", rate: 360 },
  { code: "CZK", symbol: "Kč", rate: 22.80 },
  { code: "RON", symbol: "lei", rate: 4.58 },
  { code: "RUB", symbol: "₽", rate: 90.00 },
  { code: "KRW", symbol: "₩", rate: 1360 },
];

const COUNTRIES = [
  { name: "United Arab Emirates", rates: { marketing: 0.0384, utility: 0.0157, auth: 0.0157, service: 0.0000 } },
  { name: "United States", rates: { marketing: 0.0147, utility: 0.0084, auth: 0.0070, service: 0.0084 } },
  { name: "United Kingdom", rates: { marketing: 0.0450, utility: 0.0350, auth: 0.0320, service: 0.0350 } },
  { name: "India", rates: { marketing: 0.0099, utility: 0.0042, auth: 0.0035, service: 0.0042 } },
  { name: "Sri Lanka", rates: { marketing: 0.0120, utility: 0.0060, auth: 0.0050, service: 0.0060 } },
  { name: "Saudi Arabia", rates: { marketing: 0.0350, utility: 0.0140, auth: 0.0140, service: 0.0140 } },
  { name: "Qatar", rates: { marketing: 0.0380, utility: 0.0160, auth: 0.0160, service: 0.0160 } },
  { name: "Brazil", rates: { marketing: 0.0480, utility: 0.0280, auth: 0.0250, service: 0.0280 } },
  { name: "Germany", rates: { marketing: 0.1100, utility: 0.0700, auth: 0.0650, service: 0.0700 } },
  { name: "France", rates: { marketing: 0.1050, utility: 0.0650, auth: 0.0600, service: 0.0650 } },
  { name: "Italy", rates: { marketing: 0.0980, utility: 0.0600, auth: 0.0550, service: 0.0600 } },
  { name: "Spain", rates: { marketing: 0.0950, utility: 0.0580, auth: 0.0520, service: 0.0580 } },
  { name: "Canada", rates: { marketing: 0.0150, utility: 0.0090, auth: 0.0075, service: 0.0090 } },
  { name: "Australia", rates: { marketing: 0.0180, utility: 0.0110, auth: 0.0095, service: 0.0110 } },
  { name: "Singapore", rates: { marketing: 0.0220, utility: 0.0140, auth: 0.0120, service: 0.0140 } },
  { name: "Malaysia", rates: { marketing: 0.0180, utility: 0.0110, auth: 0.0095, service: 0.0110 } },
  { name: "Thailand", rates: { marketing: 0.0140, utility: 0.0080, auth: 0.0070, service: 0.0080 } },
  { name: "Indonesia", rates: { marketing: 0.0320, utility: 0.0180, auth: 0.0150, service: 0.0180 } },
  { name: "Vietnam", rates: { marketing: 0.0120, utility: 0.0070, auth: 0.0060, service: 0.0070 } },
  { name: "Philippines", rates: { marketing: 0.0160, utility: 0.0090, auth: 0.0080, service: 0.0090 } },
  { name: "Pakistan", rates: { marketing: 0.0100, utility: 0.0050, auth: 0.0040, service: 0.0050 } },
  { name: "Bangladesh", rates: { marketing: 0.0090, utility: 0.0045, auth: 0.0038, service: 0.0045 } },
  { name: "South Africa", rates: { marketing: 0.0180, utility: 0.0110, auth: 0.0100, service: 0.0110 } },
  { name: "Nigeria", rates: { marketing: 0.0150, utility: 0.0090, auth: 0.0080, service: 0.0090 } },
  { name: "Kenya", rates: { marketing: 0.0140, utility: 0.0085, auth: 0.0075, service: 0.0085 } },
  { name: "Egypt", rates: { marketing: 0.0160, utility: 0.0095, auth: 0.0085, service: 0.0095 } },
  { name: "Turkey", rates: { marketing: 0.0180, utility: 0.0110, auth: 0.0100, service: 0.0110 } },
  { name: "Mexico", rates: { marketing: 0.0240, utility: 0.0140, auth: 0.0120, service: 0.0140 } },
  { name: "Argentina", rates: { marketing: 0.0280, utility: 0.0160, auth: 0.0140, service: 0.0160 } },
  { name: "Chile", rates: { marketing: 0.0260, utility: 0.0150, auth: 0.0130, service: 0.0150 } },
  { name: "Colombia", rates: { marketing: 0.0220, utility: 0.0130, auth: 0.0110, service: 0.0130 } },
  { name: "Peru", rates: { marketing: 0.0200, utility: 0.0120, auth: 0.0100, service: 0.0120 } },
  { name: "Kuwait", rates: { marketing: 0.0380, utility: 0.0160, auth: 0.0160, service: 0.0160 } },
  { name: "Oman", rates: { marketing: 0.0380, utility: 0.0160, auth: 0.0160, service: 0.0160 } },
  { name: "Bahrain", rates: { marketing: 0.0380, utility: 0.0160, auth: 0.0160, service: 0.0160 } },
  { name: "Jordan", rates: { marketing: 0.0320, utility: 0.0140, auth: 0.0140, service: 0.0140 } },
  { name: "Morocco", rates: { marketing: 0.0280, utility: 0.0120, auth: 0.0120, service: 0.0120 } },
  { name: "Portugal", rates: { marketing: 0.0850, utility: 0.0520, auth: 0.0480, service: 0.0520 } },
  { name: "Netherlands", rates: { marketing: 0.1050, utility: 0.0650, auth: 0.0600, service: 0.0650 } },
  { name: "Switzerland", rates: { marketing: 0.1150, utility: 0.0750, auth: 0.0680, service: 0.0750 } },
  { name: "Sweden", rates: { marketing: 0.0980, utility: 0.0600, auth: 0.0550, service: 0.0600 } },
  { name: "Norway", rates: { marketing: 0.0980, utility: 0.0600, auth: 0.0550, service: 0.0600 } },
  { name: "Denmark", rates: { marketing: 0.0980, utility: 0.0600, auth: 0.0550, service: 0.0600 } },
  { name: "Israel", rates: { marketing: 0.0340, utility: 0.0160, auth: 0.0150, service: 0.0160 } },
  { name: "Poland", rates: { marketing: 0.0650, utility: 0.0400, auth: 0.0350, service: 0.0400 } },
  { name: "Japan", rates: { marketing: 0.0280, utility: 0.0160, auth: 0.0140, service: 0.0160 } },
  { name: "South Korea", rates: { marketing: 0.0260, utility: 0.0150, auth: 0.0130, service: 0.0150 } },
  { name: "Hong Kong", rates: { marketing: 0.0240, utility: 0.0140, auth: 0.0120, service: 0.0140 } },
  { name: "Taiwan", rates: { marketing: 0.0240, utility: 0.0140, auth: 0.0120, service: 0.0140 } },
  { name: "New Zealand", rates: { marketing: 0.0200, utility: 0.0120, auth: 0.0100, service: 0.0120 } },
];

export function Comparison() {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [platform, setPlatform] = useState(PLATFORMS[0]);
  const [conversations, setConversations] = useState(4000);

  const stats = useMemo(() => {
    const calc = (base: number) => {
      const whatsflow = base * conversations * currency.rate;
      const competitor = whatsflow * (1 + platform.markup);
      const savings = competitor - whatsflow;
      return { whatsflow, competitor, savings };
    };

    return {
      marketing: calc(country.rates.marketing),
      utility: calc(country.rates.utility),
      auth: calc(country.rates.auth),
      service: calc(country.rates.service),
    };
  }, [country, currency, platform, conversations]);

  const totalSavings = Object.values(stats).reduce((acc, s) => acc + s.savings, 0) / 4;

  return (
    <section className="py-20 bg-white dark:bg-[#111827]">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeaderBlock 
            label="0% Markup Fees"
            title="Compare Savings" 
            center 
          />
          <div className="bg-[#F9FAFB] dark:bg-[#0B0F1A] rounded-[32px] border border-[#E5E7EB] dark:border-[#1F2937] p-6 md:p-8 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-10 items-start">
              
              {/* Left Side: Controls */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Country</label>
                    <Select value={country.name} onValueChange={(val) => setCountry(COUNTRIES.find(c => c.name === val)!)}>
                      <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-xs font-bold focus:ring-[#22C55E]/20">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-64 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
                        {COUNTRIES.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                          <SelectItem key={c.name} value={c.name} className="text-xs font-bold hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Currency</label>
                    <Select value={currency.code} onValueChange={(val) => setCurrency(CURRENCIES.find(c => c.code === val)!)}>
                      <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-xs font-bold focus:ring-[#22C55E]/20">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="max-h-64 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
                        {CURRENCIES.sort((a,b) => a.code.localeCompare(b.code)).map(c => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-bold hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                            {c.code} ({c.symbol})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[#9CA3AF] ml-1">Vs Platform</label>
                    <Select value={platform.id} onValueChange={(val) => setPlatform(PLATFORMS.find(p => p.id === val)!)}>
                      <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] text-xs font-bold focus:ring-[#22C55E]/20">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" className="rounded-xl border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827]">
                        {PLATFORMS.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs font-bold hover:bg-[#F9FAFB] dark:hover:bg-[#0B0F1A]">
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-[#111827] dark:text-[#F9FAFB]">Monthly Conversations</h4>
                    <span className="text-xl font-black text-[#22C55E]">{conversations.toLocaleString()}</span>
                  </div>
                  <Slider 
                    value={[conversations]}
                    onValueChange={(v) => setConversations(v[0])}
                    max={50000}
                    min={500}
                    step={500}
                  />
                  <div className="flex justify-between text-[10px] font-bold text-[#9CA3AF]">
                    <span>500</span>
                    <span>25,000</span>
                    <span>50,000+</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-[#E5E7EB] dark:border-[#1F2937]">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">WhatsFlow (0%)</p>
                        <p className="text-lg font-black text-[#111827] dark:text-[#F9FAFB]">
                          {currency.symbol}{Object.values(stats).reduce((acc, s) => acc + s.whatsflow, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937]">
                        <p className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">{platform.name} ({platform.markup * 100}%)</p>
                        <p className="text-lg font-black text-[#6B7280]">
                          {currency.symbol}{Object.values(stats).reduce((acc, s) => acc + s.competitor, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                   </div>
                </div>
              </div>

              {/* Right Side: Result Card */}
              <div className="bg-[#22C55E] rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-green-500/20">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16" />
                <div className="relative space-y-6">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest opacity-80">Estimated Monthly Savings</p>
                    <h3 className="text-4xl font-black mt-1">
                      {currency.symbol}{totalSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </h3>
                  </div>
                  <ul className="space-y-3">
                    {[
                      "No Markup on Meta Fees",
                      "Direct Billing from Meta",
                      "Unlimited AI Conversations"
                    ].map((text) => (
                      <li key={text} className="flex items-center gap-2 text-xs font-bold">
                        <Check className="w-3.5 h-3.5 text-white/90" /> {text}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full bg-white text-[#22C55E] h-12 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-opacity-90 active:scale-95 transition-all mt-4">
                    Get Started <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>

            <p className="mt-8 text-center text-[10px] text-[#6B7280] dark:text-[#9CA3AF] italic">
              * Rates shown are approximate and based on official Meta conversation categories.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
