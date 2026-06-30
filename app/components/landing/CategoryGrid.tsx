"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CategoryCard = {
  slug: string;
  label: string;
  icon: string;
  savings: string;
  members: number;
  required: number;
  timeLeft: string;
  trending: boolean;
};

const categories: CategoryCard[] = [
  { slug: "gym", label: "Gym", icon: "/gym.webp", savings: "60%", members: 3, required: 5, timeLeft: "2 Days", trending: true },
  { slug: "fashion", label: "Fashion", icon: "/fashion.webp", savings: "40%", members: 2, required: 4, timeLeft: "3 Days", trending: true },
  { slug: "movies", label: "Movies", icon: "/movies.webp", savings: "50%", members: 4, required: 5, timeLeft: "1 Day", trending: false },
  { slug: "lenskart", label: "Lenskart", icon: "/lenskart.png", savings: "35%", members: 2, required: 4, timeLeft: "5 Days", trending: false },
  { slug: "local-travel", label: "Local Travel", icon: "/travel.webp", savings: "45%", members: 1, required: 3, timeLeft: "4 Days", trending: true },
  { slug: "events", label: "Events", icon: "/events.webp", savings: "30%", members: 3, required: 6, timeLeft: "6 Days", trending: false },
  { slug: "coupons", label: "Coupons", icon: "/coupons.webp", savings: "55%", members: 2, required: 3, timeLeft: "2 Days", trending: false },
  { slug: "villas", label: "Villas", icon: "/villas.webp", savings: "40%", members: 3, required: 6, timeLeft: "7 Days", trending: false },
  { slug: "books", label: "Books", icon: "/books.webp", savings: "50%", members: 4, required: 5, timeLeft: "3 Days", trending: false },
];

const filters = ["All", "Popular", "Trending", "Almost Full"] as const;

export default function CategoryGrid() {
  const [activeFilter, setActiveFilter] = useState<string>("All");

  const filteredCategories = categories.filter((cat) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Popular") return ["gym", "movies", "fashion"].includes(cat.slug);
    if (activeFilter === "Trending") return cat.trending;
    if (activeFilter === "Almost Full") return cat.members / cat.required >= 0.75;
    return true;
  });

  return (
    <section className="py-10 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl sm:text-2xl text-white">
            Start Saving Now
          </h2>
          <div className="flex gap-1">
            {filters.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  activeFilter === tab
                    ? "bg-[#D4AF37] text-black shadow-[0_0_12px_rgba(212,175,55,0.3)]"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Category cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredCategories.slice(0, 6).map((cat, i) => (
              <motion.div
                key={cat.slug}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Link
                  href={`/options/${cat.slug}`}
                  className="group block p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:border-[#D4AF37]/30 hover:bg-white/[0.06] transition-all duration-300 h-full"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-800 flex-shrink-0 ring-1 ring-white/10 group-hover:ring-[#D4AF37]/30 transition-all duration-300">
                      <img src={cat.icon} alt={cat.label} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium text-sm truncate">{cat.label}</h3>
                      <span className="text-[10px] text-green-400 font-medium">Save up to {cat.savings}</span>
                    </div>
                    {cat.trending && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20 flex-shrink-0"
                      >
                        Trending
                      </motion.span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>👥 {cat.members}/{cat.required} Joined</span>
                      <span>⏳ {cat.timeLeft}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E6C97A]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(cat.members / cat.required) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <span className="inline-block w-full text-center py-2 rounded-lg text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 group-hover:bg-[#D4AF37]/20 transition-all duration-300">
                      {cat.members >= cat.required ? "🔓 Ready to Unlock" : "Join Group →"}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredCategories.length > 6 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-6"
          >
            <Link
              href="/categories"
              className="text-xs text-gray-400 hover:text-[#D4AF37] transition-colors inline-flex items-center gap-1"
            >
              View all {filteredCategories.length} categories
              <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  );
}