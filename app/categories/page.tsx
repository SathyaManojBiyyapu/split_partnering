"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import { collection, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import CategoryImage from "@/app/components/ui/CategoryImage";
import { getCategoryImage } from "@/app/data/categoryImages";

const categories = [
  { 
    name: "Gym", 
    slug: "gym", 
    subtitle: "Shared memberships", 
    icon: "💪", 
    savings: "60%",
    members: 3,
    required: 5,
    timeLeft: "2 Days" 
  },
  { 
    name: "Fashion", 
    slug: "fashion", 
    subtitle: "Group shopping deals", 
    icon: "👗", 
    savings: "40%",
    members: 2,
    required: 4,
    timeLeft: "3 Days" 
  },
  { 
    name: "Movies", 
    slug: "movies", 
    subtitle: "Movie ticket partnerships", 
    icon: "🎬", 
    savings: "50%",
    members: 4,
    required: 5,
    timeLeft: "1 Day" 
  },
  { 
    name: "Lenskart", 
    slug: "lenskart", 
    subtitle: "Eyewear savings", 
    icon: "👓", 
    savings: "35%",
    members: 2,
    required: 4,
    timeLeft: "5 Days" 
  },
  { 
    name: "Local Travel", 
    slug: "local-travel", 
    subtitle: "Ride sharing", 
    icon: "🚗", 
    savings: "45%",
    members: 1,
    required: 3,
    timeLeft: "4 Days" 
  },
  { 
    name: "Events", 
    slug: "events", 
    subtitle: "Group event access", 
    icon: "🎤", 
    savings: "30%",
    members: 3,
    required: 6,
    timeLeft: "6 Days" 
  },
  { 
    name: "Coupons", 
    slug: "coupons", 
    subtitle: "Daily deals", 
    icon: "🎟️", 
    savings: "55%",
    members: 2,
    required: 3,
    timeLeft: "2 Days" 
  },
  { 
    name: "Villas", 
    slug: "villas", 
    subtitle: "Shared stays", 
    icon: "🏡", 
    savings: "40%",
    members: 3,
    required: 6,
    timeLeft: "7 Days" 
  },
  { 
    name: "Books", 
    slug: "books", 
    subtitle: "Shared learning", 
    icon: "📚", 
    savings: "50%",
    members: 4,
    required: 5,
    timeLeft: "3 Days" 
  },
];

type FilterOption = "All" | "Popular" | "Trending" | "New" | "Almost Full";

