"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function MainCTA() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-2xl mx-auto text-center">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-heading text-2xl sm:text-3xl text-white mb-3"
        >
          Ready to Start Saving?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 text-sm mb-6"
        >
          Join thousands of people already saving money through smart partnerships.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
        >
          <Link
            href="/categories"
            className="inline-flex items-center px-6 py-3 rounded-lg font-semibold text-sm bg-[#D4AF37] text-black hover:bg-[#E6C97A] transition-colors"
          >
            Explore Categories
          </Link>
        </motion.div>
      </div>
    </section>
  );
}