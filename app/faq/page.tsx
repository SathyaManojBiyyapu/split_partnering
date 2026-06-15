"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    q: "What is PartnerSync?",
    a: "PartnerSync is a trust-based collaboration platform that connects users with verified partners and approved collaborators. We help you split costs, share resources, and find reliable collaboration partners near you."
  },
  {
    q: "How does PartnerSync work?",
    a: "You choose a category and subcategory that matches your need, find nearby partners or approved collaborators, form a group, and unlock verified match details for a small platform fee of ₹29."
  },
  {
    q: "Is PartnerSync free to use?",
    a: "Browsing categories, searching for partners, and viewing collaborator brands is completely free. A ₹29 platform fee applies only when you want to unlock verified match details."
  },
  {
    q: "What is the ₹29 fee for?",
    a: "The ₹29 fee is a platform access fee that unlocks verified match details, including partner contact information. This ensures serious participants and reduces spam."
  },
  {
    q: "Are collaborators verified?",
    a: "Yes. Every collaborator goes through an admin approval process. Approved collaborators display a verified badge and may have verification levels: ✓ Verified, ✓✓ Trusted Partner, or 👑 Premium Partner."
  },
  {
    q: "How long does a match last?",
    a: "Matches expire after 10 days. You can see the countdown on your My Matches dashboard. Expired matches move to the expired section but are not deleted."
  },
  {
    q: "Is my personal information safe?",
    a: "Absolutely. We use OTP verification, encrypted data storage via Firebase, and never share your personal information without your consent. Your identity remains hidden until payment unlock."
  },
  {
    q: "Can I collaborate with PartnerSync?",
    a: "Yes! Businesses can register as collaborators. Once approved, your brand appears as a verified partner in relevant categories. Visit the Collaborators page to register."
  },
  {
    q: "How do I delete my account?",
    a: "Contact our support team at support@partnersync.in with your registered phone number. We will process your account deletion request within 3-7 business days."
  },
  {
    q: "What if I face a technical issue?",
    a: "Reach out to our support team via email at support@partnersync.in or use the floating support button available on every page. We typically respond within 24 hours."
  }
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4"
          >
            Frequently Asked Questions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto"
          >
            Everything you need to know about PartnerSync
          </motion.p>
        </div>
      </section>

      {/* FAQ List */}
      <section className="px-4 pb-20">
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border border-[#FFD166]/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full text-left px-5 py-4 flex items-center justify-between bg-[#0c0c0c] hover:bg-[#111] transition"
              >
                <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                <span className={`text-[#FFD166] transition-transform duration-300 flex-shrink-0 ${openIndex === index ? "rotate-45" : ""}`}>
                  +
                </span>
              </button>
              <AnimatePresence>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 py-4 border-t border-[#FFD166]/5 bg-black/50">
                      <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Still have questions */}
      <section className="px-4 pb-20">
        <div className="max-w-lg mx-auto text-center">
          <div className="border border-[#FFD166]/20 rounded-2xl p-8 bg-gradient-to-br from-[#0e0e0e] to-black">
            <h2 className="text-lg font-semibold text-[#FFD166] mb-2">Still have questions?</h2>
            <p className="text-sm text-gray-400 mb-6">We are here to help. Reach out to our support team.</p>
            <a
              href="mailto:support@partnersync.in"
              className="inline-block px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm hover:scale-105 transition"
            >
              Contact Support
            </a>
          </div>
        </div>
      </section>

      {/* Back link */}
      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}