"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MarketplaceBusiness } from "@/app/lib/marketplaceManager";

interface BusinessCardProps {
  business: MarketplaceBusiness;
  index: number;
  buttonLabel?: string;
  buttonHref?: string;
  onButtonClick?: (business: MarketplaceBusiness) => void;
  showCollaborate?: boolean;
}

export default function BusinessCard({
  business,
  index,
  buttonLabel = "Make Partner →",
  buttonHref,
  onButtonClick,
  showCollaborate = false,
}: BusinessCardProps) {
  const displayImage = business.image || business.defaultImage;
  const waitingUsers = business.waitingUsers || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -4 }}
    >
      <div className="card-premium block p-5 h-full text-left relative overflow-hidden">
        {/* Business Image */}
        <div className="w-full h-32 rounded-xl overflow-hidden bg-gray-800 mb-4 border border-[#D4AF37]/20">
          <Image
            src={displayImage}
            alt={business.businessName}
            width={300}
            height={128}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Business Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-white font-semibold text-sm truncate">
                {business.businessName}
              </h3>
              {business.verified && (
                <span className="badge-verified text-[8px] px-1.5 py-0.5">
                  ✓ Verified
                </span>
              )}
            </div>
            {business.offerName && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {business.offerName}
              </p>
            )}
            {business.city && (
              <p className="text-[10px] text-gray-500 mt-0.5">
                📍 {business.city}
              </p>
            )}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1 mb-3">
          {business.featured && (
            <span className="text-[8px] text-purple-400 bg-purple-500/10 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
              ⭐ Featured
            </span>
          )}
          {business.officialPartner && (
            <span className="text-[8px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
              👑 Official Partner
            </span>
          )}
          {business.topRated && (
            <span className="text-[8px] text-green-400 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded-full">
              ★ Top Rated
            </span>
          )}
          {business.premium && (
            <span className="text-[8px] text-[#FFD166] bg-[#D4AF37]/10 border border-[#D4AF37]/30 px-1.5 py-0.5 rounded-full">
              ✦ Premium
            </span>
          )}
        </div>

        {/* Waiting Users */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400">
            👥 <span className="text-[#FFD166] font-semibold">{waitingUsers}</span> Members Waiting
          </span>
        </div>

        {/* Description */}
        {business.description && (
          <p className="text-[10px] text-gray-500 mb-3 line-clamp-2">
            {business.description}
          </p>
        )}

        {/* CTA Button */}
        <div className="mt-auto">
          {buttonHref ? (
            <Link
              href={buttonHref}
              className="inline-block w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30"
            >
              {buttonLabel}
            </Link>
          ) : (
            <button
              onClick={() => onButtonClick?.(business)}
              className="w-full text-center py-2.5 rounded-lg text-xs font-bold transition-all duration-300 bg-gradient-to-r from-[#D4AF37]/20 to-[#E6C97A]/10 text-[#FFD166] border border-[#D4AF37]/30 hover:bg-[#D4AF37]/30"
            >
              {buttonLabel}
            </button>
          )}
        </div>

        {/* Gold glow overlay on hover */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 50% 100%, rgba(212, 175, 55, 0.08), transparent 70%)",
          }}
        />
      </div>
    </motion.div>
  );
}