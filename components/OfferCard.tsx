"use client";

import { useState } from "react";
import Link from "next/link";

type Offer = {
  slug: string;
  title: string;
  description: string;
  priceText?: string;
};

export default function OfferCard({ offer }: { offer: Offer }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="group rounded-2xl border border-[#16FF6E]/40 bg-gradient-to-br from-[#03170e] to-black p-[1px] shadow-[0_0_20px_rgba(22,255,110,0.2)] transition hover:border-[#16FF6E]"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex h-full flex-col justify-between rounded-2xl bg-black/90 p-4">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-[#16FF6E]">
            {offer.title}
          </h3>
          <p className="mt-2 text-xs text-gray-300">{offer.description}</p>
          {offer.priceText && (
            <p className="mt-1 text-xs text-[#16FF6E]/80">{offer.priceText}</p>
          )}
        </div>

        {/* Swipe / CTA row */}
        <div className="mt-4 flex items-center justify-between">
          <div className="relative h-9 w-32 rounded-full bg-[#042414] border border-[#16FF6E]/40 overflow-hidden flex items-center px-2 text-[10px] text-gray-200">
            <span className="mr-1 text-[11px] text-[#16FF6E]">2+</span>
            <span className="truncate">Drag to request</span>
            <div
              className={`absolute top-[2px] h-[26px] w-[26px] rounded-full bg-[#16FF6E] shadow-[0_0_15px_#16FF6E] transition-transform ${
                hover ? "translate-x-[72px]" : "translate-x-0"
              }`}
            >
              <span className="flex h-full w-full items-center justify-center text-xs text-black">
                →
              </span>
            </div>
          </div>

          <Link
            href={`/offer/${offer.slug}`}
            className="text-[11px] text-[#16FF6E] underline underline-offset-2 hover:text-[#a9ffd0]"
          >
            Details
          </Link>
        </div>
      </div>
    </div>
  );
}
