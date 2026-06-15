"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const sections = [
  { id: "collect", title: "1. Information We Collect" },
  { id: "use", title: "2. How We Use Your Data" },
  { id: "protection", title: "3. Data Protection" },
  { id: "otp", title: "4. OTP Verification Security" },
  { id: "payment", title: "5. Payment Information" },
  { id: "thirdparty", title: "6. Third-Party Services" },
  { id: "retention", title: "7. Data Retention" },
  { id: "rights", title: "8. Your Rights" },
  { id: "deletion", title: "9. Account Deletion" },
  { id: "contact", title: "10. Contact Information" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="hero-grid-bg" />
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-3xl sm:text-4xl md:text-5xl text-[#FFD166] mb-4">
            Privacy Policy
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-gray-400 text-sm">
            Last Updated: June 2026
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 inline-block px-4 py-2 bg-[#FFD166]/5 border border-[#FFD166]/20 rounded-full">
            <p className="text-[10px] text-[#FFD166]">Your privacy matters. We never sell your data.</p>
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
          {/* Promise Banner */}
          <div className="border border-green-500/20 rounded-2xl p-6 bg-gradient-to-br from-green-900/10 to-black">
            <h2 className="text-sm font-bold text-green-400 mb-2">🔒 Our Promise</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              We never sell personal information to advertisers or third parties. Your data is used exclusively for matchmaking, security, and platform improvement.
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
              {section.id === "collect" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>When you create an account and use PartnerSync, we collect the following information:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Name</li>
                    <li>Phone Number (verified via OTP)</li>
                    <li>Email Address</li>
                    <li>City, District, and State (for location-based matching)</li>
                    <li>Category Preferences (Gym, Fashion, Movies, etc.)</li>
                    <li>Profile information you voluntarily provide</li>
                  </ul>
                </div>
              )}
              {section.id === "use" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>We use your data for the following purposes:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Matchmaking:</strong> Connect you with compatible partners based on location and category preferences</li>
                    <li><strong>Notifications:</strong> Inform you about match updates, collaborator approvals, and platform announcements</li>
                    <li><strong>Security:</strong> Verify your identity via OTP and prevent fraudulent activity</li>
                    <li><strong>Fraud Prevention:</strong> Detect and prevent fake accounts, duplicate registrations, and abuse</li>
                    <li><strong>Analytics:</strong> Improve our platform, understand usage patterns, and enhance user experience</li>
                  </ul>
                </div>
              )}
              {section.id === "protection" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync implements industry-standard security measures to protect your data:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Encrypted data storage via Firebase (Google Cloud infrastructure)</li>
                    <li>Secure OTP-based authentication</li>
                    <li>Firebase Security Rules restricting unauthorized access</li>
                    <li>Regular security audits and monitoring</li>
                    <li>Strict access controls for admin personnel</li>
                  </ul>
                </div>
              )}
              {section.id === "otp" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>OTP (One-Time Password) verification is used to authenticate your phone number. OTPs are sent via SMS through Firebase Authentication. We never share your OTP codes with any third party.</p>
                  <p className="mt-2 text-yellow-400">⚠️ Never share your OTP with anyone. PartnerSync will never ask for your OTP outside of the login process.</p>
                </div>
              )}
              {section.id === "payment" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>All payments on PartnerSync are processed through Razorpay, a PCI-DSS compliant payment gateway. PartnerSync does not store, process, or have access to your complete payment card information.</p>
                  <p>Payment records (transaction ID, amount, date) are stored for reconciliation and support purposes only.</p>
                </div>
              )}
              {section.id === "thirdparty" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>PartnerSync uses the following third-party services to operate:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Firebase (Google):</strong> Authentication, database, storage, and hosting</li>
                    <li><strong>Razorpay:</strong> Payment processing</li>
                    <li><strong>Vercel/Netlify:</strong> Web hosting and deployment</li>
                  </ul>
                  <p className="mt-2">Each third-party service has its own privacy policy and data handling practices. PartnerSync ensures all vendors comply with applicable data protection regulations.</p>
                </div>
              )}
              {section.id === "retention" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>We retain your data for as long as your account is active. Inactive accounts may be retained for up to 12 months before permanent deletion for fraud prevention purposes.</p>
                </div>
              )}
              {section.id === "rights" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>You have the right to:</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Access the personal data we hold about you</li>
                    <li>Request correction of inaccurate data</li>
                    <li>Request deletion of your account and associated data</li>
                    <li>Withdraw consent for data processing</li>
                    <li>Export your data in a portable format</li>
                  </ul>
                </div>
              )}
              {section.id === "deletion" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>To request account deletion:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Send an email to <span className="text-[#FFD166]">support@partnersync.in</span> from your registered email address</li>
                    <li>Include your registered phone number for verification</li>
                    <li>We will process your request within 3-7 business days</li>
                    <li>You will receive a confirmation once deletion is complete</li>
                  </ol>
                  <p className="mt-2 text-gray-500">Note: Some data may be retained for legal or fraud prevention purposes as required by applicable law.</p>
                </div>
              )}
              {section.id === "contact" && (
                <div className="space-y-2 text-xs text-gray-400 leading-relaxed">
                  <p>For privacy-related inquiries, contact us at:</p>
                  <p className="text-[#FFD166]">support@partnersync.in</p>
                  <p>Vijayawada, Andhra Pradesh, India</p>
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