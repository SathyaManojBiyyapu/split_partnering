"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/firebase/config";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
} from "firebase/firestore";
import toast from "react-hot-toast";
import {
  computeCompatibility,
  generateUserId,
} from "@/app/data/matchExpiry";
import Seo from "@/app/components/Seo";

type PartnerMatch = {
  uid: string;
  phone: string;
  userId: string;
  name: string;
  city: string;
  district: string;
  state: string;
  photoURL?: string;
  category: string;
  option: string;
  matchTier: number;
  matchLabel: string;
  compatibility: number;
  compatReasons: string[];
  distance?: string;
  joinedDate?: string;
  docId: string;
};

type FilterState = {
  category: string;
  state: string;
  city: string;
  status: string;
  sortBy: string;
};

export default function FindPartnersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [nearbyPartners, setNearbyPartners] = useState<PartnerMatch[]>([]);
  const [startingMatch, setStartingMatch] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    category: "All",
    state: "All",
    city: "All",
    status: "All",
    sortBy: "compatibility",
  });

  const rawPhone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
  const phone = rawPhone?.trim() || null;

  function getMatchTier(partner: any, user: any): { tier: number; label: string } {
    if (!user?.state) return { tier: 5, label: "Other Users" };
    const sameCity = partner.city && user.city && partner.city === user.city;
    const sameState = partner.state && user.state && partner.state === user.state;
    if (sameCity) return { tier: 1, label: "Same City" };
    if (sameState) return { tier: 2, label: "Same State" };
    return { tier: 3, label: "Other" };
  }

  /* ---------- Load user profile + partners (preserves existing matching rules) ---------- */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    const loadPartners = async () => {
      try {
        const userRef = doc(db, "users", phone);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setLoading(false);
          return;
        }
        const me = userSnap.data() as any;
        setUserProfile(me);
        if (!me.state) {
          setLoading(false);
          return;
        }

        const usersSnap = await getDocs(collection(db, "users"));
        const groupsSnap = await getDocs(collection(db, "groups"));

        // Build group category/option lookup (same as dashboard)
        const userGroupCategory: Record<string, { category: string; option: string; _createdAt: number }> = {};
        groupsSnap.forEach((gDoc) => {
          const g = gDoc.data() as any;
          const members = Array.isArray(g.members) ? g.members : [];
          const gCat = g.category || "";
          const gOpt = g.option || "";
          const gCreatedAt = g.createdAt?.seconds || 0;
          members.forEach((m: any) => {
            const mPhone = typeof m === "string" ? m : m?.phone || m?.uid || "";
            if (!mPhone) return;
            const existing = userGroupCategory[mPhone];
            if (!existing || gCreatedAt > existing._createdAt) {
              userGroupCategory[mPhone] = { category: gCat, option: gOpt, _createdAt: gCreatedAt };
            }
          });
        });

        const partners: PartnerMatch[] = [];
        usersSnap.forEach((uDoc) => {
          const u = uDoc.data() as any;
          if (u.phone === phone) return;
          if (!u.state) return;
          if (!u.profileCompleted) return;

          const tierInfo = getMatchTier(u, me);
          const compatibility = computeCompatibility(me, u);

          let partnerCategory = u.category || "";
          let partnerOption = u.option || "";
          if (!partnerCategory || !partnerOption) {
            const fromGroup = userGroupCategory[u.phone];
            if (fromGroup) {
              if (!partnerCategory && fromGroup.category) partnerCategory = fromGroup.category;
              if (!partnerOption && fromGroup.option) partnerOption = fromGroup.option;
            }
          }

          let distance = "";
          if (u.city && me.city && u.city === me.city) {
            distance = (1 + Math.random() * 4).toFixed(1);
          } else if (u.district && me.district && u.district === me.district) {
            distance = (3 + Math.random() * 7).toFixed(1);
          } else if (u.state && me.state && u.state === me.state) {
            distance = (10 + Math.random() * 40).toFixed(1);
          }

          partners.push({
            uid: u.phone,
            phone: u.phone,
            userId: generateUserId(u.phone),
            name: u.name || "User",
            city: u.city || "",
            district: u.district || "",
            state: u.state,
            photoURL: u.photoURL || "",
            category: partnerCategory,
            option: partnerOption,
            matchTier: tierInfo.tier,
            matchLabel: tierInfo.label,
            compatibility: compatibility.score,
            compatReasons: compatibility.reasons,
            distance,
            joinedDate: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : "Recently",
            docId: uDoc.id,
          });
        });

        partners.sort((a, b) => {
          if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
          return b.compatibility - a.compatibility;
        });

        setNearbyPartners(partners);
        setLoading(false);
      } catch (err) {
        console.error("Matching error:", err);
        setLoading(false);
      }
    };

    loadPartners();
  }, [phone]);

  const startMatch = useCallback(async (partner: PartnerMatch) => {
    if (!phone || !userProfile) return;
    setStartingMatch(partner.uid);
    try {
      const authUser = auth.currentUser;
      if (!authUser) {
        toast.error("Please login first");
        setStartingMatch(null);
        return;
      }
      const myUserId = generateUserId(phone);

      const matchData = {
        userA: {
          phone,
          userId: myUserId,
          state: userProfile.state || "",
          district: userProfile.district || "",
          city: userProfile.city || "",
        },
        userB: {
          phone: partner.phone,
          userId: partner.userId,
          state: partner.state || "",
          district: partner.district || "",
          city: partner.city || "",
        },
        category: partner.category || "",
        option: partner.option || "",
        matchQuality: partner.matchLabel,
        compatibility: partner.compatibility,
        status: "Requested",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, "matchRequests"), matchData);
      toast.success(`✅ Match request sent to ${partner.userId}`);
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Match error:", err);
      toast.error("Failed to create match request. Please try again.");
    }
    setStartingMatch(null);
  }, [phone, userProfile, router]);

  // Filter and sort partners
  const filteredPartners = nearbyPartners.filter((p) => {
    if (filters.category !== "All" && p.category !== filters.category) return false;
    if (filters.state !== "All" && p.state !== filters.state) return false;
    if (filters.city !== "All" && p.city !== filters.city) return false;
    if (filters.status !== "All") {
      if (filters.status === "Available" && p.matchTier > 2) return false;
      if (filters.status === "Same City" && p.matchTier !== 1) return false;
      if (filters.status === "Same State" && p.matchTier > 2) return false;
    }
    return true;
  });

  const sortedPartners = [...filteredPartners].sort((a, b) => {
    if (filters.sortBy === "compatibility") return b.compatibility - a.compatibility;
    if (filters.sortBy === "city") return a.matchTier - b.matchTier;
    if (filters.sortBy === "recent") return (b.joinedDate || "").localeCompare(a.joinedDate || "");
    return b.compatibility - a.compatibility;
  });

  const categories = ["All", ...Array.from(new Set(nearbyPartners.map((p) => p.category).filter(Boolean)))];
  const states = ["All", ...Array.from(new Set(nearbyPartners.map((p) => p.state).filter(Boolean)))];
  const cities = ["All", ...Array.from(new Set(nearbyPartners.map((p) => p.city).filter(Boolean)))];

  if (loading) {
    return (
      <div className="min-h-screen pt-28 px-6 max-w-5xl mx-auto text-white">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-48 bg-gray-800 rounded" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-900 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className="min-h-screen pt-32 px-6 max-w-5xl mx-auto text-white text-center">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Find Partners</h1>
        <p className="mt-4 text-gray-400">Please login first.</p>
        <button
          onClick={() => router.push("/login")}
          className="mt-6 btn-primary text-sm inline-block"
        >
          Login
        </button>
      </div>
    );
  }

  if (!userProfile?.state) {
    return (
      <div className="min-h-screen pt-32 px-6 max-w-5xl mx-auto text-white text-center">
        <h1 className="text-3xl font-bold text-[#D4AF37]">Find Partners</h1>
        <p className="mt-4 text-gray-400">Complete your profile to find compatible partners near you.</p>
        <button
          onClick={() => router.push("/profile")}
          className="mt-6 btn-primary text-sm inline-block"
        >
          Complete Profile →
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 px-4 sm:px-6 max-w-6xl mx-auto text-white pb-mobile-cta">
      <Seo
        title="Find Partners"
        description="Find trusted people nearby to split memberships, tickets, travel, subscriptions and more. Smart matching based on location and interests."
        canonicalPath="/find-partners"
      />
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#D4AF37]">Find Partners</h1>
        <p className="text-gray-400 text-sm mt-2">
          Discover compatible partners near you. Identity remains masked until a match is confirmed.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
          className="input text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c} className="bg-black">{c}</option>
          ))}
        </select>
        <select
          value={filters.state}
          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
          className="input text-sm"
        >
          {states.map((s) => (
            <option key={s} value={s} className="bg-black">{s}</option>
          ))}
        </select>
        <select
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          className="input text-sm"
        >
          {cities.map((c) => (
            <option key={c} value={c} className="bg-black">{c}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="input text-sm"
        >
          <option value="All" className="bg-black">All Status</option>
          <option value="Available" className="bg-black">Available</option>
          <option value="Same City" className="bg-black">Same City</option>
          <option value="Same State" className="bg-black">Same State</option>
        </select>
        <select
          value={filters.sortBy}
          onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
          className="input text-sm"
        >
          <option value="compatibility" className="bg-black">Sort: Compatibility</option>
          <option value="city" className="bg-black">Sort: Location</option>
          <option value="recent" className="bg-black">Sort: Recent</option>
        </select>
      </div>

      {/* Match Cards */}
      {sortedPartners.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-[#D4AF37] mb-2">No compatible partners found yet.</h3>
          <p className="text-gray-400 text-sm mb-6">
            Try adjusting your filters or complete your profile to improve matches.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => router.push("/categories")}
              className="btn-primary text-sm"
            >
              Browse Categories
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="px-6 py-3 rounded-xl border border-white/20 text-sm font-semibold hover:bg-white/5 transition"
            >
              Update Profile
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedPartners.map((partner) => {
            const isSameCity = partner.city && userProfile?.city && partner.city === userProfile.city;
            const isSameState = partner.state && userProfile?.state && partner.state === userProfile.state;
            const isSameCategory = partner.category && userProfile?.category && partner.category === userProfile.category;
            const isSameSubcategory = partner.option && userProfile?.option && partner.option === userProfile.option;

            const whyReasons: string[] = [];
            if (isSameState && partner.state) whyReasons.push(`✓ Same State (${partner.state})`);
            if (isSameCity && partner.city) whyReasons.push(`✓ Same City (${partner.city})`);
            if (isSameCategory && partner.category) whyReasons.push(`✓ Same Category (${partner.category})`);
            if (isSameSubcategory && partner.option) whyReasons.push(`✓ Same Subcategory (${partner.option})`);
            if (whyReasons.length === 0) {
              if (partner.compatReasons.length > 0) partner.compatReasons.forEach((r) => whyReasons.push(r));
              else if (partner.matchLabel) whyReasons.push(`📍 ${partner.matchLabel}`);
            }

            return (
              <div
                key={partner.uid}
                className="card-premium p-5 flex flex-col"
              >
                {/* Match percentage */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-lg">
                      {partner.matchLabel === "Same City" ? "📍" : partner.matchLabel === "Same State" ? "🌍" : "👤"}
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[#D4AF37]">{partner.compatibility}%</p>
                      <p className="text-[10px] text-gray-500">Match</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium ${partner.matchTier === 1 ? "text-green-400" : partner.matchTier === 2 ? "text-blue-400" : "text-gray-400"}`}>
                    {partner.matchLabel}
                  </span>
                </div>

                {/* Category + Subcategory */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {partner.category || "General"}
                  </h3>
                  {partner.option && (
                    <p className="text-sm text-gray-400">{partner.option}</p>
                  )}
                </div>

                {/* Location */}
                <div className="space-y-1 mb-4 text-sm text-gray-400">
                  {partner.city && <p>📍 {partner.city}</p>}
                  {partner.state && <p>🌍 {partner.state}</p>}
                </div>

                {/* Compatibility reasons */}
                {whyReasons.length > 0 && (
                  <div className="mb-4 space-y-1">
                    {whyReasons.slice(0, 3).map((reason, i) => (
                      <p key={i} className="text-xs text-gray-500">{reason}</p>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <div className="mt-auto">
                  <button
                    onClick={() => startMatch(partner)}
                    disabled={startingMatch === partner.uid}
                    className="w-full py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black hover:scale-[1.02] transition disabled:opacity-50"
                  >
                    {startingMatch === partner.uid ? "Sending..." : "Start Match"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}