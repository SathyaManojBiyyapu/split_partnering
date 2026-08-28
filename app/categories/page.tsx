"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { auth, db } from "@/firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import CategoryImage from "@/app/components/ui/CategoryImage";
import Seo from "@/app/components/Seo";

type Category = {
  name: string;
  slug: string;
  icon: string;
  description: string;
  subcategories: string[];
  href: string;
};

const categories: Category[] = [
  { name: "Gym", slug: "gym", icon: "💪", description: "Split memberships, gym passes, supplements & fitness programs", subcategories: ["Gym Membership", "Gym Pass", "Supplements", "Fitness Programs"], href: "/options/gym" },
  { name: "Movies", slug: "movies", icon: "🎬", description: "Share movie tickets, OTT & entertainment costs", subcategories: ["Movie Tickets", "OTT/Streaming", "Entertainment"], href: "/options/movies" },
  { name: "Travel", slug: "local-travel", icon: "✈️", description: "Split flights, hotels, villas, local travel & bus/train", subcategories: ["Flights", "Hotels", "Villas", "Local Travel", "Bus/Train"], href: "/options/local-travel" },
  { name: "Events", slug: "events", icon: "🎤", description: "Group access to concerts, sports & events", subcategories: ["Concerts", "Sports", "College Events", "Other Events"], href: "/options/events" },
  { name: "Fashion", slug: "fashion", icon: "👗", description: "Group shopping, shoes, accessories & brand offers", subcategories: ["Clothing", "Shoes", "Accessories", "Brand Offers"], href: "/options/fashion" },
  { name: "Books", slug: "books", icon: "📚", description: "Share textbooks, courses & learning resources", subcategories: ["Textbooks", "Courses", "Learning Resources"], href: "/options/books" },
  { name: "Subscriptions", slug: "subscriptions", icon: "📺", description: "Split streaming, software & productivity plans", subcategories: ["Streaming", "Software", "Productivity", "Other subscriptions"], href: "/categories" },
  { name: "Coupons", slug: "coupons", icon: "🎟️", description: "Unlock shared food, shopping, travel & entertainment deals", subcategories: ["Food", "Shopping", "Travel", "Entertainment"], href: "/options/coupons" },
];

type FilterOption = "All" | "Popular" | "Trending" | "New";

export default function CategoriesPage() {
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");

  /* Fetch group counts per category — real Firestore data.
     NOTE: firestore.rules only allow `groups` reads for logged-in users, so the
     listener is attached ONLY when authenticated. Guests skip it entirely
     (counts stay empty => "Be the first!" state) instead of triggering a
     permission-denied listener error. Error callback prevents uncaught errors. */
  useEffect(() => {
    let unsub: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      // Detach any previous listener before (re)attaching
      if (unsub) {
        unsub();
        unsub = null;
      }

      if (!user) {
        setGroupCounts({});
        return;
      }

      unsub = onSnapshot(
        collection(db, "groups"),
        (snapshot) => {
          const counts: Record<string, number> = {};
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            const cat = data.category;
            if (cat) {
              counts[cat] = (counts[cat] || 0) + 1;
            }
          });
          setGroupCounts(counts);
        },
        (err) => {
          console.warn("Group counts listener error:", err);
        }
      );
    });

    return () => {
      if (unsub) unsub();
      unsubAuth();
    };
  }, []);

  /* Filter categories */
  const filteredCategories = categories.filter((cat) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Popular") return ["Gym", "Movies", "Travel", "Fashion"].includes(cat.name);
    if (activeFilter === "Trending") return ["Gym", "Movies", "Travel", "Events"].includes(cat.name);
    if (activeFilter === "New") return ["Subscriptions", "Coupons", "Books"].includes(cat.name);
    return true;
  }).filter((cat) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.name.toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q) ||
      cat.subcategories.some((s) => s.toLowerCase().includes(q))
    );
  });

  const filters: FilterOption[] = ["All", "Popular", "Trending", "New"];

  return (
    <main className="min-h-screen pt-28 pb-32 px-4 sm:px-6 bg-black text-center pb-mobile-cta">
      <Seo
        title="Categories"
        description="Explore PartnerSync categories — Gym, Movies, Travel, Events, Fashion, Books, Subscriptions and Coupons. Find partners to split costs."
        canonicalPath="/categories"
      />
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

      {/* ===== SEARCH ===== */}
      <div className="max-w-xl mx-auto mb-8 px-4">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories or subcategories..."
            className="input w-full pl-11"
            aria-label="Search categories"
          />
        </div>
      </div>

      {/* ===== FILTER TABS ===== */}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-6xl mx-auto">
        <AnimatePresence>
          {filteredCategories.map((cat, i) => {
            const groupCount = groupCounts[cat.slug] || 0;
            return (
              <motion.div
                key={cat.slug}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="h-full"
              >
                <Link
                  href={cat.href}
                  className="card-premium block p-6 h-full text-left relative overflow-hidden flex flex-col"
                >
                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-[#D4AF37]/20">
                      <CategoryImage
                        categorySlug={cat.slug}
                        alt={cat.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                        fallbackIcon={cat.icon}
                      />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-white font-semibold text-base">{cat.name}</h2>
                      <span className="text-[10px] text-gray-500">{cat.subcategories.length} options</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-400 leading-relaxed mb-4 flex-1">
                    {cat.description}
                  </p>

                  {/* Subcategory chips */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {cat.subcategories.slice(0, 4).map((sub) => (
                      <span key={sub} className="text-[9px] text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
                        {sub}
                      </span>
                    ))}
                    {cat.subcategories.length > 4 && (
                      <span className="text-[9px] text-gray-500 bg-gray-800/50 px-2 py-0.5 rounded-full">
                        +{cat.subcategories.length - 4}
                      </span>
                    )}
                  </div>

                  {/* Group count + CTA */}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-gray-500">
                      {groupCount > 0 ? `${groupCount} Group${groupCount !== 1 ? "s" : ""}` : "Be the first!"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD166] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-3 py-1.5 rounded-lg hover:bg-[#D4AF37]/20 transition">
                      Find Partners →
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
          <p>No categories match "{searchQuery}".</p>
        </motion.div>
      )}

      {/* ===== STATS SUMMARY ===== */}
      <div className="mt-16 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { value: `${categories.length}`, label: "Categories", color: "text-[#FFD166]" },
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

      {/* ===== STICKY BOTTOM CTA ===== */}
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