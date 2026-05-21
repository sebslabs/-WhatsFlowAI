import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problem } from "@/components/landing/Problem";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Features } from "@/components/landing/Features";
import { Benefits } from "@/components/landing/Benefits";
import { ForWho } from "@/components/landing/ForWho";
import { MetricsBar } from "@/components/landing/MetricsBar";
import { Pricing } from "@/components/landing/Pricing";
import { Comparison } from "@/components/landing/Comparison";
import { Testimonials } from "@/components/landing/Testimonials";
import { FAQ } from "@/components/landing/FAQ";
import { CTABanner } from "@/components/landing/CTABanner";
import { Footer } from "@/components/landing/Footer";
import { FloatingAIWidget } from "@/components/landing/FloatingAIWidget";
import { GlobalReach } from "@/components/landing/GlobalReach";
import { Integrations } from "@/components/landing/Integrations";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Benefits />
      <ForWho />
      <GlobalReach />
      <Integrations />
      <Comparison />
      <MetricsBar />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTABanner />
      <Footer />
      <FloatingAIWidget />
    </main>
  );
}


