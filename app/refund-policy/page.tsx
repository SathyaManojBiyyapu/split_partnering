"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const sections = [
  { id: "overview", title: "1. Overview" },
  { id: "fee", title: "2. Platform Access Fee" },
  { id: "refund-eligible", title: "3. Refund Eligible" },
  { id: "refund-not-eligible", title: "4. Refund Not Eligible" },
  { id: "process", title: "5. Refund Request Process" },
  { id: "timeline", title: "6. Review & Processing Timeline" },
  { id: "contact", title: "7. Contact Information" },
];

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            Refund & Cancellation Policy
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm">
            Last Updated: June 2026
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 inline-block px-4 py-2 bg-[#FFD166]/5 border border-[#FFD166]/20 rounded-full">
            <p className="text-[10px] text-[#FFD166]">Clear and transparent refund policy</p>
          </motion.div>
        </div>
      </section>

      <section className="px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="border border-[#FFD166]/10 rounded-xl p-4 bg-[#0c0c0c]">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Jump to Section</p>
            <div className="flex flex-wrap gap-2">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="text-[10px] text-[#FFD166] hover:underline px-2 py-1 bg-black/40 rounded">
                  {s.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto space-y-8">
          {sections.map((section, i) => (
            <motion.div
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-[#FFD166]/10 rounded-xl p-5 bg-[#0c0c0c]"
            >
              <h2 className="text-base font-bold text-[#FFD166] mb-3">{section.title}</h2>
              
              {section.id === "overview" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync is a trust-based collaboration platform that connects users with verified partners and approved collaborators. We facilitate introductions and enable cost-sharing opportunities.</p>
                  <p className="mt-2">The ₹29 platform access fee is charged to unlock verified match details. This fee covers the cost of operating the platform, verification processes, and matchmaking technology.</p>
                </div>
              )}

              {section.id === "fee" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync charges a non-refundable platform access fee of ₹29 (Indian Rupees) for unlocking verified match details. This is a one-time fee per match unlock.</p>
                  <p className="mt-2 text-[#FFD166]">This fee is for accessing the platform's matching and verification service, not for any product, service, or guarantee of outcomes from third-party collaborators or users.</p>
                </div>
              )}

              {section.id === "refund-eligible" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p className="text-green-400 font-medium mb-2">✅ You are eligible for a refund in the following cases:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span><strong>Duplicate Payment:</strong> If you were charged more than once for the same match unlock</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span><strong>Technical Failure:</strong> If payment was deducted but the service was not delivered due to a platform error</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">•</span>
                      <span><strong>Service Not Delivered:</strong> If payment was deducted but match details were not unlocked successfully</span>
                    </li>
                  </ul>
                </div>
              )}

              {section.id === "refund-not-eligible" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p className="text-red-400 font-medium mb-2">❌ Refunds are NOT provided in the following cases:</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>User changes their mind after unlocking a match</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>User does not like the match results or compatibility</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>User becomes inactive or fails to respond</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>User fails to contact the matched partner</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Collaborator or user declines to proceed with collaboration</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>User expected guaranteed outcomes, savings, or business results</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Match expiry (10-day period has passed)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>Account suspension due to violation of Terms & Conditions</span>
                    </li>
                  </ul>
                </div>
              )}

              {section.id === "process" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>To request a refund:</p>
                  <ol className="list-decimal pl-4 space-y-2 mt-2">
                    <li>Send an email to <span className="text-[#FFD166]">support@partnersync.in</span> with the subject line "Refund Request"</li>
                    <li>Include your registered phone number and transaction ID</li>
                    <li>Provide a brief explanation of the issue</li>
                    <li>Attach any relevant screenshots or payment receipts</li>
                  </ol>
                </div>
              )}

              {section.id === "timeline" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-blue-400 text-lg">⏱</span>
                      <div>
                        <p className="text-blue-400 font-medium text-sm">Review Period</p>
                        <p className="text-gray-400">3–7 business days</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 text-lg">💰</span>
                      <div>
                        <p className="text-green-400 font-medium text-sm">Processing Time</p>
                        <p className="text-gray-400">5–10 business days after approval</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3">Refunds, when approved, will be processed to the original payment method used during the transaction.</p>
                </div>
              )}

              {section.id === "contact" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>For all refund-related inquiries:</p>
                  <p className="text-[#FFD166]">support@partnersync.in</p>
                  <p>Vijayawada, Andhra Pradesh, India</p>
                  <p className="mt-2 text-gray-500">We aim to respond to all refund inquiries within 24 hours during business days.</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">← Back to Home</Link>
      </div>
    </div>
  );
}