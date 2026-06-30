"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const savingsMap: Record<string, { monthly: number; total: number }> = {
  Netflix: { monthly: 150, total: 1800 },
  Spotify: { monthly: 89, total: 1068 },
  "Cult Fit": { monthly: 500, total: 6000 },
  "Amazon Prime": { monthly: 100, total: 1200 },
  "Gym Membership": { monthly: 2000, total: 24000 },
};

export default function SavingsCalculator() {
  const [calcMembers, setCalcMembers] = useState(3);
  const [calcCategory, setCalcCategory] = useState("Netflix");

  const calcSavings = savingsMap[calcCategory] || { monthly: 200, total: 2400 };
  const yourSavings = Math.round(
    calcSavings.monthly - calcSavings.monthly / calcMembers
  );

  return (
    <section className="py-12 px-4">
      <div className="max-w-lg mx-auto">
        <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">
          Calculate Your Savings
        </h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          See how much you can save by splitting costs
        </p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-6 rounded-xl bg-white/[0.02] border border-white/10"
        >
          {/* Category selector */}
          <div className="mb-4">
            <label
              htmlFor="calc-category"
              className="text-xs text-gray-400 mb-1 block"
            >
              What are you buying?
            </label>
            <select
              id="calc-category"
              value={calcCategory}
              onChange={(e) => setCalcCategory(e.target.value)}
              className="w-full bg-black/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-[#D4AF37] outline-none transition-colors"
            >
              {Object.keys(savingsMap).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Members slider */}
          <div className="mb-6">
            <label
              htmlFor="calc-members"
              className="text-xs text-gray-400 mb-1 block"
            >
              Members:{" "}
              <span className="text-[#D4AF37] font-semibold">
                {calcMembers}
              </span>
            </label>
            <input
              id="calc-members"
              type="range"
              min={2}
              max={10}
              value={calcMembers}
              onChange={(e) => setCalcMembers(parseInt(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>2</span>
              <span>10</span>
            </div>
          </div>

          {/* Result */}
          <motion.div
            key={`${calcCategory}-${calcMembers}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-black/40 rounded-xl p-4 text-center border border-[#D4AF37]/10"
          >
            <p className="text-xs text-gray-400 mb-1">You Save</p>
            <p className="text-3xl font-heading text-green-400">
              ₹{yourSavings.toLocaleString()}/month
            </p>
            <p className="text-[10px] text-gray-500 mt-2">
              Split ₹{calcSavings.monthly} among {calcMembers} members
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}