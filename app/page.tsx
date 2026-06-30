"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import Hero from "@/app/components/landing/Hero";
import CategoryGrid from "@/app/components/landing/CategoryGrid";
import TrustIndicators from "@/app/components/landing/TrustIndicators";
import StatsSection from "@/app/components/landing/StatsSection";
import LiveActivity from "@/app/components/landing/LiveActivity";
import SavingsExamples from "@/app/components/landing/SavingsExamples";
import SavingsCalculator from "@/app/components/landing/SavingsCalculator";
import Leaderboard from "@/app/components/landing/Leaderboard";
import HowItWorks from "@/app/components/landing/HowItWorks";
import UrgencyBadges from "@/app/components/landing/UrgencyBadges";
import MainCTA from "@/app/components/landing/MainCTA";
import StickyCTA from "@/app/components/landing/StickyCTA";

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("loggedIn") === "true") setLoggedIn(true);
    if (localStorage.getItem("guest") === "true") setGuest(true);
  }, []);

  return (
    <main className="min-h-screen bg-black text-white font-body pb-mobile-cta">
      {/* HERO */}
      <Hero />

      {/* CATEGORY CARDS */}
      <CategoryGrid />

      {/* TRUST INDICATORS */}
      <TrustIndicators />

      {/* STATS */}
      <StatsSection />

      {/* LIVE ACTIVITY */}
      <LiveActivity />

      {/* SAVINGS EXAMPLES */}
      <SavingsExamples />

      {/* URGENCY BADGES */}
      <UrgencyBadges />


      {/* LEADERBOARD */}
      <Leaderboard />

      {/* SAVINGS CALCULATOR */}
      <SavingsCalculator />

      {/* HOW IT WORKS */}
      <HowItWorks />

      {/* CTA */}
      <MainCTA />

      {/* STICKY BOTTOM CTA */}
      <StickyCTA />
    </main>
  );
}