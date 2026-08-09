"use client";

import { motion } from "framer-motion";

const steps = [
  { step: 1, title: "Choose what you need", desc: "Pick a category — gym, movies, travel, subscriptions and more", icon: "🎯" },
  { step: 2, title: "Find compatible partners", desc: "Discover trusted people nearby with shared goals", icon: "🔍" },
  { step: 3, title: "Get matched", desc: "Our smart system pairs you with the right partners", icon: "🤝" },
  { step: 4, title: "Split and save", desc: "Share costs and unlock group savings together", icon: "💰" },
];

export default function HowItWorks() {
  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl text-white mb-2">
            How PartnerSync Works
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">
            Four simple steps to start saving with trusted partners.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="relative text-center group"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#D4AF37]/30 to-transparent" />
              )}

              <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-4 group-hover:bg-[#D4AF37]/20 group-hover:border-[#D4AF37]/40 transition-all duration-300">
                <span className="text-2xl">{step.icon}</span>
              </div>
              <div className="text-xs text-[#D4AF37] font-semibold mb-1">
                Step {step.step}
              </div>
              <h3 className="text-white font-medium text-sm mb-1">{step.title}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}