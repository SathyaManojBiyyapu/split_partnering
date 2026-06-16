"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const milestones = [
  { year: "2024", title: "PartnerSync Founded", desc: "Launched with a vision to make collaboration accessible to everyone in India." },
  { year: "2025", title: "Platform Launch", desc: "Released the first version with 9 categories and location-based matching." },
  { year: "2026", title: "Growth Phase", desc: "Expanded collaborator network, enhanced verification, launched secured payments." },
];

const values = [
  { icon: "🤝", title: "Trust First", desc: "We believe collaboration starts with trust. Every user is verified, every partner is vetted." },
  { icon: "🌏", title: "Local Connections", desc: "We prioritize same-city and same-district matches for meaningful, actionable collaborations." },
  { icon: "💰", title: "Affordable Access", desc: "At just ₹29 per unlock, we make verified matchmaking accessible to everyone." },
  { icon: "🔒", title: "Privacy by Design", desc: "Your data stays private. Identity is revealed only when you choose to unlock." },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            About PartnerSync
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            We are building India's most trusted collaboration platform. Connecting people to save more, share better, and grow together.
          </motion.p>
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="border border-[#FFD166]/20 rounded-2xl p-8 bg-gradient-to-br from-[#0e0e0e] to-black text-center">
            <h2 className="text-lg font-bold text-[#FFD166] mb-3">Our Mission</h2>
            <p className="text-sm text-gray-300 leading-relaxed max-w-3xl mx-auto">
              PartnerSync is a trust-based collaboration platform that connects users with verified partners and approved collaborators. 
              We enable cost-sharing, resource pooling, and reliable collaboration — without owning any products or services ourselves.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-[#FFD166] mb-4 text-center">How PartnerSync Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]">
              <p className="text-[10px] text-gray-500 uppercase mb-2">Step 1</p>
              <h3 className="text-sm font-bold text-white mb-1">Choose a Category</h3>
              <p className="text-xs text-gray-400">Browse 9 categories — Gym, Fashion, Movies, Travel, Books, Events, Lenskart, Coupons, Villas.</p>
            </div>
            <div className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]">
              <p className="text-[10px] text-gray-500 uppercase mb-2">Step 2</p>
              <h3 className="text-sm font-bold text-white mb-1">Get Matched</h3>
              <p className="text-xs text-gray-400">Our algorithm finds nearby partners and verified collaborators matching your preferences.</p>
            </div>
            <div className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]">
              <p className="text-[10px] text-gray-500 uppercase mb-2">Step 3</p>
              <h3 className="text-sm font-bold text-white mb-1">Unlock for ₹29</h3>
              <p className="text-xs text-gray-400">Pay a small platform fee to unlock verified match details and connect with your partner.</p>
            </div>
            <div className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]">
              <p className="text-[10px] text-gray-500 uppercase mb-2">Step 4</p>
              <h3 className="text-sm font-bold text-white mb-1">Collaborate</h3>
              <p className="text-xs text-gray-400">Connect, share costs, and save money with your verified partner or collaborator.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-[#FFD166] mb-4 text-center">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]"
              >
                <span className="text-2xl mb-2 block">{v.icon}</span>
                <h3 className="text-sm font-bold text-white mb-1">{v.title}</h3>
                <p className="text-xs text-gray-400">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-lg font-bold text-[#FFD166] mb-2">Built with ❤️ in India</h2>
          <p className="text-xs text-gray-400 mb-6">Headquartered in Vijayawada, Andhra Pradesh</p>
          <div className="inline-block border border-[#FFD166]/10 rounded-xl p-4 bg-[#0c0c0c]">
            <p className="text-xs text-gray-400">Contact us: <span className="text-[#FFD166]">support@partnersync.in</span></p>
          </div>
        </div>
      </section>

      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">← Back to Home</Link>
      </div>
    </div>
  );
}