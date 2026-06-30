"use client";

import { motion } from "framer-motion";
import AnimatedCounter from "./AnimatedCounter";

const stats = [
  { value: 1247, label: "Active Groups", suffix: "" },
  { value: 1240000, label: "Saved This Month", prefix: "₹", suffix: "" },
  { value: 84, label: "Match Success Rate", suffix: "%" },
  { value: 10000, label: "Happy Users", suffix: "+" },
];

export default function StatsSection() {
  return (
    <section className="py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300"
            >
              <p className="text-xl sm:text-2xl font-heading text-[#D4AF37]">
                {stat.prefix || ""}
                <AnimatedCounter target={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}