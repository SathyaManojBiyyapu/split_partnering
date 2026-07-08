"use client";

import { motion } from "framer-motion";

interface AddGymPlusCardProps {
  index: number;
  onAdd: () => void;
}

export default function AddGymPlusCard({ index, onAdd }: AddGymPlusCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
      }}
      whileHover={{ y: -4 }}
    >
      <button
        onClick={onAdd}
        className="card-premium block p-5 h-full text-left relative overflow-hidden w-full"
      >
        {/* Plus icon area */}
        <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden bg-gradient-to-br from-[#D4AF37]/5 to-[#E6C97A]/5 border border-dashed border-[#D4AF37]/20 mb-4 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <span className="text-3xl text-[#D4AF37]">+</span>
          </div>
        </div>

        {/* Text */}
        <h3 className="text-white font-semibold text-sm mb-1">
          Can't Find Your Gym?
        </h3>
        <p className="text-gray-400 text-xs">
          Add Gym
        </p>

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
  );
}