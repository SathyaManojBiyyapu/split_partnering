"use client";

import { motion } from "framer-motion";

type StatsCardsProps = {
  activeMatches: number;
  readyMatches: number;
  nearbyCount: number;
};

export default function StatsCards({ activeMatches, readyMatches, nearbyCount }: StatsCardsProps) {
  const cards = [
    { value: activeMatches, label: "Active Matches", color: "text-blue-400" },
    { value: readyMatches, label: "Ready to Unlock", color: "text-green-400" },
    { value: nearbyCount, label: "Nearby Candidates", color: "text-[#D4AF37]" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-3"
    >
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.05 }}
          className="card-glass-premium p-4 text-center"
        >
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-xs text-gray-400 mt-1">{card.label}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}