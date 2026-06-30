"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type EmptyStateProps = {
  nearbyCount: number;
};

export default function EmptyState({ nearbyCount }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-8 card-glass-premium p-8 text-center max-w-lg mx-auto"
    >
      <div className="text-4xl mb-4">🔍</div>
      <h3 className="text-lg font-semibold text-[#D4AF37] mb-2">
        Finding Compatible Members
      </h3>

      <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full progress-active"
          initial={{ width: "0%" }}
          animate={{ width: "65%" }}
          transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
        />
      </div>

      <p className="text-sm text-gray-400 mb-2">
        Expected Match:{" "}
        <span className="text-[#D4AF37] font-medium">2-6 Hours</span>
      </p>
      <p className="text-xs text-gray-500">
        👥 {nearbyCount} People Currently Searching
      </p>

      <Link
        href="/categories"
        className="mt-6 inline-block btn-primary text-sm"
      >
        Explore Categories
      </Link>
    </motion.div>
  );
}