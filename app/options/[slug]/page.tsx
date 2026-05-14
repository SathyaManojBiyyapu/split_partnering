"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { partneringInfo } from "@/app/data/partneringInfo";

/* ---------------- CATEGORY OPTIONS ---------------- */

const categoryOptions: Record<
  string,
  { name: string; slug: string; description: string; emoji: string }[]
> = {
  gym: [
    { name: "Split Membership", slug: "split", description: "Partner to share a gym membership", emoji: "💪" },
    { name: "Day Pass", slug: "pass", description: "Partner for one-day gym access", emoji: "🎫" },
    { name: "Supplements", slug: "supplements", description: "Form a group to access bulk benefits", emoji: "💊" },
  ],

  fashion: [
    { name: "Peter England", slug: "peter-england", description: "Partner shopping for brand offers", emoji: "👔" },
    { name: "Louis Philippe", slug: "louis-philippe", description: "Partner shopping for brand offers", emoji: "👔" },
    { name: "Unlimited", slug: "unlimited", description: "Group shopping benefits", emoji: "👗" },
    { name: "Trends", slug: "trends", description: "Group shopping benefits", emoji: "👕" },
    { name: "Wrogn", slug: "wrogn", description: "Group shopping benefits", emoji: "👕" },
    { name: "Wildcraft", slug: "wildcraft", description: "Group shopping benefits", emoji: "🎒" },
    { name: "Zara", slug: "zara", description: "Partner shopping for brand offers", emoji: "👗" },
    { name: "H&M", slug: "hm", description: "Partner shopping for brand offers", emoji: "👕" },
    { name: "Nike", slug: "nike", description: "Partner shopping for brand offers", emoji: "👟" },
    { name: "Adidas", slug: "adidas", description: "Partner shopping for brand offers", emoji: "👟" },
  ],

  movies: [
    { name: "Save Ticket", slug: "save-ticket", description: "Sell or find movie tickets", emoji: "🎬" },
    { name: "Bulk Ticket", slug: "bulk-ticket", description: "Form a group for booking benefits", emoji: "🎫" },
  ],

  /* ======= ADDED (NO LOGIC CHANGE) ======= */

  lenskart: [
    { name: "Eyeglasses", slug: "eyeglasses", description: "Partner to save on eyeglasses", emoji: "👓" },
  ],

  "local-travel": [
    { name: "Cab Sharing", slug: "cab", description: "Split local travel cost", emoji: "🚗" },
  ],

  events: [
    { name: "Event Passes", slug: "passes", description: "Group booking for events", emoji: "🎤" },
  ],

  coupons: [
    { name: "Discount Coupons", slug: "discounts", description: "Share and use coupons", emoji: "🎟️" },
  ],

  villas: [
    { name: "Weekend Stay", slug: "weekend", description: "Split villa stay cost", emoji: "🏡" },
  ],

  books: [
    { name: "Academic Books", slug: "academic", description: "Share or buy books together", emoji: "📚" },
  ],
};

const categoryNames: Record<string, string> = {
  gym: "Gym",
  fashion: "Fashion",
  movies: "Movies",

  /* ======= ADDED (NO LOGIC CHANGE) ======= */
  lenskart: "Lenskart",
  "local-travel": "Local Travel",
  events: "Events",
  coupons: "Coupons",
  villas: "Villas",
  books: "Books",
};

/* ---------------- PAGE ---------------- */

export default function OptionsPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const options = categoryOptions[slug] || [];
  const categoryName = categoryNames[slug] || slug.replace("-", " ");
  const info = partneringInfo[slug];

  return (
    <div className="min-h-screen pt-32 px-6 bg-black text-[#F5F5F5]">
      {/* HEADER */}
      <h1 className="text-3xl font-semibold text-[#FFD166] tracking-wide mb-2">
        {categoryName}
      </h1>
      <p className="text-gray-400 mb-10 text-sm">
        Choose an option to continue
      </p>

      {/* OPTIONS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {options.map((option) => {
          const makePartnerSupported = Boolean(
            partneringInfo?.[slug]?.makePartner
          );

          const finalHref = makePartnerSupported
            ? `/make-partner?category=${slug}&option=${option.slug}`
            : `/save?category=${slug}&option=${option.slug}`;

          /* 🎬 SPECIAL CASE: MOVIES → SAVE TICKET */
          if (slug === "movies" && option.slug === "save-ticket") {
            return (
              <div key={option.slug} className="p-6 rounded-2xl border border-[#FFD166]/30 bg-black">
                <div className="text-4xl mb-3">{option.emoji}</div>
                <h2 className="text-lg font-semibold text-[#FFD166] mb-2">
                  {option.name}
                </h2>
                <p className="text-sm text-gray-400 mb-6">
                  {option.description}
                </p>

                <div className="flex flex-col gap-4">
                  <Link href="/movies/trade-ticket">🎟️ Trade Tickets</Link>
                  <Link href="/movies/available-tickets">👀 Available Tickets</Link>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={option.slug}
              href={finalHref}
              className="p-6 rounded-2xl border border-[#FFD166]/30 bg-black hover:border-[#FFD166]"
            >
              <div className="text-4xl mb-3">{option.emoji}</div>
              <h2 className="text-lg font-semibold text-[#FFD166] mb-2">
                {option.name}
              </h2>
              <p className="text-sm text-gray-400">
                {option.description}
              </p>
            </Link>
          );
        })}
      </div>

      {/* BACK */}
      <div className="mt-14 text-center">
        <Link href="/categories" className="text-[#FFD166] hover:underline">
          ← Back to Categories
        </Link>
      </div>
    </div>
  );
}
