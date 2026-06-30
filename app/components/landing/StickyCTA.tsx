"use client";

import Link from "next/link";

export default function StickyCTA() {
  return (
    <div className="sticky-bottom-cta">
      <Link
        href="/categories"
        className="block w-full text-center py-3 rounded-xl font-bold bg-[#D4AF37] text-black text-sm"
      >
        Explore Categories
      </Link>
    </div>
  );
}