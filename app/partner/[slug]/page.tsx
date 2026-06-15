"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";
import Link from "next/link";
import { motion } from "framer-motion";

export default function PartnerProfilePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [partner, setPartner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const q = query(
      collection(db, "collaborators"),
      where("__name__", "==", slug)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setPartner({ id: snapshot.docs[0].id, ...data });
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsub();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
        <h1 className="text-3xl font-semibold text-[#FFD166]">Partner not found</h1>
        <Link href="/categories" className="text-[#FFD166] hover:underline mt-4 inline-block">
          ← Back to Categories
        </Link>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-mobile-cta">
      <div className="max-w-2xl mx-auto px-4 pt-28 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-premium p-6 sm:p-8"
        >
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/20 flex items-center justify-center text-2xl">
              🏪
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-white">
                  {partner.option || partner.businessName}
                </h1>
                {(partner.status === "approved" || partner.status === "featured") && (
                  <span className="text-[10px] bg-green-500/10 border border-green-500/30 text-green-400 px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified PartnerSync Collaborator
                  </span>
                )}
              </div>
              {partner.businessName && partner.businessName !== partner.option && (
                <p className="text-sm text-gray-400 mt-1">{partner.businessName}</p>
              )}
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Category</p>
              <p className="text-white font-medium">{partner.category}</p>
            </div>
            <div className="bg-black/40 rounded-xl p-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Subcategory</p>
              <p className="text-white font-medium">{partner.subcategory}</p>
            </div>
            {partner.city && (
              <div className="bg-black/40 rounded-xl p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Location</p>
                <p className="text-white font-medium">{partner.city}{partner.district ? `, ${partner.district}` : ""}</p>
              </div>
            )}
            {partner.website && (
              <div className="bg-black/40 rounded-xl p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Website</p>
                <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-[#FFD166] hover:underline text-sm break-all">
                  {partner.website}
                </a>
              </div>
            )}
          </div>

          {/* Description */}
          {partner.description && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[#FFD166] mb-2">About</h3>
              <p className="text-gray-300 text-sm">{partner.description}</p>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/save?category=${partner.category?.toLowerCase().replace(/\s+/g, "-")}&option=${partner.option}`}
            className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm hover:scale-[1.02] transition"
          >
            Partner with {partner.option || "this business"} →
          </Link>
        </motion.div>

        <div className="mt-6 text-center">
          <Link href="/categories" className="text-[#FFD166] hover:underline text-xs">
            ← Back to Categories
          </Link>
        </div>
      </div>
    </main>
  );
}