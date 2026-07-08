"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUserLocation } from "@/app/lib/useUserLocation";
import { categoryConfigs, getCategoryName } from "@/app/data/categoryConfig";
import AddBusinessModal from "@/app/components/marketplace/AddBusinessModal";

// Flow states
type FlowStep = "categories" | "subcategories";

interface SubcategoryOption {
  name: string;
  slug: string;
  icon: string;
  description: string;
}

// Default subcategory icons and descriptions
const subcategoryDefaults: Record<string, SubcategoryOption[]> = {
  gym: [
    { name: "Gym Membership Split", slug: "membership", icon: "🏋️", description: "Offer shared gym membership plans" },
    { name: "Supplements Group Buy", slug: "supplements", icon: "💊", description: "Sell supplements to groups" },
    { name: "Personal Trainer Split", slug: "trainer", icon: "🎯", description: "Offer group training packages" },
    { name: "Day Pass Sharing", slug: "pass", icon: "🎟️", description: "Offer day pass deals" },
    { name: "Fitness Equipment Group Buy", slug: "equipment", icon: "🏃", description: "Bulk equipment sales" },
  ],
  fashion: [
    { name: "Group Shopping", slug: "group-shopping", icon: "👕", description: "Offer group discounts on fashion" },
    { name: "Sneakers", slug: "sneakers", icon: "👟", description: "Bulk sneaker deals" },
  ],
  movies: [
    { name: "Save Ticket", slug: "save-ticket", icon: "🎫", description: "Offer ticket transfer deals" },
    { name: "Bulk Ticket", slug: "bulk-ticket", icon: "🎟️", description: "Group booking discounts" },
  ],
  "local-travel": [
    { name: "Trip Cost Sharing", slug: "trip-cost", icon: "✈️", description: "Group travel packages" },
    { name: "Carpool", slug: "cab", icon: "🚗", description: "Carpool services" },
    { name: "Hotel Sharing", slug: "hotel", icon: "🏨", description: "Shared hotel deals" },
    { name: "Travel Groups", slug: "travel-group", icon: "👥", description: "Group tour packages" },
    { name: "Travel Partner", slug: "travel-partner", icon: "🌍", description: "Travel buddy matching" },
    { name: "Backpacking Groups", slug: "backpacking", icon: "🎒", description: "Backpacking group deals" },
  ],
  books: [
    { name: "Book Exchange", slug: "book-exchange", icon: "📚", description: "Book exchange services" },
    { name: "Second-Hand Books", slug: "second-hand", icon: "📖", description: "Pre-owned book sales" },
    { name: "Competitive Exam Books", slug: "competitive", icon: "🎯", description: "Exam book groups" },
    { name: "Engineering Books", slug: "engineering", icon: "🎓", description: "Engineering book sharing" },
    { name: "Academic Books", slug: "academic", icon: "📘", description: "Academic resource sharing" },
    { name: "Novel Community", slug: "novel", icon: "📕", description: "Novel reading communities" },
    { name: "Group Book Purchases", slug: "group-purchase", icon: "📦", description: "Bulk book orders" },
  ],
  events: [
    { name: "Event Passes", slug: "passes", icon: "🎤", description: "Group event pass deals" },
  ],
  coupons: [
    { name: "Discount Coupons", slug: "discounts", icon: "🎟️", description: "Coupon sharing services" },
  ],
  villas: [
    { name: "Weekend Stay", slug: "weekend", icon: "🏡", description: "Group villa stays" },
  ],
  lenskart: [
    { name: "Eyeglasses Split", slug: "eyeglasses", icon: "👓", description: "Eyewear group deals" },
  ],
};

// All category cards (same as Explore page)
const categories = Object.entries(categoryConfigs).map(([slug, config]) => ({
  slug,
  name: config.name,
  icon: config.icon,
  subtitle: config.subtitle,
  defaultImage: config.defaultImage,
  subcategoryCount: config.subcategories.length,
}));

