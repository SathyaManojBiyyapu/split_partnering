"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { db } from "@/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "@/firebase/config";
import { onAuthStateChanged } from "firebase/auth";

export default function TrustAndSafetyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawPhone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
    setPhone(rawPhone?.trim() || null);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    const fetchProfile = async () => {
      try {
        const snap = await getDoc(doc(db, "users", phone));
        if (snap.exists()) setProfile(snap.data() as any);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchProfile();
  }, [phone]);

  const isPhoneVerified = !!user?.phoneNumber || !!profile?.verified;
  const isGoogleVerified = user?.providerData?.some((p: any) => p.providerId === "google.com");
  const hasPaymentVerified = !!profile?.paymentVerified;

  const trustItems = [
    { icon: "📱", label: "Phone Verified", status: isPhoneVerified },
    { icon: "🔑", label: "Google Verified", status: !!isGoogleVerified },
    { icon: "💳", label: "Payment Verified", status: !!hasPaymentVerified },
    { icon: "⭐", label: "Partner Rating", status: false, note: "Coming soon" },
    { icon: "🛡️", label: "Secure Payment", status: true },
  ];

  const safetyTips = [
    "Only share personal contact details after a successful match.",
    "Never make upfront payments outside the platform.",
    "Meet in public places for first interactions.",
    "Trust your instincts — report suspicious behavior immediately.",
  ];

  if (loading) {
    return (
      <div className="min-h-screen pt-28 px-6 flex items-center justify-center text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 px-4 sm:px-6 max-w-4xl mx-auto text-white pb-mobile-cta">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl sm:text-4xl font-bold text-[#FFD166]">Trust & Safety</h1>
        <p className="text-gray-400 text-sm mt-2">
          Your safety is our priority. Here's how we keep the community secure.
        </p>
      </motion.div>

      {/* Trust Profile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-premium p-6 mb-8"
      >
        <h2 className="text-lg font-semibold text-white mb-4">Your Trust Profile</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {trustItems.map((item, i) => (
            <div
              key={item.label}
              className={`p-4 rounded-xl border flex items-center gap-3 ${
                item.status
                  ? "bg-green-500/5 border-green-500/20"
                  : "bg-white/[0.02] border-white/10"
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-sm font-medium text-white">{item.label}</p>
                {item.status ? (
                  <p className="text-xs text-green-400">✓ Active</p>
                ) : (
                  <p className="text-xs text-gray-500">{item.note || "Not verified"}</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-500 mt-4">
          Verification badges reflect actual authentication. Some verifications will be available soon.
        </p>
      </motion.div>

      {/* Safety Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="card-premium p-6 mb-8"
      >
        <h2 className="text-lg font-semibold text-white mb-4">🛡️ Safety Guidelines</h2>
        <ul className="space-y-3">
          {safetyTips.map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="text-[#D4AF37] mt-0.5">•</span>
              {tip}
            </li>
          ))}
        </ul>
        <div className="mt-6 bg-[#D4AF37]/10 border border-[#D4AF37]/20 rounded-xl p-4">
          <p className="text-xs text-[#D4AF37] font-medium mb-1">🔒 Important</p>
          <p className="text-xs text-gray-400">
            Only share personal contact details after a successful match. The platform keeps your identity masked until a connection is confirmed.
          </p>
        </div>
      </motion.div>

      {/* Report & Block */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card-premium p-6 mb-8"
      >
        <h2 className="text-lg font-semibold text-white mb-4">🚩 Report & Block</h2>
        <p className="text-sm text-gray-400 mb-4">
          If you encounter suspicious behavior, report it immediately. Our team reviews every report.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push("/contact")}
            className="px-5 py-2.5 rounded-xl bg-red-600/15 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/25 transition"
          >
            Report a User
          </button>
          <button
            onClick={() => router.push("/contact")}
            className="px-5 py-2.5 rounded-xl bg-yellow-600/15 border border-yellow-500/30 text-yellow-400 text-sm font-semibold hover:bg-yellow-600/25 transition"
          >
            Report a Group
          </button>
          <button
            onClick={() => router.push("/contact")}
            className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/20 text-gray-300 text-sm font-semibold hover:bg-white/10 transition"
          >
            Help & Support
          </button>
        </div>
      </motion.div>

      {/* Block List placeholder */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="card-premium p-6"
      >
        <h2 className="text-lg font-semibold text-white mb-2">Blocked Users</h2>
        <p className="text-sm text-gray-400 mb-4">
          Blocked users will be hidden from your matches and unable to contact you.
        </p>
        <div className="border border-dashed border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No blocked users yet.</p>
          <p className="text-gray-600 text-xs mt-1">
            Block management will be available once you have active matches.
          </p>
        </div>
      </motion.div>
    </div>
  );
}