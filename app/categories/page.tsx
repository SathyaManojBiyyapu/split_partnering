"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { db } from "@/firebase/config";
import { collection, onSnapshot, getDocs, getDoc, doc } from "firebase/firestore";

const categories = [
  { name: "Gym", slug: "gym", image: "/gym.webp", subtitle: "Shared memberships" },
  { name: "Fashion", slug: "fashion", image: "/fashion.webp", subtitle: "Group shopping deals" },
  { name: "Movies", slug: "movies", image: "/movies.webp", subtitle: "Movie ticket partnerships" },
  { name: "Lenskart", slug: "lenskart", image: "/lenskart.png", subtitle: "Eyewear savings" },
  { name: "Local Travel", slug: "local-travel", image: "/travel.webp", subtitle: "Ride sharing" },
  { name: "Events", slug: "events", image: "/events.webp", subtitle: "Group event access" },
  { name: "Coupons", slug: "coupons", image: "/coupons.webp", subtitle: "Daily deals" },
  { name: "Villas", slug: "villas", image: "/villas.webp", subtitle: "Shared stays" },
  { name: "Books", slug: "books", image: "/books.webp", subtitle: "Shared learning" },
];

export default function CategoriesPage() {
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
    setPhone(raw?.trim() || null);
  }, []);

  /* Fetch group counts per category */
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "groups"), (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const cat = data.category;
        if (cat) {
          counts[cat] = (counts[cat] || 0) + 1;
        }
      });
      setGroupCounts(counts);
    });
    return () => unsub();
  }, []);

  /* Fetch user's active groups */
  useEffect(() => {
    if (!phone) return;
    const unsub = onSnapshot(collection(db, "groups"), (snapshot) => {
      const userCats: string[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const members = Array.isArray(data.members) ? data.members : [];
        const hasUser = members.some((m: any) => {
          if (typeof m === "string") return m.trim() === phone;
          return m?.phone?.trim() === phone;
        });
        const hasUID = Array.isArray(data.memberUIDs) && data.memberUIDs.includes(phone);
        if (hasUser || hasUID) {
          if (data.category && !userCats.includes(data.category)) {
            userCats.push(data.category);
          }
        }
      });
      setUserGroups(userCats);
    });
    return () => unsub();
  }, [phone]);

  return (
    <main className="min-h-screen pt-28 pb-32 px-4 sm:px-6 bg-black text-center">
      {/* ===== HEADING ===== */}
      <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl mb-3 text-[#FFD166] leading-tight">
        Find People Near You.
        <br />
        <span className="text-[#E6C97A]">Split Costs. Save Money.</span>
      </h1>

      <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-10 px-2">
        Join people in your city and reduce costs through trusted partnerships and group savings.
      </p>

      {/* ===== CATEGORY GRID ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {categories.map((cat) => {
          const isActive = userGroups.includes(cat.name);
          const groupCount = groupCounts[cat.name] || 0;

          return (
            <a
              key={cat.slug}
              href={`/options/${cat.slug}`}
              className="
                group relative block overflow-hidden rounded-2xl
                h-56 sm:h-64
                transition-all duration-300
                hover:scale-[1.03]
                hover:shadow-[0_0_28px_rgba(255,209,102,0.35)]
                focus:outline-none
              "
            >
              {/* Background Image */}
              <Image
                src={cat.image}
                alt={cat.name}
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />

              {/* Dark Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/40 group-hover:from-black/70 group-hover:via-black/45 group-hover:to-black/30 transition-all duration-300"></div>

              {/* Content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-5">
                <h2 className="font-heading text-xl sm:text-2xl text-[#FFD166] font-bold mb-1.5 transition-transform duration-300 group-hover:scale-105">
                  {cat.name}
                </h2>

                <p className="text-xs text-gray-300 mb-3">
                  {cat.subtitle}
                </p>

                {/* Active Group Count */}
                <span className="text-[10px] text-gray-400 bg-black/50 px-2.5 py-0.5 rounded-full">
                  {groupCount > 0 ? `${groupCount} Active Group${groupCount !== 1 ? "s" : ""}` : "No groups yet"}
                </span>

                {/* Active Match Indicator */}
                {isActive && (
                  <span className="mt-2 text-[10px] text-green-400 bg-green-900/50 px-2.5 py-0.5 rounded-full border border-green-500/30">
                    ● Match Running
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </main>
  );
}