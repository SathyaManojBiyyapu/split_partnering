"use client";

import { motion } from "framer-motion";

export default function UrgencyBadges() {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-6 px-4"
    >
      <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          🔥 Last Member Needed — Education Group
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          ⏳ Closing In 3 Hours — Movies Group
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          🔥 Almost Full — Gym Partnership
        </span>
      </div>
    </motion.section>
  );
}