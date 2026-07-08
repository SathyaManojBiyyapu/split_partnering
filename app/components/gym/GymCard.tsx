"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { GymData } from "@/app/data/gyms";

interface GymCardProps {
  gym: GymData;
  index: number;
  onSelect: (gym: GymData) => void;
}

export default function GymCard({ gym, index, onSelect }: GymCardProps) {
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
        onClick={() => onSelect(gym)}
        className="card-premium block p-5 h-full text-left relative overflow-hidden w-full"
      >
        {/* Gym Image */}
        <div className="w-full h-36 sm:h-40 rounded-xl overflow-hidden bg-gray-800 mb-4 border border-[#D4AF37]/10">
          <Image
            src={gym.image || "/gym.webp"}
            alt={gym.name}
            width={400}
            height={160}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Gym Name & Verified Badge */}
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-white font-semibold text-sm flex-1 truncate">
            {gym.name}
          </h3>
          {gym.verified && (
            <span className="badge-verified text-[10px] px-2 py-0.5 flex-shrink-0">
              ⭐ Verified
            </span>
          )}
        </div>

        {/* Members Waiting */}
        <div className="flex items-center gap-1.5 mb-4">
          <span className="text-sm">👥</span>
          <span className="text-gray-400 text-xs">
            <span className="text-[#FFD166] font-semibold">{gym.waitingUsers}</span> Members Waiting
          </span>
        </div>

        {/* Make Partner Button */}
        <div className="mt-auto">
          <span className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30">
            Make Partner →
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
  );
}