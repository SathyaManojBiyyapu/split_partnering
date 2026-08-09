"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { db } from "@/firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { motion } from "framer-motion";
import { categoryData, masterCategories } from "@/app/data/subcategories";

type OfferItem = {
  id: string;
  brand: string;
  title: string;
  category: string;
  categorySlug: string;
  location?: string;
  savings?: string;
  ctaHref: string;
  source: "config" | "collaborator" | "gym";
};

type FilterOption = "All" | "Gym" | "Fashion" | "Movies" | "Travel" | "Events" | "Books" | "Subscriptions" | "Coupons";

export default function OffersPage() {
  const [offers, setOffers] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterOption>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("category");

  /* ---------- Load real offers from config + Firestore ---------- */
  useEffect(() => {
    const loadOffers = async () => {
      try {
        const items: OfferItem[] = [];

        // 1. Real subcategory config offers (actual savings % from config)
        Object.entries(categoryData).forEach(([slug, cat]) => {
          cat.subcategories.forEach((sub) => {
            if (sub.savings) {
              items.push({
                id: `config-${slug}-${sub.slug}`,
                brand: cat.title,
                title: sub.name,
                category: cat.title,
                categorySlug: slug,
                savings: sub.savings,
                ctaHref: `/options/${slug}`,
                source: "config",
              });
            }
          });
        });

        // 2. Real collaborator/business offers from Firestore
        try {
          const collabSnap = await getDocs(collection(db, "collaborators"));
          collabSnap.forEach((d) => {
            const data = d.data() as any;
            if (data.status === "approved" || data.status === "featured") {
              items.push({
                id: `collab-${d.id}`,
                brand: data.businessName || data.option || "Partner Brand",
                title: data.brandName || data.option || data.businessName || "Featured Offer",
                category: data.category || "General",
                categorySlug: (data.category || "").toLowerCase().replace(/\s+/g, "-"),
                location: data.city || undefined,
                savings: undefined,
                ctaHref: `/partner/${d.id}`,
                source: "collaborator",
              });
            }
          });
        } catch (err) {
          console.warn("Could not load collaborators:", err);
        }

        setOffers(items);
      } catch (err) {
        console.error("Error loading offers:", err);
      }
      setLoading(false);
    };
    loadOffers();
  }, []);

  /* ---------- Filter + search + sort ---------- */
  const filteredOffers = offers.filter((offer) => {
    if (activeFilter !== "All") {
      const filterKey = activeFilter.toLowerCase();
      if (filterKey === "subscriptions") {
        // Treat as general category if no specific subscriptions category
        if (offer.category.toLowerCase() !== "subscriptions") return false;
      } else if (offer.category.toLowerCase() !== filterKey) {
        return false;
      }
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      offer.brand.toLowerCase().includes(q) ||
      offer.title.toLowerCase().includes(q) ||
      offer.category.toLowerCase().includes(q)
    );
  });

  const sortedOffers = [...filteredOffers].sort((a, b) => {
    if (sortBy === "category") return a.category.localeCompare(b.category);
    if (sortBy === "savings") {
      const aVal = parseFloat((a.savings || "0").replace("%", ""));
      const bVal = parseFloat((b.savings || "0").replace("%", ""));
      return bVal - aVal;
    }
    if (sortBy === "brand") return a.brand.localeCompare(b.brand);
    return 0;
  });

  const filters: FilterOption[] = ["All", "Gym", "Fashion", "Movies", "Travel", "Events", "Books", "Subscriptions", "Coupons"];

  return (
    <main className="min-h-screen pt-28 pb-32 px-4 sm:px-6 bg-black text-center pb-mobile-cta">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl text-[#FFD166] mb-2">Offers & Savings</h1>
          <p className="text-gray-400 text-sm max-w-xl mx-auto">
            Discover verified savings opportunities across categories. Only real, available offers are shown.
          </p>
        </motion.div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search offers, brands, categories..."
              className="input w-full pl-11"
              aria-label="Search offers"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
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

        {/* Sort */}
        <div className="max-w-xs mx-auto mb-10">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input text-sm"
            aria-label="Sort offers"
          >
            <option value="category" className="bg-black">Sort: Category</option>
            <option value="savings" className="bg-black">Sort: Savings %</option>
            <option value="brand" className="bg-black">Sort: Brand</option>
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card-premium p-5 animate-pulse h-48" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && sortedOffers.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎁</div>
            <h3 className="text-xl font-semibold text-[#D4AF37] mb-2">No offers found</h3>
            <p className="text-gray-400 text-sm mb-6">
              {searchQuery
                ? `No offers match "${searchQuery}".`
                : "No verified offers available in this category yet."}
            </p>
            <button
              onClick={() => { setSearchQuery(""); setActiveFilter("All"); }}
              className="btn-primary text-sm inline-block"
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Offer grid */}
        {!loading && sortedOffers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedOffers.map((offer, idx) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="h-full"
              >
                <Link
                  href={offer.ctaHref}
                  className="card-premium block p-5 h-full text-left hover:border-[#D4AF37]/30 transition-all duration-300"
                >
                  {/* Brand */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-lg flex-shrink-0">
                      {masterCategories[offer.categorySlug]?.icon || "🏷️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold text-sm truncate">{offer.brand}</h3>
                      <p className="text-[10px] text-gray-500">{offer.category}</p>
                    </div>
                    {offer.savings && (
                      <span className="text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex-shrink-0">
                        {offer.savings}
                      </span>
                    )}
                  </div>

                  {/* Offer title */}
                  <p className="text-sm text-gray-300 mb-3">{offer.title}</p>

                  {/* Location */}
                  {offer.location && (
                    <p className="text-xs text-gray-500 mb-3">📍 {offer.location}</p>
                  )}

                  {!offer.location && (
                    <p className="text-xs text-gray-600 mb-3">🌍 Available across India</p>
                  )}

                  {/* Source note */}
                  <p className="text-[10px] text-gray-600 mb-4">
                    {offer.source === "collaborator" ? "✓ Verified Partner Brand" : "✓ Category Savings"}
                  </p>

                  {/* CTA */}
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD166] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-3 py-1.5 rounded-lg hover:bg-[#D4AF37]/20 transition">
                    View Offer →
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}