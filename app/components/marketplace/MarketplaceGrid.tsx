"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUserLocation } from "@/app/lib/useUserLocation";
import { subscribeToBusinesses, MarketplaceBusiness } from "@/app/lib/marketplace";
import BusinessCard from "./BusinessCard";
import AddBusinessModal from "./AddBusinessModal";
import { getCategoryName } from "@/app/data/categoryConfig";

interface MarketplaceGridProps {
  categorySlug: string;
  subcategory?: string;
  buttonLabel?: string;
  buttonHrefBuilder?: (business: MarketplaceBusiness) => string;
  showAddButton?: boolean;
  addButtonType?: "business" | "collaborator";
  emptyMessage?: string;
}

export default function MarketplaceGrid({
  categorySlug,
  subcategory,
  buttonLabel = "Make Partner →",
  buttonHrefBuilder,
  showAddButton = true,
  addButtonType = "business",
  emptyMessage,
}: MarketplaceGridProps) {
  const location = useUserLocation();
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const categoryName = getCategoryName(categorySlug);

  // Subscribe to businesses for this category + city
  useEffect(() => {
    if (!location.state || !location.district || !location.city) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToBusinesses(
      categorySlug,
      location.state,
      location.district,
      location.city,
      (data) => {
        // Filter by subcategory if specified
        const filtered = subcategory
          ? data.filter((b) => b.subcategory === subcategory)
          : data;
        setBusinesses(filtered);
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [categorySlug, subcategory, location.state, location.district, location.city]);

  // Search filter
  const filteredBusinesses = searchQuery
    ? businesses.filter((b) =>
        b.businessName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : businesses;

  const defaultEmptyMessage = subcategory
    ? `No ${subcategory} businesses found in ${location.city || "your city"} yet.`
    : `No ${categoryName} businesses found in ${location.city || "your city"} yet.`;

  // Show location warning if user hasn't completed profile
  if (!location.loading && !location.state) {
    return (
      <div className="text-center py-8">
        <div className="glass-strong rounded-xl p-6 max-w-md mx-auto">
          <p className="text-gray-400 text-sm mb-2">
            📍 Complete your profile to see businesses in your city.
          </p>
          <p className="text-gray-500 text-xs mb-4">{location.error || "Set your State, District, and City in your profile."}</p>
          <a
            href="/profile"
            className="btn-primary text-xs inline-block"
          >
            Complete Profile →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Search Bar */}
      {businesses.length > 0 && (
        <div className="mb-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${categoryName} in ${location.city || "your city"}...`}
            className="input w-full max-w-md"
          />
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card-premium p-5 animate-pulse"
            >
              <div className="w-full h-32 rounded-xl bg-gray-800 mb-4" />
              <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-800 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-800 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Business Grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence>
            {filteredBusinesses.length > 0 ? (
              filteredBusinesses.map((business, i) => {
                const href = buttonHrefBuilder
                  ? buttonHrefBuilder(business)
                  : undefined;
                return (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    index={i}
                    buttonLabel={buttonLabel}
                    buttonHref={href}
                  />
                );
              })
            ) : (
              <div className="col-span-full text-center py-12">
                <div className="glass-strong rounded-xl p-6 max-w-md mx-auto">
                  <p className="text-gray-400 text-sm mb-2">
                    {searchQuery
                      ? `No results for "${searchQuery}" in ${location.city || "your city"}`
                      : emptyMessage || defaultEmptyMessage}
                  </p>
                  {showAddButton && (
                    <p className="text-gray-500 text-xs mt-3">
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="text-[#D4AF37] hover:underline font-medium"
                      >
                        + Add {categoryName}
                      </button>
                      {location.city && (
                        <span className="text-gray-600">
                          {" "}in {location.city}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Add Button Card */}
            {showAddButton && filteredBusinesses.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: filteredBusinesses.length * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <button
                  onClick={() => setShowAddModal(true)}
                  className="card-premium p-5 h-full w-full text-left flex flex-col items-center justify-center gap-3 min-h-[200px]"
                >
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border-2 border-dashed border-[#D4AF37]/40 flex items-center justify-center">
                    <span className="text-3xl text-[#FFD166]">+</span>
                  </div>
                  <div className="text-center">
                    <p className="text-[#FFD166] font-semibold text-sm">
                      Add {categoryName}
                    </p>
                    <p className="text-gray-500 text-[10px] mt-1">
                      Not seeing your {categoryName.toLowerCase()}? Add it here.
                    </p>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Add Business Modal */}
      <AddBusinessModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        categorySlug={categorySlug}
        subcategory={subcategory}
        type={addButtonType}
      />
    </div>
  );
}