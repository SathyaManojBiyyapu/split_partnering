"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText("support@partnersync.in");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            Contact Us
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            We are here to help. Reach out via email, WhatsApp, or visit us in Vijayawada.
          </motion.p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="border border-[#FFD166]/10 rounded-xl p-6 bg-[#0c0c0c]"
            >
              <span className="text-3xl mb-3 block">📧</span>
              <h3 className="text-sm font-bold text-[#FFD166] mb-2">Email Support</h3>
              <p className="text-xs text-gray-400 mb-3">Our team responds within 24 hours during business days.</p>
              <button onClick={copyEmail} className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-gray-700 hover:border-[#FFD166]/30 transition text-xs text-gray-300 text-left flex items-center justify-between">
                <span className="text-[#FFD166] font-medium">support@partnersync.in</span>
                <span className="text-[9px] text-gray-500">{copied ? "✓ Copied!" : "Copy"}</span>
              </button>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="border border-[#FFD166]/10 rounded-xl p-6 bg-[#0c0c0c]"
            >
              <span className="text-3xl mb-3 block">💬</span>
              <h3 className="text-sm font-bold text-[#FFD166] mb-2">WhatsApp</h3>
              <p className="text-xs text-gray-400 mb-3">Quick support via WhatsApp.</p>
              <a href="https://wa.me/919949658599" target="_blank" rel="noopener noreferrer"
                className="block w-full px-4 py-2.5 rounded-xl bg-black/50 border border-gray-700 hover:border-[#FFD166]/30 transition text-xs text-gray-300 text-left"
              >
                <span className="text-green-400 font-medium">+91 99496 58599</span>
              </a>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="border border-[#FFD166]/10 rounded-xl p-6 bg-[#0c0c0c]"
            >
              <span className="text-3xl mb-3 block">📍</span>
              <h3 className="text-sm font-bold text-[#FFD166] mb-2">Office</h3>
              <p className="text-xs text-gray-400">Vijayawada, Andhra Pradesh, India</p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="border border-[#FFD166]/10 rounded-xl p-6 bg-[#0c0c0c]"
            >
              <span className="text-3xl mb-3 block">❓</span>
              <h3 className="text-sm font-bold text-[#FFD166] mb-2">FAQ</h3>
              <p className="text-xs text-gray-400 mb-3">Find answers to common questions.</p>
              <Link href="/faq" className="block w-full px-4 py-2.5 rounded-xl bg-black/50 border border-gray-700 hover:border-[#FFD166]/30 transition text-xs text-gray-300">
                Visit FAQ →
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Support Hours */}
      <section className="px-4 pb-20">
        <div className="max-w-lg mx-auto text-center">
          <div className="border border-[#FFD166]/20 rounded-2xl p-6 bg-gradient-to-br from-[#0e0e0e] to-black">
            <h2 className="text-sm font-bold text-[#FFD166] mb-2">⏱ Support Hours</h2>
            <p className="text-xs text-gray-400">Monday - Saturday: 10:00 AM - 7:00 PM IST</p>
            <p className="text-xs text-gray-500 mt-1">We respond to all emails within 24 hours</p>
          </div>
        </div>
      </section>

      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">← Back to Home</Link>
      </div>
    </div>
  );
}