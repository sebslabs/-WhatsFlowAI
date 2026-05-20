"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { 
  DollarSign, 
  Percent, 
  Award, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  HelpCircle
} from "lucide-react";

export default function AffiliatePage() {
  // Calculator States
  const [starterReferrals, setStarterReferrals] = useState(5);
  const [growthReferrals, setGrowthReferrals] = useState(3);
  const [scaleReferrals, setScaleReferrals] = useState(1);

  // FAQ Accordion State
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Commission Calculations
  const starterPrice = 49;
  const growthPrice = 99;
  const scalePrice = 199;
  const commissionRate = 0.30;

  const totalStarterMRR = starterReferrals * starterPrice;
  const totalGrowthMRR = growthReferrals * growthPrice;
  const totalScaleMRR = scaleReferrals * scalePrice;
  const totalSaaSMRR = totalStarterMRR + totalGrowthMRR + totalScaleMRR;

  const monthlyEarnings = totalSaaSMRR * commissionRate;
  const annualEarnings = monthlyEarnings * 12;

  const faqs = [
    {
      q: "How does the referral tracking system work?",
      a: "When a visitor clicks your unique affiliate tracking link, a secure cookie is stored in their browser for 60 days. Our advanced tracking framework captures their Referral ID and locks it into their database record upon registration. This ensures that even if they convert weeks later, upgrade, or modify plans, you receive 100% accurate commission attribution."
    },
    {
      q: "What is the commission rate and structure?",
      a: "WhatsFlow AI offers a generous 30% recurring commission on every active referral. The commission applies to the initial checkout amount as well as all subsequent monthly or annual renewals. For example, if a referred customer upgrades to the Scale annual plan ($1908/yr), you instantly earn a $572.40 recurring commission."
    },
    {
      q: "When and how do I receive my payouts?",
      a: "Affiliate commissions are calculated at the end of each calendar month and processed through our affiliate partner platform, Endorsely. Payouts are made securely via PayPal, direct bank transfer, or Stripe once your balance reaches the minimum threshold of $50."
    },
    {
      q: "Do you provide promotional and marketing support?",
      a: "Absolutely! Every approved partner gets instant access to our Premium Marketing Kit. This includes high-converting banner designs, ready-to-send email copy templates, video demonstrations, feature graphics, and social media copywriting guides to make promotion seamless."
    },
    {
      q: "Are there any restrictions on promotion methods?",
      a: "We welcome value-driven promotions such as blogs, email lists, YouTube reviews, podcasts, and training courses. However, search engine brand keyword bidding (PPC bidding on 'WhatsFlow AI' keywords) and self-referrals are strictly prohibited."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-[#22c55e] selection:text-white">
      <Navbar />

      <main className="flex-grow pt-32">
        {/* HERO SECTION */}
        <section className="relative pb-20 pt-8 overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-50 via-slate-50 to-slate-50">
          <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,transparent,black)] pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-6 lg:px-8 relative">
            <div className="text-center max-w-4xl mx-auto">
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-widest mb-8 border border-emerald-200/50 shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                WhatsFlow AI Partner Ecosystem
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
                className="text-5xl md:text-7xl font-black text-slate-900 mb-8 font-[family-name:var(--font-sora)] leading-tight tracking-tight"
              >
                Partner with us. <br className="hidden md:inline" />
                Earn <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-green-600">30% Recurring</span> Lifetime Cash.
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto mb-12"
              >
                Help businesses leverage smart conversational AI on WhatsApp to scale customer support and automate sales. Sign up as an Endorsely partner, promote your referral link, and earn high-paying passive income month after month.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              >
                <a
                  href="https://whatsflow-ai-d963.endorsely.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-slate-900 hover:bg-emerald-600 text-white font-bold text-lg shadow-xl shadow-slate-900/10 hover:shadow-emerald-600/20 transition-all duration-300 transform hover:-translate-y-0.5"
                >
                  Join Affiliate Program
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </a>
                <a
                  href="#calculator"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold text-lg transition-all duration-300"
                >
                  Calculate Commissions
                </a>
              </motion.div>
            </div>
          </div>
        </section>

        {/* METRICS / HIGHLIGHTS SECTION */}
        <section className="py-12 bg-white border-y border-slate-200/60 shadow-sm relative z-10">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100 text-center">
              <div className="px-4">
                <p className="text-4xl md:text-5xl font-black text-emerald-600 font-[family-name:var(--font-sora)]">30%</p>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-2">Lifetime Commission</p>
              </div>
              <div className="px-4">
                <p className="text-4xl md:text-5xl font-black text-slate-900 font-[family-name:var(--font-sora)]">60 Days</p>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-2">Cookie Life</p>
              </div>
              <div className="px-4">
                <p className="text-4xl md:text-5xl font-black text-slate-900 font-[family-name:var(--font-sora)]">Instant</p>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-2">Payout Reviews</p>
              </div>
              <div className="px-4">
                <p className="text-4xl md:text-5xl font-black text-emerald-600 font-[family-name:var(--font-sora)]">$0.00</p>
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mt-2">Free Partner Sign-up</p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section className="py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Simplistic Pipeline</span>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3 font-[family-name:var(--font-sora)]">How the Partner Program Works</h2>
              <p className="text-lg text-slate-600 mt-4">We supply the premium software, conversion assets, and advanced tracking. You collect the rewards.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-100 via-slate-200 to-emerald-100 -translate-y-1/2 hidden lg:block z-0" />
              
              {/* Step 1 */}
              <div className="bg-white p-10 rounded-[32px] border border-slate-200/50 shadow-md relative z-10 hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 font-black text-2xl font-[family-name:var(--font-sora)] border border-emerald-100">
                  1
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4 font-[family-name:var(--font-sora)]">Register in 2 Minutes</h3>
                <p className="text-slate-600 leading-relaxed">
                  Join our affiliate network powered by Endorsely. Fill out our simple partner application and get approved instantly to retrieve your tracking tools.
                </p>
              </div>

              {/* Step 2 */}
              <div className="bg-white p-10 rounded-[32px] border border-slate-200/50 shadow-md relative z-10 hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 font-black text-2xl font-[family-name:var(--font-sora)] border border-emerald-100">
                  2
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4 font-[family-name:var(--font-sora)]">Spread the Word</h3>
                <p className="text-slate-600 leading-relaxed">
                  Share your unique link on your website, blog reviews, email lists, YouTube reviews, social channels, or directly with your consulting clients.
                </p>
              </div>

              {/* Step 3 */}
              <div className="bg-white p-10 rounded-[32px] border border-slate-200/50 shadow-md relative z-10 hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-8 font-black text-2xl font-[family-name:var(--font-sora)] border border-emerald-100">
                  3
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-4 font-[family-name:var(--font-sora)]">Earn Recurring Income</h3>
                <p className="text-slate-600 leading-relaxed">
                  Get paid a robust 30% monthly recurring commission on every active referral, including renewals, pricing tier upgrades, and annual plan checkout sales.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* COMMISSION CALCULATOR */}
        <section id="calculator" className="py-24 bg-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-white to-white pointer-events-none" />
          
          <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
            <div className="grid lg:grid-cols-12 gap-16 items-center">
              
              {/* Left Side: Text and Sliders */}
              <div className="lg:col-span-7">
                <span className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Interactive Calculator</span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3 mb-6 font-[family-name:var(--font-sora)]">Estimate Your Monthly Earnings</h2>
                <p className="text-lg text-slate-600 mb-12">
                  Adjust the sliders to estimate how many clients you can refer. Our commission model rewards you forever as long as your referred businesses remain subscribed.
                </p>

                <div className="space-y-8">
                  {/* Slider 1: Starter */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-lg font-bold text-slate-800">Starter Plan Referrals</span>
                        <span className="block text-xs font-medium text-slate-500">Price: $49/mo • Your Comm: $14.70/mo</span>
                      </div>
                      <span className="text-2xl font-extrabold text-slate-900 bg-white px-4 py-1.5 rounded-xl border border-slate-200 font-[family-name:var(--font-sora)] shadow-sm">
                        {starterReferrals}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={starterReferrals}
                      onChange={(e) => setStarterReferrals(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Slider 2: Growth */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-lg font-bold text-slate-800">Growth Plan Referrals</span>
                        <span className="block text-xs font-medium text-slate-500">Price: $99/mo • Your Comm: $29.70/mo</span>
                      </div>
                      <span className="text-2xl font-extrabold text-slate-900 bg-white px-4 py-1.5 rounded-xl border border-slate-200 font-[family-name:var(--font-sora)] shadow-sm">
                        {growthReferrals}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="50" 
                      value={growthReferrals}
                      onChange={(e) => setGrowthReferrals(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>

                  {/* Slider 3: Scale */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-lg font-bold text-slate-800">Scale Plan Referrals</span>
                        <span className="block text-xs font-medium text-slate-500">Price: $199/mo • Your Comm: $59.70/mo</span>
                      </div>
                      <span className="text-2xl font-extrabold text-slate-900 bg-white px-4 py-1.5 rounded-xl border border-slate-200 font-[family-name:var(--font-sora)] shadow-sm">
                        {scaleReferrals}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="30" 
                      value={scaleReferrals}
                      onChange={(e) => setScaleReferrals(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side: Calculation Visualizer (Glassmorphism Card) */}
              <div className="lg:col-span-5">
                <div className="bg-slate-900 text-white rounded-[32px] p-8 md:p-10 shadow-2xl relative overflow-hidden border border-slate-800">
                  <div className="absolute -right-20 -top-20 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                  
                  <div className="relative z-10">
                    <span className="text-xs uppercase font-bold tracking-widest text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/40">
                      Total Output Projection
                    </span>
                    
                    <div className="mt-8 mb-6 border-b border-slate-800 pb-6">
                      <p className="text-sm font-medium text-slate-400">Monthly Recurring Revenue (MRR) Referred</p>
                      <p className="text-4xl font-extrabold mt-1 font-[family-name:var(--font-sora)]">${totalSaaSMRR.toLocaleString()}</p>
                    </div>

                    <div className="mb-8">
                      <p className="text-sm font-semibold text-emerald-400">Your Monthly Passive Commissions</p>
                      <p className="text-5xl md:text-6xl font-black mt-1 text-white font-[family-name:var(--font-sora)] tracking-tight">
                        ${monthlyEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <span className="text-xs text-slate-400 mt-2 block font-medium">Referred Customer Base: {starterReferrals + growthReferrals + scaleReferrals} active subscriptions</span>
                    </div>

                    <div className="bg-slate-800/45 p-6 rounded-2xl border border-slate-700/30 mb-8">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold">Annual Cumulative Income</p>
                      <p className="text-3xl font-extrabold text-emerald-400 mt-1 font-[family-name:var(--font-sora)]">
                        ${annualEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Calculated over a 12-month period of active billing cycles.</p>
                    </div>

                    <a
                      href="https://whatsflow-ai-d963.endorsely.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-lg rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 transform hover:-translate-y-0.5 inline-block text-center"
                    >
                      Get Your Referral Link
                    </a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* WHY CHOOSE WHATSFLOW */}
        <section className="py-24 bg-slate-50 border-y border-slate-200/50">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Why WhatsFlow AI</span>
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mt-3 font-[family-name:var(--font-sora)]">A Product That Sells Itself</h2>
              <p className="text-lg text-slate-600 mt-4">We build top-tier SaaS features making conversions easy for our affiliates.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-white p-8 rounded-[24px] border border-slate-200/40 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6 border border-emerald-100">
                  <Percent className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 font-[family-name:var(--font-sora)]">Vibrant Conversion Tiers</h3>
                <p className="text-slate-600 leading-relaxed">
                  Refer once and earn forever. Our recurring model guarantees 30% payouts across renewals and upgrades.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white p-8 rounded-[24px] border border-slate-200/40 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6 border border-emerald-100">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 font-[family-name:var(--font-sora)]">Real-Time Tracking</h3>
                <p className="text-slate-600 leading-relaxed">
                  Real-time partner insights managed through our secure portal. Track clicks, conversions, payouts, and analytics.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white p-8 rounded-[24px] border border-slate-200/40 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-6 border border-emerald-100">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 font-[family-name:var(--font-sora)]">Dedicated Support</h3>
                <p className="text-slate-600 leading-relaxed">
                  Get dedicated support and resources from our partner team to help scale your promotional channels.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQS SECTION Accordions */}
        <section className="py-24 bg-white">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-16">
              <span className="text-[#22c55e] text-xs font-bold uppercase tracking-widest">Partner FAQ</span>
              <h2 className="text-4xl font-bold text-slate-900 mt-2 font-[family-name:var(--font-sora)]">Frequently Asked Questions</h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div key={index} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                  <button
                    onClick={() => setActiveFaq(activeFaq === index ? null : index)}
                    className="w-full flex justify-between items-center p-6 bg-slate-50 hover:bg-slate-100/70 text-left transition-colors"
                  >
                    <span className="text-lg font-bold text-slate-800 flex items-center gap-3">
                      <HelpCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      {faq.q}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${activeFaq === index ? "rotate-180" : ""}`} />
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {activeFaq === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="p-6 bg-white border-t border-slate-150 text-slate-600 leading-relaxed">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CALL TO ACTION */}
        <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-slate-800 via-slate-900 to-slate-950 pointer-events-none" />
          
          <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 font-[family-name:var(--font-sora)] tracking-tight">
              Ready to Monetize Your Audience?
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed max-w-3xl mx-auto mb-10">
              Apply today, grab your affiliate link, and enjoy a lifetime 30% recurring share of WhatsFlow AI's hyper-growth SaaS journey.
            </p>
            <a
              href="https://whatsflow-ai-d963.endorsely.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-lg shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all duration-300 transform hover:-translate-y-0.5"
            >
              Start Earning Now
              <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
