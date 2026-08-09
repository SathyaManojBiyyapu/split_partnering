"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const benefits = [
  { icon: "💪", title: "Gym Memberships", desc: "Split monthly membership fees with a partner and pay half.", saved: "Save up to 50%" },
  { icon: "🎬", title: "Movie Tickets", desc: "Book together and unlock group pricing on tickets.", saved: "Save up to 40%" },
  { icon: "✈️", title: "Travel Costs", desc: "Share flights, hotels, villas and ride costs with travelers.", saved: "Save up to 45%" },
  { icon: "📺", title: "Subscriptions", desc: "Split streaming, software and productivity plans.", saved: "Save up to 70%" },
  { icon: "👗", title: "Fashion & Brands", desc: "Combine purchases to reach group discount thresholds.", saved: "Save up to 40%" },
  { icon: "📚", title: "Books & Learning", desc: "Share textbooks and courses with fellow learners.", saved: "Save up to 50%" },
];

export default function SavingsExamples() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-heading text-2xl sm:text-3xl text-white mb-2">
            Split Costs. Save More.
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Partnering turns regular expenses into shared savings across every category.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="group p-6 rounded-xl bg-white/[0.02] border border-white/10 hover:border-[#D4AF37]/20 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{benefit.icon}</span>
                </div>
                <h3 className="text-white font-medium text-sm">{benefit.title}</h3>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                {benefit.desc}
              </p>
              <p className="text-xs font-bold text-green-400">{benefit.saved}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            href="/categories"
            className="btn-primary text-sm inline-block"
          >
            Start Saving Today
          </Link>
        </div>
      </div>
    </section>
  );
}