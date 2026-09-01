"use client";

import Link from "next/link";
import { motion } from "framer-motion";

// Keep the hero fully visible at all times (never start at opacity 0) so the
// LCP heading can be painted the moment the HTML arrives. Only a subtle
// translate is animated — transforms do not delay paint or count as layout shift.
const staggerContainer = {
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { y: 20 },
  visible: { y: 0, transition: { duration: 0.5 } },
};

export default function Hero() {
  return (
    <section className="relative min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Premium glow effects */}
      <div className="hero-glow" style={{ top: "-10%", left: "-5%" }} />
      <div className="hero-glow" style={{ bottom: "-20%", right: "-10%" }} />
      <div className="absolute inset-0 hero-gradient pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 pt-16 sm:pt-20 pb-12">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-7"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp} className="flex justify-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />
              India's collaborative savings marketplace
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white leading-[1.1]"
          >
            Save Money
            <br />
            <span className="bg-gradient-to-r from-[#D4AF37] via-[#E6C97A] to-[#D4AF37] bg-clip-text text-transparent">
              Together.
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto px-4 leading-relaxed"
          >
            Find trusted people nearby to split memberships, tickets, travel,
            subscriptions and more.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="flex justify-center gap-3 sm:gap-4 flex-wrap"
          >
            <Link
              href="/categories"
              className="group relative inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)]"
            >
              <span className="relative z-10">Find Partners</span>
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base border-2 border-white/20 text-white hover:bg-white/5 hover:border-white/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              Create a Group
            </Link>
          </motion.div>

          {/* Trust chips */}
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap justify-center gap-2 pt-2"
          >
            {["✓ Verified Users", "🔒 Privacy Protected", "💳 Secure Payments"].map(
              (item) => (
                <span
                  key={item}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs text-gray-400 bg-white/[0.03] border border-white/5"
                >
                  {item}
                </span>
              )
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}