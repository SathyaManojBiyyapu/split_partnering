"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const trustItems = [
  {
    icon: "🛡️",
    title: "OTP Verified Users",
    desc: "Every user is verified via One-Time Password (OTP) sent to their registered phone number. This ensures all accounts are linked to real, active phone numbers.",
  },
  {
    icon: "🔒",
    title: "Privacy Protection",
    desc: "Your identity remains hidden until you choose to unlock a match. We never share personal information without your explicit consent.",
  },
  {
    icon: "💳",
    title: "Secure Payments",
    desc: "All payments are processed through Razorpay, a PCI-DSS compliant payment gateway. We do not store or process your complete payment card information.",
  },
  {
    icon: "⭐",
    title: "Verified Partners",
    desc: "Collaborator businesses go through an admin approval process. Each approved collaborator displays verification badges: ✓ Verified, ✓✓ Trusted Partner, or 👑 Premium Partner.",
  },
  {
    icon: "📍",
    title: "Location Based Matching",
    desc: "Our matching algorithm prioritizes partners in your city, district, and state. This ensures relevant, nearby connections for meaningful collaborations.",
  },
  {
    icon: "🚫",
    title: "Fraud Prevention",
    desc: "We employ fraud detection systems to identify and prevent fake accounts, duplicate registrations, and suspicious activity. Fraudulent accounts are permanently suspended.",
  },
  {
    icon: "📋",
    title: "Clear Policies",
    desc: "Our Terms & Conditions, Privacy Policy, and Refund Policy are transparent and accessible. PartnerSync does not guarantee business outcomes or financial results.",
  },
  {
    icon: "📧",
    title: "User Support",
    desc: "Our support team is available via email at support@partnersync.in. We respond to all inquiries within 24 hours during business days.",
  },
];

export default function TrustSafetyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            Trust & Safety
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm sm:text-base max-w-2xl mx-auto">
            Your safety and privacy are our top priorities. Learn how PartnerSync keeps your data secure.
          </motion.p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {trustItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c] hover:border-[#FFD166]/20 transition"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <h3 className="text-sm font-bold text-[#FFD166] mb-1">{item.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Report an Issue */}
      <section className="px-4 pb-20">
        <div className="max-w-lg mx-auto text-center">
          <div className="border border-[#FFD166]/20 rounded-2xl p-8 bg-gradient-to-br from-[#0e0e0e] to-black">
            <h2 className="text-lg font-semibold text-[#FFD166] mb-2">Report a Concern</h2>
            <p className="text-sm text-gray-400 mb-6">If you encounter suspicious behavior or have a safety concern, please contact us immediately.</p>
            <a
              href="mailto:support@partnersync.in"
              className="inline-block px-6 py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm hover:scale-105 transition"
            >
              Report Now
            </a>
          </div>
        </div>
      </section>

      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">← Back to Home</Link>
      </div>
    </div>
  );
}