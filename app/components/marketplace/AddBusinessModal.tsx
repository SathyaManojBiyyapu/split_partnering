"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitBusiness } from "@/app/lib/marketplace";
import { useUserLocation } from "@/app/lib/useUserLocation";
import { getCategoryName } from "@/app/data/categoryConfig";
import toast from "react-hot-toast";

interface AddBusinessModalProps {
  open: boolean;
  onClose: () => void;
  categorySlug: string;
  subcategory?: string;
  type: "business" | "collaborator";
}

export default function AddBusinessModal({
  open,
  onClose,
  categorySlug,
  subcategory,
  type,
}: AddBusinessModalProps) {
  const location = useUserLocation();
  const [businessName, setBusinessName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Collaborator-specific fields
  const [offerName, setOfferName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");

  const categoryName = getCategoryName(categorySlug);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const name = businessName.trim();
    if (!name) {
      toast.error("Please enter a business name");
      return;
    }

    if (!location.state || !location.district || !location.city) {
      toast.error("Please complete your profile with State, District, and City first.");
      return;
    }

    if (!location.phone) {
      toast.error("Please login first.");
      return;
    }

    setSubmitting(true);
    try {
      await submitBusiness({
        businessName: name,
        categorySlug,
        category: categoryName,
        subcategory: subcategory || "",
        state: location.state,
        district: location.district,
        city: location.city,
        userId: location.phone,
        userName: location.userName || "Anonymous",
        userEmail: location.userEmail || "",
        userPhone: location.phone,
        type,
        offerName: offerName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        description: description.trim() || undefined,
      });

      toast.success(
        type === "business"
          ? `"${name}" submitted for review!`
          : `"${name}" submitted as collaborator!`
      );
      setBusinessName("");
      setOfferName("");
      setPhone("");
      setEmail("");
      setWebsite("");
      setDescription("");
      onClose();
    } catch (err: any) {
      console.error("Error submitting:", err);
      toast.error(err?.message || "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

  const isLocationReady = location.state && location.district && location.city;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-premium p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-heading text-[#FFD166]">
                  {type === "business" ? `Add ${categoryName}` : `Collaborate as ${categoryName}`}
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition text-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-400 text-xs mb-4">
                {type === "business"
                  ? `Can't find your ${categoryName.toLowerCase()}? Submit it and we'll add it after verification.`
                  : `Register your ${categoryName.toLowerCase()} business to appear as a collaborator.`}
              </p>

              {/* Auto-filled Location */}
              {location.loading ? (
                <div className="animate-pulse text-gray-500 text-xs mb-4">Loading your location...</div>
              ) : isLocationReady ? (
                <div className="bg-black/40 rounded-lg p-3 mb-4 text-xs space-y-1">
                  <p className="text-gray-500">📍 Auto-detected from your profile:</p>
                  <p className="text-white font-medium">{location.city}, {location.district}, {location.state}</p>
                  <p className="text-[9px] text-gray-600">Location is read-only to prevent fake entries.</p>
                </div>
              ) : location.error ? (
                <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4 text-xs">
                  <p className="text-red-400">{location.error}</p>
                  <p className="text-gray-500 mt-1">Please complete your profile first.</p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Business Name */}
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    {type === "business" ? `${categoryName} Name *` : "Business Name *"}
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={
                      type === "business"
                        ? `e.g. ${categoryName} Name...`
                        : "Your business name..."
                    }
                    className="input w-full"
                    autoFocus
                    maxLength={100}
                    disabled={!isLocationReady}
                  />
                </div>

                {/* Collaborator-specific fields */}
                {type === "collaborator" && (
                  <>
                    <div>
                      <label className="block text-gray-400 text-xs mb-1.5">
                        Brand / Offer Name *
                      </label>
                      <input
                        type="text"
                        value={offerName}
                        onChange={(e) => setOfferName(e.target.value)}
                        placeholder="e.g. Gold Membership, Discount Pass..."
                        className="input w-full"
                        maxLength={100}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-400 text-xs mb-1.5">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone number"
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 text-xs mb-1.5">
                          Email
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className="input w-full"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-400 text-xs mb-1.5">
                        Website
                      </label>
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://example.com"
                        className="input w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-gray-400 text-xs mb-1.5">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Tell us about your offer..."
                        rows={3}
                        className="input w-full resize-none"
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={submitting || !businessName.trim() || !isLocationReady}
                  className="btn-primary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting
                    ? "Submitting..."
                    : type === "business"
                    ? `Submit ${categoryName}`
                    : "Submit as Collaborator"}
                </button>
              </form>

              <p className="text-[10px] text-gray-600 mt-3 text-center">
                Admin will verify and approve your submission. Location is auto-filled from your profile.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}