"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const sections = [
  { id: "about", title: "1. About PartnerSync" },
  { id: "eligibility", title: "2. User Eligibility" },
  { id: "account", title: "3. Account Registration" },
  { id: "otp", title: "4. OTP Verification" },
  { id: "fee", title: "5. Match Unlock Fee (₹29)" },
  { id: "collaborators", title: "6. Collaborator Listings" },
  { id: "responsibilities", title: "7. User Responsibilities" },
  { id: "prohibited", title: "8. Prohibited Activities" },
  { id: "fraud", title: "9. Fraud Prevention" },
  { id: "availability", title: "10. Platform Availability" },
  { id: "intellectual", title: "11. Intellectual Property" },
  { id: "liability", title: "12. Limitation of Liability" },
  { id: "suspension", title: "13. Account Suspension" },
  { id: "changes", title: "14. Changes to Terms" },
  { id: "contact", title: "15. Contact Information" },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            Terms & Conditions
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm">
            Last Updated: June 2026
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 inline-block px-4 py-2 bg-[#FFD166]/5 border border-[#FFD166]/20 rounded-full">
            <p className="text-[10px] text-[#FFD166]">By using PartnerSync you agree to these policies.</p>
          </motion.div>
        </div>
      </section>

      {/* Section Navigation */}
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

      {/* Content */}
      <section className="px-4 pb-20">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* Important Notice */}
          <div className="border border-[#FFD166]/20 rounded-2xl p-6 bg-gradient-to-br from-[#0e0e0e] to-black">
            <h2 className="text-sm font-bold text-[#FFD166] mb-3">⚠️ Important Notice</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              PartnerSync facilitates introductions and collaborations between users and approved collaborators. 
              PartnerSync does not guarantee business outcomes, savings, purchases, partnerships, or financial results. 
              All final decisions and agreements are the sole responsibility of the users and collaborators involved.
            </p>
          </div>

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
              {section.id === "about" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync is a trust-based collaboration platform that connects users with verified partners and approved collaborators. We enable cost-sharing, resource pooling, and reliable collaboration.</p>
                  <p>We do not own, operate, or sell products or services related to gyms, travel, hotels, events, books, fashion, villas, or coupons. We are a matching and introduction platform only.</p>
                </div>
              )}
              {section.id === "eligibility" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>You must be at least 18 years of age to use PartnerSync. By creating an account, you confirm that you are 18 years or older and capable of entering into legally binding agreements.</p>
                </div>
              )}
              {section.id === "account" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your account and OTP credentials.</p>
                </div>
              )}
              {section.id === "otp" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>OTP verification is required to authenticate your identity. You agree not to share OTP codes with anyone. PartnerSync will never ask for your OTP outside of the login process.</p>
                </div>
              )}
              {section.id === "fee" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync charges a non-refundable platform access fee of ₹29 (Indian Rupees) to unlock verified match details. This fee is for accessing the platform's matching service, not for any product or service from third-party collaborators.</p>
                  <p>All payments are processed securely through Razorpay. PartnerSync does not store or process payment card information directly.</p>
                </div>
              )}
              {section.id === "collaborators" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>Collaborators are independent third-party businesses that have been approved by PartnerSync's admin team. PartnerSync does not endorse, guarantee, or take responsibility for any transactions, agreements, or interactions between users and collaborators.</p>
                  <p>Users are responsible for conducting their own due diligence before entering into any agreement with a collaborator.</p>
                </div>
              )}
              {section.id === "responsibilities" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>As a user, you agree to: (a) Use the platform for lawful purposes only; (b) Treat other users and collaborators with respect; (c) Provide accurate information; (d) Not misuse the platform for spam, fraud, or harassment.</p>
                </div>
              )}
              {section.id === "prohibited" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>You may not: (a) Create fake accounts; (b) Manipulate match results; (c) Use the platform for unauthorized commercial purposes; (d) Harass or threaten other users; (e) Attempt to bypass security or payment systems.</p>
                </div>
              )}
              {section.id === "fraud" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync employs fraud detection systems. Accounts found engaging in fraudulent activity will be permanently suspended without refund. Fraud includes but is not limited to fake profiles, payment chargebacks, and identity theft.</p>
                </div>
              )}
              {section.id === "availability" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync strives for 99.9% uptime but does not guarantee uninterrupted service. We may perform maintenance, updates, or experience downtime beyond our control. We are not liable for any losses resulting from platform unavailability.</p>
                </div>
              )}
              {section.id === "intellectual" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>All content, trademarks, logos, and intellectual property displayed on PartnerSync are the property of PartnerSync or their respective owners. You may not reproduce, distribute, or create derivative works without explicit permission.</p>
                </div>
              )}
              {section.id === "liability" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync is provided "as is" without warranties of any kind. To the maximum extent permitted by law, PartnerSync shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform.</p>
                  <p>PartnerSync's total liability is limited to the amount you paid (₹29) for the specific service in question.</p>
                </div>
              )}
              {section.id === "suspension" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync reserves the right to suspend or terminate accounts that violate these terms, engage in prohibited activities, or pose a risk to the platform or its users. Suspended accounts are not eligible for refunds.</p>
                </div>
              )}
              {section.id === "changes" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync may update these terms at any time. Users will be notified of material changes via email or platform notification. Continued use after changes constitutes acceptance of the updated terms.</p>
                </div>
              )}
              {section.id === "contact" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>For questions about these terms, contact us at:</p>
                  <p className="text-[#FFD166]">support@partnersync.in</p>
                  <p>Vijayawada, Andhra Pradesh, India</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Back */}
      <div className="px-4 pb-8 text-center">
        <Link href="/" className="text-[#FFD166] hover:underline text-xs">← Back to Home</Link>
      </div>
    </div>
  );
}