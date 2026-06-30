"use client";

import { motion } from "framer-motion";

const leaderboard = [
  { rank: 1, category: "Education", saved: "₹2.3L", icon: "📚" },
  { rank: 2, category: "Travel", saved: "₹1.9L", icon: "✈️" },
  { rank: 3, category: "Fitness", saved: "₹1.4L", icon: "💪" },
  { rank: 4, category: "Entertainment", saved: "₹98K", icon: "🎬" },
  { rank: 5, category: "Shopping", saved: "₹76K", icon: "🛍️" },
];

export default function Leaderboard() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">
          Top Savings This Month
        </h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          Categories generating the most savings
        </p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden"
        >
          {leaderboard.map((entry, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-4 px-5 py-3.5 ${
                i < leaderboard.length - 1 ? "border-b border-white/5" : ""
              }`}
            >
              <span
                className={`w-6 text-center font-bold text-sm ${
                  entry.rank === 1
                    ? "text-[#D4AF37]"
                    : entry.rank === 2
                    ? "text-gray-300"
                    : entry.rank === 3
                    ? "text-amber-600"
                    : "text-gray-500"
                }`}
              >
                #{entry.rank}
              </span>
              <span className="text-lg">{entry.icon}</span>
              <span className="flex-1 text-sm text-white">{entry.category}</span>
              <span className="text-sm font-bold text-green-400">{entry.saved}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}