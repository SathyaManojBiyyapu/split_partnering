"use client";

import Hero from "@/app/components/landing/Hero";
import CategoryGrid from "@/app/components/landing/CategoryGrid";
import TrustIndicators from "@/app/components/landing/TrustIndicators";
import SavingsExamples from "@/app/components/landing/SavingsExamples";
import HowItWorks from "@/app/components/landing/HowItWorks";
import StickyCTA from "@/app/components/landing/StickyCTA";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white font-body pb-mobile-cta">
      {/* HERO */}
      <Hero />

      {/* POPULAR CATEGORIES */}
      <CategoryGrid />

      {/* HOW PARTNERSYNC WORKS */}
      <HowItWorks />

      {/* SAVINGS / VALUE */}
      <SavingsExamples />

      {/* TRUST */}
      <TrustIndicators />

      {/* STICKY BOTTOM CTA */}
      <StickyCTA />
    </main>
  );
}