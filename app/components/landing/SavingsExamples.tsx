"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const realExamples = [
  { name: "Netflix Premium", savings: "₹150/month", members: "4/5 Joined", icon: "🎬" },
  { name: "Cult Fit Membership", savings: "₹500/month", members: "2/4 Joined", icon: "💪" },
  { name: "Goa Trip Group", savings: "₹4,000", members: "3/6 Joined", icon: "✈️" },
  { name: "Amazon Prime", savings: "₹100/month", members: "3/3 Joined", icon: "📦" },
  { name: "Spotify Family", savings: "₹89/month", members: "5/6 Joined", icon: "🎵" },
];

export default function SavingsExamples() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">
          Real Savings Examples
        </h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          See how much people are saving right now
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {realExamples.map((example, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#D4AF37]/20 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{example.icon}</span>
                <h3 className="text-white font-medium text-sm">{example.name}</h3>
              </div>
              <div className="space-y-1.5 text-xs text-gray-400">
                <p>
                  Save:{" "}
                  <span className="text-green-400 font-bold">{example.savings}</span>
                </p>
                <p>
                  Members:{" "}
                  <span className="text-[#D4AF37]">{example.members}</span>
                </p>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2">
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    initial={{ width: "0%" }}
                    whileInView={{ width: `${(parseInt(example.members) / 6) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                  />
                </div>
              </div>
              <Link
                href="/categories"
                className="mt-3 inline-block text-[10px] text-[#D4AF37] hover:text-[#E6C97A] transition-colors"
              >
                Join Group →
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}