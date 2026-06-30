"use client";

import { motion } from "framer-motion";

const items = [
  { icon: "✓", title: "Verified Users", desc: "OTP-authenticated real people" },
  { icon: "🔒", title: "Privacy Protected", desc: "Your data stays secure" },
  { icon: "💳", title: "Secure Payments", desc: "Encrypted transactions" },
  { icon: "📍", title: "Location Matching", desc: "Find partners near you" },
];

export default function TrustIndicators() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-base">{item.icon}</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}