export default function CategoriesPage() {
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [phone, setPhone] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
    setPhone(raw?.trim() || null);
  }, []);

  /* Fetch group counts per category */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "groups"), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const cat = data.category;
        if (cat) {
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      setGroupCounts(counts);
    });
    return () => unsub();
  }, []);

  /* Fetch user's active groups */
  useEffect(() => {
    if (!phone) return;
    const unsub = onSnapshot(collection(db, "groups"), (snapshot) => {
      const userCats: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const members = Array.isArray(data.members) ? data.members : [];
        const hasUser = members.some((m: any) => {
          if (typeof m === "string") return m.trim() === phone;
          return m?.phone?.trim() === phone;
        });
        const hasUID = Array.isArray(data.memberUIDs) && data.memberUIDs.includes(phone);
        if (hasUser || hasUID) {
          if (data.category && !userCats.includes(data.category)) {
            userCats.push(data.category);
          }
        }
      });
      setUserGroups(userCats);
    });
    return () => unsub();
  }, [phone]);

  /* Filter categories */
  const filteredCategories = categories.filter((cat) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Popular") return ["Gym", "Movies", "Fashion", "Local Travel"].includes(cat.name);
    if (activeFilter === "Trending") return ["Gym", "Movies", "Fashion", "Local Travel"].includes(cat.name);
    if (activeFilter === "New") return ["Books", "Events", "Coupons"].includes(cat.name);
    if (activeFilter === "Almost Full") return cat.members / cat.required >= 0.6;
    return true;
  });

  const filters: FilterOption[] = ["All", "Popular", "Trending", "New", "Almost Full"];

  return (
    <main className="min-h-screen pt-28 pb-32 px-4 sm:px-6 bg-black text-center pb-mobile-cta">

      {/* ===== HEADING ===== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl mb-3 text-[#FFD166] leading-tight">
          Find People Near You.
          <br />
          <span className="text-white/80 text-xl sm:text-2xl">Split Costs. Save Money.</span>
        </h1>

        <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-8 px-2">
          Join people in your city and reduce costs through trusted partnerships and group savings.
        </p>
      </motion.div>

      {/* ===== FILTER TABS (Section 14) ===== */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {filters.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`filter-tab ${activeFilter === filter ? "active" : ""}`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* ===== CATEGORY GRID ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        <AnimatePresence>
          {filteredCategories.map((cat, i) => {
            const isActive = userGroups.includes(cat.name);
            const groupCount = groupCounts[cat.name] || 0;
            const progressPercent = Math.min((cat.members / cat.required) * 100, 100);
            const isAlmostFull = cat.members / cat.required >= 0.75;

            return (
              <motion.div
                key={cat.slug}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  duration: 0.3,
                  delay: i * 0.05
                }}
                whileHover={{ y: -4 }}
              >
                <Link
                  href={`/options/${cat.slug}`}
                  className="card-premium block p-5 h-full text-left relative overflow-hidden"
                >
                  {/* Category icon with image */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-[#D4AF37]/20">
                      <CategoryImage
                        categorySlug={cat.slug}
                        alt={cat.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        fallbackIcon={cat.icon}
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-white font-semibold text-sm">{cat.name}</h2>
                      <p className="text-[10px] text-gray-400">{cat.subtitle}</p>
                    </div>
                    
                    {/* Savings badge */}
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1">
                      <p className="text-green-400 text-[10px] font-bold">-{cat.savings}</p>
                    </div>
                  </div>

                  {/* Progress section */}
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">
                        👥 <span className="text-[#FFD166] font-semibold">{cat.members}</span>/{cat.required} Joined
                      </span>
                      <span className="text-gray-400">⏳ {cat.timeLeft}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progressPercent}%`,
                          background: isAlmostFull
                            ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                            : "linear-gradient(90deg, #D4AF37, #E6C97A)",
                        }}
                      />
                    </div>
                  </div>

                  {/* Group count & active status */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">
                      {groupCount > 0 ? `${groupCount} Active Group${groupCount !== 1 ? "s" : ""}` : "Be the first!"}
                    </span>
                    
                    {isActive ? (
                      <span className="text-[10px] text-green-400 bg-green-900/30 px-2.5 py-1 rounded-full border border-green-500/30 font-medium">
                        ● Active Match
                      </span>
                    ) : isAlmostFull ? (
                      <span className="badge-urgent text-[10px] px-2.5 py-1">
                        🔥 Almost Full
                      </span>
                    ) : null}
                  </div>

                  {/* CTA Button */}
                  <div className="mt-4">
                    <span className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300"
                      style={{
                        background: isActive 
                          ? "linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.1))"
                          : "linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(230, 201, 122, 0.1))",
                        color: isActive ? "#10b981" : "#FFD166",
                        border: isActive 
                          ? "1px solid rgba(16, 185, 129, 0.3)" 
                          : "1px solid rgba(212, 175, 55, 0.3)",
                      }}
                    >
                      {isActive ? "● Match Running" : cat.members >= cat.required ? "🔓 Ready to Unlock" : "Join Group →"}
                    </span>
                  </div>

                  {/* Gold glow overlay on hover */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                      background: "radial-gradient(circle at 50% 100%, rgba(212, 175, 55, 0.08), transparent 70%)",
                    }}
                  />
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Empty state */}
      {filteredCategories.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 text-gray-400"
        >
          <p>No categories match this filter.</p>
        </motion.div>
      )}

      {/* ===== STATS SUMMARY ===== */}
      <div className="mt-16 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { value: "9", label: "Categories", color: "text-[#FFD166]" },
          { value: "₹10L+", label: "Total Savings", color: "text-green-400" },
          { value: "1,000+", label: "Active Users", color: "text-blue-400" },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="glass-strong rounded-xl p-4 text-center"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ===== STICKY BOTTOM CTA (Section 24) ===== */}
      <div className="sticky-bottom-cta">
        <Link
          href="/"
          className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}