"use client";

import { motion } from "framer-motion";

const items = [
  { icon: "✓", title: "Verified Users", desc: "OTP-authenticated real people" },
  { icon: "💳", title: "Secure Payments", desc: "Encrypted transactions" },
  { icon: "🎯", title: "Smart Matching", desc: "Compatibility-based matches" },
  { icon: "🔒", title: "Privacy Protected", desc: "Your data stays secure" },
];

export default function TrustIndicators() {
  return (
    <section className="py-14 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-heading text-2xl sm:text-3xl text-white mb-2">
            Built on Trust
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Every partnership starts with verified, secure, and smart matching.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex flex-col items-center text-center gap-3 p-6 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#D4AF37]/20 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">{item.icon}</span>
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">{item.title}</h3>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}