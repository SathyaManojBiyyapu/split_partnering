"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { submitUserCollaboration } from "@/app/lib/userCollaborations";
import { useUserLocation } from "@/app/lib/useUserLocation";
import toast from "react-hot-toast";

interface AddGymModalProps {
  open: boolean;
  onClose: () => void;
  city: string;
  userPhone: string | null;
}

export default function AddGymModal({ open, onClose, city, userPhone }: AddGymModalProps) {
  const location = useUserLocation();
  const [gymName, setGymName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = gymName.trim();
    if (!name) {
      toast.error("Please enter a gym name");
      return;
    }

    const effectiveCity = city || location.city || "";
    const effectiveState = location.state || "";
    const effectiveDistrict = location.district || "";

    if (!effectiveCity) {
      toast.error("City not found. Please complete your profile first.");
      return;
    }
    if (!effectiveState) {
      toast.error("State not found. Please complete your profile first.");
      return;
    }
    if (!effectiveDistrict) {
      toast.error("District not found. Please complete your profile first.");
      return;
    }

    setSubmitting(true);
    try {
      const docId = await submitUserCollaboration({
        businessName: name,
        category: "Gym",
        categorySlug: "gym",
        subCategory: "Gym Membership Split",
        state: effectiveState,
        district: effectiveDistrict,
        city: effectiveCity,
        createdBy: userPhone || location.phone || "anonymous",
        createdByName: location.userName || "Anonymous",
        createdByEmail: location.userEmail || "",
        createdByPhone: userPhone || location.phone || "anonymous",
      });
      
      if (!docId) {
        throw new Error("Firestore did not return a document ID - write may have failed");
      }

      toast.success(`✅ Submitted Successfully!\nYour request has been sent to PartnerSync Admin. After approval it will automatically become available to users from your city.`);
      setGymName("");
      onClose();
    } catch (err: any) {
      console.error("Error submitting gym:", err);
      toast.error(err?.message || "Failed to submit. Try again.");
    }
    setSubmitting(false);
  };

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
                  Add Gym
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition text-lg"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-400 text-xs mb-4">
                Can't find your gym? Submit its name and we'll add it after verification.
              </p>

              {city && (
                <p className="text-gray-500 text-[10px] mb-4">
                  📍 {city}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">
                    Gym Name
                  </label>
                  <input
                    type="text"
                    value={gymName}
                    onChange={(e) => setGymName(e.target.value)}
                    placeholder="Enter gym name..."
                    className="input w-full"
                    autoFocus
                    maxLength={100}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !gymName.trim()}
                  className="btn-primary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Submitting..." : "Submit"}
                </button>
              </form>

              <p className="text-[10px] text-gray-600 mt-3 text-center">
                Admin will verify and approve your submission shortly.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}