export default function CollaboratorsPage() {
  const location = useUserLocation();
  const [flowStep, setFlowStep] = useState<FlowStep>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedConfig = selectedCategory ? categoryConfigs[selectedCategory] : null;

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    setFlowStep("subcategories");
  };

  const handleSubcategorySelect = (subName: string) => {
    setSelectedSubcategory(subName);
    setShowAddModal(true);
  };

  const handleBack = () => {
    if (flowStep === "subcategories") {
      setFlowStep("categories");
      setSelectedCategory(null);
      setSelectedSubcategory(null);
    }
  };

  const handleModalClose = () => {
    setShowAddModal(false);
    setSelectedSubcategory(null);
  };

  return (
    <main className="min-h-screen bg-black text-white pb-mobile-cta">
      {/* ===== HERO SECTION (same as Explore categories page styling) ===== */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl mb-3 text-[#FFD166] leading-tight">
              Become a PartnerSync Collaborator
            </h1>
            <p className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto mb-4 px-2">
              Reach users already searching for partnerships in your city. 
              Register your business and appear automatically after admin approval.
            </p>

            {/* Location Display */}
            {location.city && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 bg-black/40 border border-[#D4AF37]/20 rounded-full px-4 py-2 text-xs"
              >
                <span className="text-lg">📍</span>
                <span className="text-gray-400">Your Location:</span>
                <span className="text-[#FFD166] font-semibold">{location.city}, {location.state}</span>
              </motion.div>
            )}
            {!location.loading && !location.city && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-xs text-gray-500"
              >
                <Link href="/profile" className="text-[#D4AF37] hover:underline">
                  Complete your profile
                </Link>{" "}
                to register your business in your city.
              </motion.div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== BREADCRUMB ===== */}
      <section className="px-4 sm:px-6 mb-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <button
              onClick={handleBack}
              className="text-[#FFD166] hover:underline"
            >
              ← Back
            </button>
            {selectedCategory && (
              <>
                <span>/</span>
                <span className="text-white">{getCategoryName(selectedCategory)}</span>
                {selectedSubcategory && (
                  <>
                    <span>/</span>
                    <span className="text-gray-300">{selectedSubcategory}</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ===== CATEGORIES GRID (same layout as Explore page) ===== */}
      {flowStep === "categories" && (
        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-heading text-xl sm:text-2xl text-[#FFD166] mb-1"
            >
              Select Your Category
            </motion.h2>
            <p className="text-gray-400 text-xs mb-6">Choose the category you want to collaborate in</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {categories.map((cat, i) => (
                <motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <button
                    onClick={() => handleCategorySelect(cat.slug)}
                    className="card-premium block p-5 h-full w-full text-left relative overflow-hidden"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 border border-[#D4AF37]/20">
                        <Image
                          src={cat.defaultImage}
                          alt={cat.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-white font-semibold text-sm">{cat.name}</h2>
                        <p className="text-[10px] text-gray-400">{cat.subtitle}</p>
                      </div>
                      <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg px-2.5 py-1.5 flex-shrink-0">
                        <p className="text-[#FFD166] text-[10px] font-bold">{cat.subcategoryCount} options</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-500 mb-4">
                      Register your {cat.name.toLowerCase()} business to collaborate with PartnerSync users.
                    </p>

                    <div className="mt-auto">
                      <span className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 group-hover:bg-[#D4AF37]/30">
                        Collaborate →
                      </span>
                    </div>

                    {/* Gold glow overlay on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(circle at 50% 100%, rgba(212, 175, 55, 0.08), transparent 70%)",
                      }}
                    />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== SUBCATEGORIES GRID (same layout as options page) ===== */}
      {flowStep === "subcategories" && selectedConfig && (
        <section className="px-4 sm:px-6 pb-16">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6"
            >
              <h2 className="font-heading text-xl sm:text-2xl text-[#FFD166] mb-1">
                {selectedConfig.icon} {selectedConfig.name} Collaboration
              </h2>
              <p className="text-gray-400 text-xs">
                Select your specific service area to collaborate in
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(subcategoryDefaults[selectedCategory!] || selectedConfig.subcategories.map((name) => ({
                name,
                slug: name.toLowerCase().replace(/\s+/g, "-"),
                icon: "🤝",
                description: `Offer ${name.toLowerCase()} collaboration`,
              }))).map((sub, i) => (
                <motion.div
                  key={sub.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4 }}
                >
                  <button
                    onClick={() => handleSubcategorySelect(sub.name)}
                    className="card-premium p-5 h-full w-full text-left"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/20 flex items-center justify-center text-xl flex-shrink-0">
                        {sub.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-sm leading-tight">{sub.name}</h3>
                        <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{sub.description}</p>
                      </div>
                    </div>

                    <div className="bg-black/30 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-[#FFD166] text-xs font-bold">🤝</span>
                        <span className="text-gray-400 text-[10px]">Partner with users looking for {sub.name}</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      <span className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30">
                        Collaborate →
                      </span>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== COLLABORATOR REGISTRATION MODAL ===== */}
      {selectedCategory && (
        <AddBusinessModal
          open={showAddModal}
          onClose={handleModalClose}
          categorySlug={selectedCategory}
          subcategory={selectedSubcategory || undefined}
          type="collaborator"
        />
      )}

      {/* ===== STEPS FOOTER ===== */}
      <div className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="glass-strong rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-[#FFD166] mb-4 text-center">How It Works</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { step: "1", icon: "🎯", title: "Select Category", desc: "Choose your business type" },
                { step: "2", icon: "📋", title: "Pick Service", desc: "Select what you offer" },
                { step: "3", icon: "📝", title: "Register", desc: "Submit business details" },
                { step: "4", icon: "✅", title: "Get Approved", desc: "Appear after admin review" },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg">{item.icon}</span>
                  </div>
                  <p className="text-[10px] text-[#FFD166] font-bold mb-0.5">Step {item.step}</p>
                  <p className="text-xs text-white font-medium">{item.title}</p>
                  <p className="text-[9px] text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== STICKY BOTTOM CTA ===== */}
      {flowStep === "categories" && (
        <div className="sticky-bottom-cta">
          <button
            onClick={() => {
              if (categories.length > 0) handleCategorySelect(categories[0].slug);
            }}
            className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm"
          >
            Get Started →
          </button>
        </div>
      )}
    </main>
  );
}