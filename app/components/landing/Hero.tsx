"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const avatars = ["R", "P", "A", "N"];

export default function Hero() {
  return (
    <section className="relative min-h-[60vh] sm:min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Subtle gold gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#D4AF37]/5 via-transparent to-transparent pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto text-center px-4 pt-12 sm:pt-16 pb-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Category tags */}
          <motion.div variants={fadeUp} className="flex flex-wrap justify-center gap-2">
            {["🎓 Education", "💪 Gym", "🎬 Movies", "✈️ Travel", "🛍️ Shopping"].map(
              (item, i) => (
                <motion.span
                  key={item}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-gray-300 hover:border-[#D4AF37]/30 hover:text-[#D4AF37] transition-colors duration-300"
                >
                  {item}
                </motion.span>
              )
            )}
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl tracking-tight text-white leading-tight"
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
            className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto px-4 leading-relaxed"
          >
            Find trusted people nearby to split memberships, shopping deals, travel costs, movie tickets, eyewear purchases and more.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="flex justify-center gap-3 sm:gap-4 flex-wrap"
          >
            <Link
              href="/categories"
              className="group relative inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base bg-[#D4AF37] text-black overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_30px_rgba(212,175,55,0.3)]"
            >
              <span className="relative z-10">Explore Categories</span>
              <span className="absolute inset-0 bg-gradient-to-r from-[#E6C97A] to-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            <Link
              href="/categories"
              className="inline-flex items-center px-8 py-3.5 rounded-xl font-semibold text-base border-2 border-white/20 text-white hover:bg-white/5 hover:border-white/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              Find Partners
            </Link>
          </motion.div>

          {/* Social proof */}
          <motion.div
            variants={fadeUp}
            className="flex items-center justify-center gap-4 text-sm text-gray-500 pt-4"
          >
            <div className="flex -space-x-2">
              {avatars.map((initial, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="w-8 h-8 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center text-xs font-medium text-white"
                >
                  {initial}
                </motion.div>
              ))}
            </div>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              <strong className="text-white font-semibold">10,000+</strong> people saving together
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}