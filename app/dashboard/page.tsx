"use client";

import {
  useEffect,
  useState,
  useCallback,
} from "react";

import Link from "next/link";
import {
  useRouter,
} from "next/navigation";

import {
  db,
  auth,
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
  addDoc,
  serverTimestamp,
  setDoc,
  query,
  where,
} from "firebase/firestore";

import { motion, AnimatePresence } from "framer-motion";

import {
  isExpired,
  getExpiryStatus,
  computeCompatibility,
  generateUserId,
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
  phone: string;
  userId: string;
  name: string;
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
  docId: string;
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
  const myUserId = phone ? generateUserId(phone) : "";

  /* LOCATION-BASED MATCHING */
  const [userProfile, setUserProfile] = useState<any>(null);
  const [nearbyPartners, setNearbyPartners] = useState<PartnerMatch[]>([]);

  /* COUNTDOWN TIMER STATE */
  const [now, setNow] = useState(Date.now());
  const [startingMatch, setStartingMatch] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  /* Section 3: Compute matching members */
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
  function ProgressBar({ current, max, status, isComplete }: { current: number; max: number; status?: string; isComplete?: boolean }) {
    const percent = Math.min((current / max) * 100, 100);
    let barClass = "progress-active";
    if (status === "expiring-soon") barClass = "progress-expiring";
    if (status === "expired" || percent >= 100 || isComplete) barClass = "progress-complete";

    return (
      <div className="mt-2">
        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barClass}`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {isComplete || current >= max ? (
            <span className="text-green-400">{current} of {max} members joined — 100% complete</span>
          ) : (
            <span>{current} of {max} members joined — {Math.round(percent)}% complete</span>
          )}
        </p>
      </div>
    );
  }

  /* Section 5: Match expiry visualization */
  function ExpiryIndicator({ createdAt }: { createdAt: any }) {
    const expiry = getExpiryStatus(createdAt);
    if (expiry.status === "expired") return null;

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

    if (sameCity) return { tier: 1, label: "Same City" };
    if (sameState) return { tier: 2, label: "Same State" };
    return { tier: 3, label: "Other" };
  }

  /* Section 6 + 11: Start Match - Creates admin-visible record */
  const startMatch = useCallback(async (partner: PartnerMatch) => {
    if (!phone || !userProfile) return;
    setStartingMatch(partner.uid);

    try {
      const authUser = auth.currentUser;
      if (!authUser) {
        alert("Please login first");
        setStartingMatch(null);
        return;
      }

      // Create a match request record in Firestore
      const matchData = {
        userA: {
          phone: phone,
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Save to matchRequests collection for admin visibility
      const matchRef = await addDoc(collection(db, "matchRequests"), matchData);

      alert(`✅ Match request sent!\n\nYour ID: ${myUserId}\nPartner ID: ${partner.userId}\n\nAdmin will process this request.`);
    } catch (err: any) {
      console.error("Match error:", err);
      alert("Failed to create match request. Please try again.");
    }

    setStartingMatch(null);
  }, [phone, userProfile, myUserId]);

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
            phone: u.phone,
            userId: generateUserId(u.phone),
            name: u.name || "User",
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
            docId: uDoc.id,
          });
        });

        /* SORT by tier then by compatibility */
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

        // Sort: 1) Active non-expired (most recent first), 2) Expiring soon, 3) Expired last
        groups.sort((a, b) => {
          const aExpired = isExpired(a.createdAt);
          const bExpired = isExpired(b.createdAt);
          
          // Expired groups always last
          if (aExpired && !bExpired) return 1;
          if (!aExpired && bExpired) return -1;
          
          // Both active: check expiring soon
          const aExpiring = getExpiryStatus(a.createdAt).status === "expiring-soon";
          const bExpiring = getExpiryStatus(b.createdAt).status === "expiring-soon";
          
          // Non-expiring active groups first (most recent)
          if (!aExpiring && !bExpiring) return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          
          // Expiring soon after active
          if (aExpiring && !bExpiring) return 1;
          if (!aExpiring && bExpiring) return -1;
          
          // Both expiring: by days left
          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        });
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

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto text-white pb-mobile-cta">

      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-[#FFD166]"
      >
        My Partners
      </motion.h1>

      {/* Current Active Match Header */}
      {(() => {
        const activeNonExpired = matches.filter(g => !isExpired(g.createdAt) && !g.isPaid);
        const latestActive = activeNonExpired.length > 0 ? activeNonExpired.reduce((a, b) => {
          return (a.createdAt?.seconds || 0) > (b.createdAt?.seconds || 0) ? a : b;
        }) : null;
        
        return (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2"
          >
            <p className="text-gray-400 text-sm">
              <span className="text-gray-500">Your ID: {myUserId}</span>
            </p>
            {latestActive && (
              <div className="mt-2 bg-gradient-to-r from-[#FFD166]/10 to-transparent rounded-xl p-3 border border-[#FFD166]/20">
                <p className="text-xs text-gray-400">Current Active Match</p>
                <p className="text-[#FFD166] font-bold text-sm mt-0.5">
                  {latestActive.category} → {latestActive.option}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {(() => {
                    const ld = (latestActive.createdAt?.seconds) 
                      ? new Date(latestActive.createdAt.seconds * 1000).toLocaleDateString() 
                      : "Just now";
                    return `Started: ${ld}`;
                  })()}
                </p>
              </div>
            )}
          </motion.div>
        );
      })()}

      {/* DASHBOARD SUMMARY CARDS */}
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

      {/* MATCHING STATUS FOR EMPTY STATE */}
      {matches.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-8 card-glass-premium p-8 text-center max-w-lg mx-auto"
        >
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-[#FFD166] mb-2">Finding Compatible Members</h3>
          
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
            👥 {nearbyPartners.length} People Currently Searching
          </p>

          <Link
            href="/categories"
            className="mt-6 inline-block btn-primary text-sm"
          >
            Explore Categories
          </Link>
        </motion.div>
      )}

      {/* ACTIVE MATCHES */}
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

                    {!group.isPaid && (
                      <div className="mt-2">
                        {isSearching ? (
                          <div className="flex items-center gap-2 text-blue-400 text-xs">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span>🔍 Waiting for {required - matchingCount} more member{(required - matchingCount) > 1 ? "s" : ""}</span>
                          </div>
                        ) : isReady ? (
                          <div className="flex items-center gap-2 text-green-400 text-xs">
                            <span>✅ Group Complete — Ready to Unlock</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-yellow-400 text-xs">
                            <span>👥 Building group — Waiting for {required - matchingCount} more member{(required - matchingCount) > 1 ? "s" : ""}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {userProfile?.state ? (
                      <ProgressBar current={matchingCount} max={required} status={expiry.status} />
                    ) : (
                      <ProgressBar current={group.membersCount} max={group.requiredSize} status={expiry.status} />
                    )}

                    {group.createdAt && !isExpired(group.createdAt) && (
                      <ExpiryIndicator createdAt={group.createdAt} />
                    )}
                  </div>

                  <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${statusInfo.color}`}>
                    {statusInfo.label}
                  </div>
                </div>

                {!group.isPaid && (
                  <div className="mt-4">
                    {isReady ? (
                      <div className="rounded-xl border border-green-500/30 bg-green-900/15 p-4">
                        <p className="text-green-400 text-sm font-bold flex items-center gap-2">
                          🎉 Match Complete
                        </p>
                        <p className="text-xs text-green-300 mt-1">All required members joined.</p>
                        <div className="mt-2 space-y-1 text-xs text-gray-400">
                          <p><span className="text-[#FFD166]">Category:</span> {group.category}</p>
                          <p><span className="text-[#FFD166]">Subcategory:</span> {group.option}</p>
                          <p><span className="text-[#FFD166]">Members:</span> {matchingCount}/{required}</p>
                          <p className="text-green-400 mt-1">✅ Ready for Unlock</p>
                        </div>
                      </div>
                    ) : matchingCount > 1 ? (
                      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                        <p className="text-green-400 text-sm font-bold flex items-center gap-2">
                          ✅ Candidate Found
                        </p>
                        <div className="mt-2 space-y-1 text-xs text-gray-400">
                          <p><span className="text-[#FFD166]">Category:</span> {group.category}</p>
                          <p><span className="text-[#FFD166]">Subcategory:</span> {group.option}</p>
                          <p><span className="text-[#FFD166]">Match:</span> Same City ✓</p>
                          <p><span className="text-[#FFD166]">Needed:</span> {required - matchingCount} more member{(required - matchingCount) > 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                        <p className="text-blue-400 text-sm font-bold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                          🔍 Searching for compatible partners...
                        </p>
                        <p className="mt-1 text-xs text-blue-300">Waiting for {required - matchingCount} more member{(required - matchingCount) > 1 ? "s" : ""}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Ready state now handled above in "Match Complete" section */}

                {group.isPaid && (
                  <div className="mt-4 space-y-2">
                    {group.members.map((m: any, i: number) => {
                      const member = typeof m === "string" ? { name: "User", phone: m } : m;
                      return (
                        <div key={i} className="bg-black/40 rounded-xl p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={member.photoURL || `https://ui-avatars.com/api/?background=18181B&color=D4AF37&name=${encodeURIComponent(member.name || "U")}`}
                              alt="user"
                              className="w-10 h-10 rounded-full border border-[#FFD166]"
                            />
                            <div>
                              <p className="font-bold text-sm text-white">
                                User: {generateUserId(member.phone || member.uid || "")}
                              </p>
                              <p className="text-xs text-green-400 mt-0.5">✓ Identity Revealed After Payment</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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

      {/* ===== SECTION 19: NEARBY PARTNERS (Privacy-First Redesign) ===== */}
      {userProfile?.state && nearbyPartners.length > 0 && (
        <div className="mt-12 mb-16">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold text-[#FFD166] mb-1"
          >
            📍 Nearby Candidates
          </motion.h2>

          <p className="text-gray-400 text-xs mb-6">
            Potential matches near you. Identity remains hidden until payment unlocks.
          </p>

          <div className="space-y-4">
            {nearbyPartners.map((partner, idx) => {
              /* Privacy: Show only User ID, not real name */
              const uniqueDistance = partner.city ? (
                partner.city === userProfile?.city ? "📍 Same City" : `${partner.city}, ${partner.state}`
              ) : partner.state;

              /* Determine match badges */
              const isSameCity = partner.city && userProfile?.city && partner.city === userProfile.city;
              const isSameState = partner.state && userProfile?.state && partner.state === userProfile.state;
              const isSameCategory = partner.category && userProfile?.category && partner.category === userProfile.category;
              const isSameSubcategory = partner.option && userProfile?.option && partner.option === userProfile.option;
              const isPerfectMatch = isSameState && isSameCity && isSameCategory && isSameSubcategory;

              const matchBadges: { icon: string; label: string; color: string }[] = [];
              if (isPerfectMatch) matchBadges.push({ icon: "🏆", label: "Perfect Match", color: "text-yellow-400 bg-yellow-500/10" });
              if (isSameCity) matchBadges.push({ icon: "📍", label: "Same City", color: "text-green-400 bg-green-500/10" });
              if (isSameCategory) matchBadges.push({ icon: "🎯", label: "Same Category", color: "text-blue-400 bg-blue-500/10" });
              if (isSameSubcategory) matchBadges.push({ icon: "🤝", label: "Same Subcategory", color: "text-purple-400 bg-purple-500/10" });

              /* "Why this match?" reasons - enhanced with values */
              const whyReasons: string[] = [];
              if (isSameState && partner.state) {
                whyReasons.push(`✓ Same State (${partner.state})`);
              }
              if (isSameCity && partner.city) {
                whyReasons.push(`✓ Same City (${partner.city})`);
              }
              if (isSameCategory && partner.category) {
                whyReasons.push(`✓ Same Category (${partner.category})`);
              }
              if (isSameSubcategory && partner.option) {
                whyReasons.push(`✓ Same Subcategory (${partner.option})`);
              }
              // Fallback: add compatibility reasons if no specific match reasons
              if (whyReasons.length === 0) {
                if (partner.compatReasons.length > 0) {
                  partner.compatReasons.forEach(r => whyReasons.push(r));
                } else if (partner.matchLabel) {
                  whyReasons.push(`📍 ${partner.matchLabel}`);
                }
              }

              /* Partner Since */
              const partnerSince = partner.joinedDate || "Recently";

              return (
                <motion.div
                  key={partner.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="card-premium p-4 border-l-4"
                  style={{
                    borderLeftColor: partner.compatibility >= 90 ? "#10b981" : partner.compatibility >= 75 ? "#3b82f6" : partner.compatibility >= 50 ? "#f59e0b" : "#6b7280"
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Anonymous avatar */}
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-[#FFD166]/30 flex items-center justify-center text-[#FFD166] text-xs font-bold flex-shrink-0">
                      {partner.userId.slice(-4)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Section 1: Show User ID only - no real name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm font-mono">
                          {partner.userId}
                        </h3>
                        <span className="badge-verified text-[9px]">✓ Verified</span>
                      </div>

                      {/* Section 2: Category + Brand immediately visible */}
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                        {partner.category && (
                          <span className="text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                            📁 {partner.category}
                          </span>
                        )}
                        {partner.option && (
                          <span className="text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">
                            🏷 {partner.option}
                          </span>
                        )}
                      </div>

                      {/* Section 4: Compatibility display */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs font-bold ${
                          partner.compatibility >= 90 ? "text-green-400" :
                          partner.compatibility >= 75 ? "text-blue-400" :
                          partner.compatibility >= 50 ? "text-yellow-400" :
                          "text-gray-400"
                        }`}>
                          {partner.compatibility}% Compatible
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${partner.compatibility}%`,
                              background: partner.compatibility >= 90 ? "linear-gradient(90deg, #10b981, #34d399)" :
                                          partner.compatibility >= 75 ? "linear-gradient(90deg, #3b82f6, #60a5fa)" :
                                          partner.compatibility >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" :
                                          "linear-gradient(90deg, #6b7280, #9ca3af)"
                            }}
                          />
                        </div>
                      </div>

                      {/* Compatibility reasons */}
                      {partner.compatReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {partner.compatReasons.map((reason, i) => (
                            <span key={i} className="text-[9px] text-green-400/70 bg-green-500/5 px-1.5 py-0.5 rounded">
                              {reason}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Section 3: City visible */}
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500">
                        <span>📍 {uniqueDistance}</span>
                        {partner.matchLabel && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                            partner.matchTier <= 1 ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"
                          }`}>
                            {partner.matchLabel}
                          </span>
                        )}
                      </div>

                      {/* Active indicator */}
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Active in {partner.category || ""}{partner.option ? ` → ${partner.option}` : ""}
                      </div>

                      {/* Partner Since */}
                      <div className="mt-1 text-[9px] text-gray-600">
                        👤 Partner since {partnerSince}
                      </div>

                      {/* Why This Match Section */}
                      {whyReasons.length > 0 && (
                        <div className="mt-2 border border-green-500/10 bg-green-500/5 rounded-lg p-2">
                          <p className="text-[9px] text-green-400 font-medium mb-1">🎯 Why this match?</p>
                          <div className="flex flex-wrap gap-1">
                            {whyReasons.map((reason, i) => (
                              <span key={i} className="text-[8px] text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded">
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => startMatch(partner)}
                        disabled={startingMatch === partner.uid}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black hover:scale-105 transition disabled:opacity-50"
                      >
                        {startingMatch === partner.uid ? "Sending..." : "Start Match"}
                      </button>
                      <button
                        onClick={() => {
                          const msg = `Report user ${partner.userId} (${partner.phone})?\n\nReason for report (email to support@partnersync.in):`;
                          const reason = prompt(msg);
                          if (reason) {
                            window.location.href = `mailto:support@partnersync.in?subject=Report User - ${partner.userId}&body=Reported User: ${partner.userId} (${partner.phone})%0D%0ACategory: ${partner.category}%0D%0AReason: ${encodeURIComponent(reason)}`;
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg text-[9px] bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 transition"
                      >
                        🚩 Report
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="text-green-400">📍 Same City — 90% Compatible</div>
              <div className="text-blue-400">📍 Same State — 50% Compatible</div>
              <div className="text-gray-400">📍 Other — 25% Compatible</div>
            </div>
          </div>
        </div>
      )}

      {/* STICKY BOTTOM CTA */}
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