"use client";

import { motion } from "framer-motion";

const steps = [
  { step: 1, title: "Choose Category", desc: "Pick where you want to save — movies, gym, travel & more", icon: "🎯" },
  { step: 2, title: "Join Matching Pool", desc: "Get automatically matched with people nearby", icon: "🔗" },
  { step: 3, title: "Get Matched", desc: "System finds compatible partners based on location", icon: "🤝" },
  { step: 4, title: "Unlock Savings", desc: "Split costs and save together", icon: "💰" },
];

export default function HowItWorks() {
  return (
    <section className="py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h2 className="font-heading text-xl sm:text-2xl text-white mb-2 text-center">
          How It Works
        </h2>
        <p className="text-gray-400 text-sm text-center mb-8">
          Four simple steps to start saving
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center relative group"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-[#D4AF37]/30 to-transparent" />
              )}

              <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center mx-auto mb-3 group-hover:bg-[#D4AF37]/20 group-hover:border-[#D4AF37]/40 transition-all duration-300">
                <span className="text-xl">{step.icon}</span>
              </div>
              <div className="text-[10px] text-[#D4AF37] font-semibold mb-1">
                Step {step.step}
              </div>
              <h3 className="text-white font-medium text-sm mb-1">{step.title}</h3>
              <p className="text-[10px] text-gray-400">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}