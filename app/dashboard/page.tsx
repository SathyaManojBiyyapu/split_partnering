"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  db,
} from "@/firebase/config";

import {
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  query,
  where,
} from "firebase/firestore";

import { motion, AnimatePresence } from "framer-motion";

import {
  isExpired,
  getExpiryStatus,
  computeCompatibility,
} from "@/app/data/matchExpiry";

type Group = {
  id: string;
  category: string;
  option: string;
  members: any[];
  membersCount: number;
  requiredSize: number;
  status: string;
  createdAt?: any;
  isPaid?: boolean;
};

type PartnerMatch = {
  uid: string;
  name: string;
  phone: string;
  city: string;
  district: string;
  state: string;
  photoURL: string;
  category: string;
  option: string;
  matchTier: number;
  matchLabel: string;
  compatibility: number;
  compatReasons: string[];
  joinedDate?: string;
};

export default function DashboardPage() {

  const router = useRouter();

  const [matches, setMatches] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestSelection, setLatestSelection] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  /* USER */
  const rawPhone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
  const phone = rawPhone?.trim() || null;

  /* LOCATION-BASED MATCHING */
  const [userProfile, setUserProfile] = useState<any>(null);
  const [nearbyPartners, setNearbyPartners] = useState<PartnerMatch[]>([]);

  /* COUNTDOWN TIMER STATE */
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  /* Section 3: Compute matching members in a group based on current user's location */
  function computeGroupMatch(
    groupMembers: any[],
    groupCategory: string,
    groupOption: string
  ): {
    matchingCount: number;
    matchLevel: "same-city" | "none";
  } {
    if (!userProfile?.city) {
      return { matchingCount: 0, matchLevel: "none" };
    }

    let count = 1;

    for (const m of groupMembers) {
      const member = typeof m === "string" ? { phone: m } : m;
      if (member.phone?.trim() === phone) continue;

      const mState = member.state || "";
      const mDistrict = member.district || "";
      const mCity = member.city || "";

      if (
        mState === userProfile.state &&
        mDistrict === userProfile.district &&
        mCity === userProfile.city
      ) {
        count++;
      }
    }

    return {
      matchingCount: count,
      matchLevel: count > 1 ? "same-city" : "none",
    };
  }

  /* Progress bar component */
  function ProgressBar({ current, max, status }: { current: number; max: number; status?: string }) {
    const percent = Math.min((current / max) * 100, 100);
    let barClass = "progress-active";
    if (status === "expiring-soon") barClass = "progress-expiring";
    if (status === "expired" || percent >= 100) barClass = "progress-complete";

    return (
      <div className="mt-2">
        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barClass}`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">{Math.round(percent)}% complete</p>
      </div>
    );
  }

  /* Section 5: Match expiry visualization */
  function ExpiryIndicator({ createdAt }: { createdAt: any }) {
    const expiry = getExpiryStatus(createdAt);
    if (expiry.status === "expired") return null; // Don't show ugly expired labels

    const barColor = expiry.status === "expiring-soon" 
      ? "progress-expiring" 
      : "progress-active";

    return (
      <div className="mt-2 bg-black/30 rounded-lg p-2">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-gray-400">⏱ Match Duration</span>
          <span className={`text-[10px] font-medium ${
            expiry.status === "expiring-soon" ? "text-orange-400" : "text-gray-300"
          }`}>
            {expiry.label}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${expiry.progress}%` }}
          />
        </div>
      </div>
    );
  }

  /* Status color config */
  const statusColors: Record<string, string> = {
    searching: "bg-blue-600",
    waiting: "bg-yellow-500 text-black",
    ready: "bg-green-600",
    paid: "bg-emerald-500",
    chat: "bg-purple-600",
    expired: "bg-red-600",
  };

  const statusLabels: Record<string, string> = {
    searching: "Searching",
    waiting: "Waiting",
    ready: "Ready for payment",
    paid: "Paid",
    expired: "Expired",
  };

  function getGroupStatus(group: Group, matchingCount: number, required: number): { color: string; label: string } {
    const expiry = getExpiryStatus(group.createdAt);
    
    if (expiry.status === "expired") return { color: "bg-red-600/20 text-red-400 border border-red-500/30", label: "Expired" };
    if (group.isPaid) return { color: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30", label: "Paid ✅" };
    if (matchingCount >= required) return { color: "bg-green-500/20 text-green-400 border border-green-500/30", label: "Ready to Unlock 🔓" };
    if (expiry.status === "expiring-soon") return { color: "bg-orange-500/20 text-orange-400 border border-orange-500/30", label: "Expiring Soon ⏳" };
    if (matchingCount <= 1) return { color: "bg-blue-500/20 text-blue-400 border border-blue-500/30", label: "🔍 Matching" };
    return { color: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30", label: "Waiting" };
  }

  /* Section 20: Get match tier label */
  function getMatchTier(partner: any, user: any): { tier: number; label: string } {
    if (!user?.state) return { tier: 5, label: "Other Users" };

    const sameCity = partner.city && user.city && partner.city === user.city;
    const sameState = partner.state && user.state && partner.state === user.state;
    const sameCategory = partner.category && user.category && partner.category === user.category;

    if (sameCity && sameCategory) return { tier: 1, label: "Same City + Category" };
    if (sameCity) return { tier: 2, label: "Same City" };
    if (sameState && sameCategory) return { tier: 3, label: "Same State + Category" };
    if (sameState) return { tier: 4, label: "Same State" };
    return { tier: 5, label: "Other Users" };
  }

  useEffect(() => {
    if (!phone) return;

    const loadNearby = async () => {
      try {
        const userRef = doc(db, "users", phone);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) return;

        const me = userSnap.data() as any;
        setUserProfile(me);

        if (!me.state) return;

        /* FETCH ALL USERS */
        const usersSnap = await getDocs(collection(db, "users"));

        const partners: PartnerMatch[] = [];
        const currentUserPhone = phone;

        usersSnap.forEach((uDoc) => {
          const u = uDoc.data() as any;

          if (u.phone === currentUserPhone) return;
          if (!u.state) return;
          if (!u.profileCompleted) return;

          const tierInfo = getMatchTier(u, me);
          const compatibility = computeCompatibility(me, u);

          partners.push({
            uid: u.phone,
            name: u.name || "User",
            phone: u.phone,
            city: u.city || "",
            district: u.district || "",
            state: u.state,
            photoURL: u.photoURL || "",
            category: u.category || "",
            option: u.option || "",
            matchTier: tierInfo.tier,
            matchLabel: tierInfo.label,
            compatibility: compatibility.score,
            compatReasons: compatibility.reasons,
            joinedDate: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : "Recently",
          });
        });

        /* SORT by tier (1-5) then by compatibility */
        partners.sort((a, b) => {
          if (a.matchTier !== b.matchTier) return a.matchTier - b.matchTier;
          return b.compatibility - a.compatibility;
        });

        setNearbyPartners(partners);

      } catch (err) {
        console.error("Matching error:", err);
      }
    };

    loadNearby();
  }, [phone]);

  /* FETCH GROUPS */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(collection(db, "groups"), async (snapshot) => {
      try {
        const paymentsSnap = await getDocs(collection(db, "payments"));
        const paidGroups = new Set<string>();

        paymentsSnap.forEach((p) => {
          const pdata = p.data();
          if (pdata.uid === phone && (pdata.status === "paid" || pdata.paid === true)) {
            paidGroups.add(pdata.groupId);
          }
        });

        const groups: Group[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const members = Array.isArray(data.members) ? data.members : [];

          const hasPhone = members.some((m: any) => {
            if (typeof m === "string") return m.trim() === phone;
            return m?.phone?.trim() === phone;
          });

          const hasUID = Array.isArray(data.memberUIDs) && data.memberUIDs.includes(phone);

          if (!hasPhone && !hasUID) return;

          groups.push({
            id: docSnap.id,
            category: data.category || "Unknown",
            option: data.option || "Unknown",
            members,
            membersCount: data.membersCount || members.length,
            requiredSize: data.requiredSize || 0,
            status: data.status || "waiting",
            createdAt: data.createdAt,
            isPaid: paidGroups.has(docSnap.id),
          });
        });

        groups.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setMatches(groups);

      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    });

    return () => unsub();
  }, [phone]);

  /* LATEST SELECTION */
  useEffect(() => {
    if (!phone) return;

    const loadSelection = async () => {
      try {
        const snap = await getDocs(collection(db, "selections"));
        const list = snap.docs.map((d) => d.data());

        const mine = list.filter((s: any) => s.phone === phone);
        mine.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        if (mine.length > 0) {
          setLatestSelection(mine[0]);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadSelection();
  }, [phone]);

  /* DELETE MATCH */
  const deleteMatch = async (groupId: string) => {
    const ok = confirm("Remove this match?");
    if (!ok) return;

    try {
      const gRef = doc(db, "groups", groupId);
      const snap = await getDoc(gRef);
      if (!snap.exists()) return;

      const data = snap.data() as any;
      const members = data.members || [];

      const removeMember = members.find((m: any) => {
        if (typeof m === "string") return m.trim() === phone;
        return m?.phone === phone;
      });

      const newCount = Math.max(0, (data.membersCount || members.length) - 1);

      await updateDoc(gRef, {
        members: arrayRemove(removeMember),
        memberUIDs: arrayRemove(phone),
        membersCount: newCount,
      });

      if (newCount === 0) {
        await deleteDoc(gRef);
      }

      alert("Removed successfully");
    } catch (err) {
      console.error(err);
      alert("Failed to remove");
    }
  };

  /* NO LOGIN */
  if (!phone) {
    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto text-white">
        <h1 className="text-4xl font-bold text-[#FFD166]">My Partners</h1>
        <p className="mt-5 text-gray-400">Please login first.</p>
      </div>
    );
  }

  /* LOADING */
  if (loading) {
    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto text-white">
        <h1 className="text-4xl font-bold text-[#FFD166]">My Partners</h1>
        <p className="mt-5 text-gray-400">Loading...</p>
      </div>
    );
  }

  /* Compute summary stats */
  const activeMatches = matches.filter(g => !isExpired(g.createdAt)).length;
  const readyMatches = matches.filter(g => {
    if (isExpired(g.createdAt)) return false;
    if (g.isPaid) return false;
    if (!userProfile?.state) return g.membersCount >= g.requiredSize;
    const info = computeGroupMatch(g.members, g.category, g.option);
    return info.matchingCount >= g.requiredSize;
  }).length;

  /* Section 3: Matching people count */
  const searchingPeople = nearbyPartners.filter(p => p.matchTier <= 2).length;

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto text-white pb-mobile-cta">

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-[#FFD166]"
      >
        My Partners
      </motion.h1>

      {latestSelection && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2 text-gray-400 text-sm"
        >
          Latest: <span className="text-[#FFD166] font-medium">{latestSelection.category} → {latestSelection.option}</span>
        </motion.p>
      )}

      {/* ===== DASHBOARD SUMMARY CARDS ===== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3"
      >
        <div className="card-glass-premium p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{activeMatches}</p>
          <p className="text-xs text-gray-400 mt-1">Active Matches</p>
        </div>
        <div className="card-glass-premium p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{readyMatches}</p>
          <p className="text-xs text-gray-400 mt-1">Ready to Unlock</p>
        </div>
        <div className="card-glass-premium p-4 text-center">
          <p className="text-2xl font-bold text-[#FFD166]">{nearbyPartners.length}</p>
          <p className="text-xs text-gray-400 mt-1">Nearby Candidates</p>
        </div>
      </motion.div>

      {/* ===== SECTION 3: MATCHING STATUS FOR EMPTY STATE ===== */}
      {matches.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 card-glass-premium p-8 text-center max-w-lg mx-auto"
        >
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-[#FFD166] mb-2">Finding Compatible Members</h3>
          
          {/* Animated progress bar */}
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full progress-active"
              initial={{ width: "0%" }}
              animate={{ width: "65%" }}
              transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
            />
          </div>

          <p className="text-sm text-gray-400 mb-2">
            Expected Match: <span className="text-[#FFD166] font-medium">2-6 Hours</span>
          </p>
          <p className="text-xs text-gray-500">
            👥 {searchingPeople || 12} People Currently Searching
          </p>

          <Link
            href="/categories"
            className="mt-6 inline-block btn-primary text-sm"
          >
            Explore Categories
          </Link>
        </motion.div>
      )}

      {/* ===== ACTIVE MATCHES ===== */}
      {matches.length > 0 && (
        <div className="mt-6 space-y-5">
          {matches.map((group, idx) => {
            const matchInfo = userProfile?.state
              ? computeGroupMatch(group.members, group.category, group.option)
              : { matchingCount: 0, matchLevel: "none" as const };
            const matchingCount = matchInfo.matchingCount;
            const required = group.requiredSize;
            const isReady = userProfile?.state ? matchingCount >= required : group.membersCount >= group.requiredSize;
            const isSearching = matchingCount <= 1;
            const expiry = getExpiryStatus(group.createdAt);
            const statusInfo = getGroupStatus(group, matchingCount, required);

            return (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="card-premium p-5"
              >
                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-[#FFD166]">
                        {group.category} → {group.option}
                      </h2>
                      {group.isPaid && (
                        <span className="badge-verified text-[10px]">✓ Verified</span>
                      )}
                    </div>

                    {/* Section 3: Matching status */}
                    {!group.isPaid && (
                      <div className="mt-2">
                        {isSearching ? (
                          <div className="flex items-center gap-2 text-blue-400 text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span>🔍 Finding Compatible Members</span>
                          </div>
                        ) : isReady ? (
                          <div className="flex items-center gap-2 text-green-400 text-xs">
                            <span>✅ Group Complete — Ready to Unlock</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-400 text-xs">
                            <span>👥 Building group — {matchingCount}/{required} matched</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Progress bar */}
                    {userProfile?.state ? (
                      <ProgressBar current={matchingCount} max={required} status={expiry.status} />
                    ) : (
                      <ProgressBar current={group.membersCount} max={group.requiredSize} status={expiry.status} />
                    )}

                    {/* Section 5: Expiry indicator */}
                    {group.createdAt && !isExpired(group.createdAt) && (
                      <ExpiryIndicator createdAt={group.createdAt} />
                    )}
                  </div>

                  {/* Status badge */}
                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </div>
                </div>

                {/* Candidate status (Before payment) */}
                {!group.isPaid && (
                  <div className="mt-4">
                    {matchingCount > 1 ? (
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                        <p className="text-green-400 text-sm font-bold flex items-center gap-2">
                          ✅ Candidate Found
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-gray-400">
                          <p><span className="text-[#FFD166]">Category:</span> {group.category}</p>
                          <p><span className="text-[#FFD166]">Brand:</span> {group.option}</p>
                          <p><span className="text-[#FFD166]">Match:</span> Same City ✓</p>
                          {isReady && (
                            <p className="text-green-400 mt-1">✓ Ready for Unlock</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <p className="text-blue-400 text-sm font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          🔍 Searching for compatible partners...
                        </p>
                        <p className="mt-1 text-xs text-blue-300">
                          Expected match: 2-6 hours
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Ready to unlock */}
                {!group.isPaid && isReady && (
                  <div className="mt-4 rounded-xl border border-green-500/30 bg-green-900/10 p-4 text-center">
                    <p className="text-green-400 font-bold text-sm">🎉 Ready for Unlock</p>
                    <p className="text-xs text-green-300 mt-1">Location-matched candidate available</p>
                    <p className="text-[10px] text-gray-400 mt-1">Unlock to reveal partner identity and start chatting</p>
                  </div>
                )}

                {/* Members after payment */}
                {group.isPaid && (
                  <div className="mt-4 space-y-2">
                    {group.members.map((m: any, i: number) => {
                      const member = typeof m === "string" ? { name: "User", phone: m } : m;
                      return (
                        <div key={i} className="bg-black/40 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={member.photoURL || "https://ui-avatars.com/api/?background=000000&color=FFD166&name=User"}
                              alt="user"
                              className="w-10 h-10 rounded-full border border-[#FFD166]"
                            />
                            <div>
                              <p className="font-bold text-sm text-white flex items-center gap-2">
                                👤 {member.name || "User"}
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              </p>
                              <p className="text-xs text-gray-400">{member.phone || "N/A"}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold ${member.paid ? "text-green-400" : "text-red-400"}`}>
                            {member.paid ? "PAID" : "NOT PAID"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-4 flex-wrap">
                  {!group.isPaid ? (
                    isReady ? (
                      <button
                        onClick={() => window.location.href = `/payment?groupId=${group.id}`}
                        className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black font-bold hover:scale-105 transition"
                      >
                        🔓 Unlock for ₹29
                      </button>
                    ) : (
                      <button
                        disabled
                        className="px-5 py-2 rounded-xl bg-gray-800 text-gray-500 font-bold cursor-not-allowed"
                      >
                        ⏳ Waiting for group completion
                      </button>
                    )
                  ) : (
                    <button
                      onClick={() => router.push(`/chat/${group.id}`)}
                      className="px-5 py-2 rounded-xl bg-purple-600 font-bold hover:scale-105 transition"
                    >
                      💬 Open Chat
                      {(unreadCounts[group.id] || 0) > 0 && (
                        <span className="ml-2 text-xs">💬 {unreadCounts[group.id]}</span>
                      )}
                    </button>
                  )}

                  <button
                    onClick={() => deleteMatch(group.id)}
                    className="px-5 py-2 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 font-bold hover:scale-105 transition"
                  >
                    ❌ Remove Match
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ===== SECTION 19: NEARBY PARTNERS REDESIGN ===== */}
      {userProfile?.state && nearbyPartners.length > 0 && (
        <div className="mt-12 mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-[#FFD166] mb-1"
          >
            📍 Nearby Partners
          </motion.h2>

          <p className="text-gray-400 text-sm mb-6">
            People near you looking for partnerships. Sorted by proximity.
          </p>

          <div className="space-y-4">
            {nearbyPartners.map((partner, idx) => {
              /* Ensure unique data per card (Section 23) */
              const uniqueAvatar = partner.photoURL || `https://ui-avatars.com/api/?background=18181B&color=D4AF37&name=${encodeURIComponent(partner.name || "User")}`;
              const uniqueDistance = partner.city ? (
                partner.city === userProfile?.city ? "📍 Same City" : `${partner.city}, ${partner.state}`
              ) : partner.state;
              const tierColors = [
                "border-green-500/40 bg-green-500/5",
                "border-blue-500/40 bg-blue-500/5",
                "border-yellow-500/40 bg-yellow-500/5",
                "border-purple-500/40 bg-purple-500/5",
                "border-gray-500/40 bg-gray-500/5",
              ];

              return (
                <motion.div
                  key={partner.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`card-premium p-4 ${tierColors[Math.min(partner.matchTier - 1, 4)]}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Profile picture */}
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#FFD166]/30 flex-shrink-0">
                      <img
                        src={uniqueAvatar}
                        alt={partner.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm">
                          {partner.name || "Partner"}
                        </h3>
                        {/* Section 26: Verified Badge */}
                        <span className="badge-verified">✓ Verified</span>
                      </div>

                      {/* Section 22: Compatibility percentage */}
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-green-400 font-bold">
                          {partner.compatibility}% Compatible
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-green-400"
                            style={{ width: `${partner.compatibility}%` }}
                          />
                        </div>
                      </div>

                      {/* Section 20: Match tier */}
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          partner.matchTier <= 2 ? "bg-green-500/10 text-green-400 border border-green-500/20" :
                          partner.matchTier <= 3 ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                          "bg-gray-500/10 text-gray-400 border border-gray-500/20"
                        }`}>
                          {partner.matchLabel}
                        </span>
                      </div>

                      {/* Section 21: Distance */}
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-500">
                        <span>📍 {uniqueDistance}</span>
                        {partner.category && (
                          <span>📁 {partner.category}</span>
                        )}
                        <span>📅 {partner.joinedDate}</span>
                      </div>

                      {/* Compatibility reasons */}
                      {partner.compatReasons.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {partner.compatReasons.map((reason, i) => (
                            <span key={i} className="text-[10px] text-green-400/70 bg-green-500/5 px-1.5 py-0.5 rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => {/* View profile logic - future */}}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-medium border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/5 transition"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={() => {/* Connect logic - future */}}
                        className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#FFD166] hover:bg-[#D4AF37]/20 transition"
                      >
                        Connect
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Match tiers legend */}
          <div className="mt-8 glass-strong rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-300 mb-2">Matching Priority</h4>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-[10px]">
              <div className="text-green-400">Tier 1: Same City + Category</div>
              <div className="text-blue-400">Tier 2: Same City</div>
              <div className="text-yellow-400">Tier 3: Same State + Category</div>
              <div className="text-purple-400">Tier 4: Same State</div>
              <div className="text-gray-400">Tier 5: Other Users</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STICKY BOTTOM CTA ===== */}
      <div className="sticky-bottom-cta">
        <Link
          href="/categories"
          className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm"
        >
          Explore Categories
        </Link>
      </div>

    </div>
  );
}