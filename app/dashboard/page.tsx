"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db, auth } from "@/firebase/config";
import {
  collection,
  onSnapshot,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { motion } from "framer-motion";
import DashboardSkeleton from "@/app/components/dashboard/DashboardSkeleton";
import StatsCards from "@/app/components/dashboard/StatsCards";
import EmptyState from "@/app/components/dashboard/EmptyState";
import toast from "react-hot-toast";
import {
  isExpired,
  getExpiryStatus,
  computeCompatibility,
  generateUserId,
  formatDate,
} from "@/app/data/matchExpiry";
import { categoryData, slugToCategoryName, masterCategories } from "@/app/data/subcategories";
import { getCurrentUserDocId } from "@/app/lib/userLookup";
import Seo from "@/app/components/Seo";

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
  collaboratorBrand?: string;
  collaboratorId?: string;
  state?: string;
  district?: string;
  city?: string;
};

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

export default function DashboardPage() {
  const router = useRouter();
  const [matches, setMatches] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestSelection, setLatestSelection] = useState<any>(null);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [paidStats, setPaidStats] = useState({ count: 0, total: 0 });

  const rawPhone = typeof window !== "undefined" ? localStorage.getItem("phone") : null;
  const phone = rawPhone?.trim() || null;
  const myUserId = phone ? generateUserId(phone) : "";

  const [userProfile, setUserProfile] = useState<any>(null);
  const [nearbyPartners, setNearbyPartners] = useState<PartnerMatch[]>([]);
  const [startingMatch, setStartingMatch] = useState<string | null>(null);

  function computeGroupMatch(
    groupMembers: any[],
    groupCategory: string,
    groupOption: string
  ): { matchingCount: number; matchLevel: "same-city" | "none" } {
    if (!userProfile?.city) {
      return { matchingCount: 0, matchLevel: "none" };
    }
    let count = 1;
    for (const m of groupMembers) {
      const member = typeof m === "string" ? { phone: m } : m;
      if (member.phone?.trim() === phone) continue;
      if (
        member.state === userProfile.state &&
        member.district === userProfile.district &&
        member.city === userProfile.city
      ) {
        count++;
      }
    }
    return { matchingCount: count, matchLevel: count > 1 ? "same-city" : "none" };
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

  function getMatchTier(partner: any, user: any): { tier: number; label: string } {
    if (!user?.state) return { tier: 5, label: "Other Users" };
    const sameCity = partner.city && user.city && partner.city === user.city;
    const sameState = partner.state && user.state && partner.state === user.state;
    if (sameCity) return { tier: 1, label: "Same City" };
    if (sameState) return { tier: 2, label: "Same State" };
    return { tier: 3, label: "Other" };
  }

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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "matchRequests"), matchData);
      toast.success(`✅ Match request sent to ${partner.userId}`);
    } catch (err: any) {
      console.error("Match error:", err?.code, err?.message, err);
      toast.error(
        `Failed to create match request (${err?.code || "unknown"}). Please try again.`
      );
    }
    setStartingMatch(null);
  }, [phone, userProfile, myUserId]);

  /* Load user profile + nearby partners (preserves existing matching rules) */
  useEffect(() => {
    if (!phone) return;
    const loadNearby = async () => {
      try {
        const userRef = doc(db, "users", getCurrentUserDocId());
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const me = userSnap.data() as any;
        setUserProfile(me);
        if (!me.state) return;

        const usersSnap = await getDocs(collection(db, "users"));
        const selectionsSnap = await getDocs(collection(db, "selections"));
        const latestSelectionByPhone: Record<string, any> = {};
        selectionsSnap.forEach((sDoc) => {
          const s = sDoc.data() as any;
          const sp = s.phone || s.uid || "";
          if (!sp) return;
          const existing = latestSelectionByPhone[sp];
          if (!existing || (s.createdAt?.seconds || 0) > (existing.createdAt?.seconds || 0)) {
            latestSelectionByPhone[sp] = s;
          }
        });

        const groupsSnap = await getDocs(collection(db, "groups"));
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
          if (!partnerCategory || !partnerOption) {
            const latestSelection = latestSelectionByPhone[u.phone];
            if (latestSelection) {
              if (!partnerCategory && latestSelection.category) {
                partnerCategory = typeof latestSelection.category === "string" ? latestSelection.category.replace(/-/g, " ") : latestSelection.category;
              }
              if (!partnerOption && latestSelection.option) {
                partnerOption = typeof latestSelection.option === "string" ? latestSelection.option.replace(/-/g, " ") : latestSelection.option;
              }
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
      } catch (err) {
        console.error("Matching error:", err);
      }
    };
    loadNearby();
  }, [phone]);

  /* Helper: resolve category display name */
  function getCategoryDisplayName(slug: string): string {
    const clean = slug.replace(/-/g, " ");
    const catEntry = masterCategories[slug];
    if (catEntry) return catEntry.name;
    const fromSlug = slugToCategoryName[slug];
    if (fromSlug) return fromSlug;
    return clean.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /* Helper: resolve subcategory display name */
  function getSubcategoryDisplayName(categorySlug: string, optionSlug: string): string {
    const cat = categoryData[categorySlug];
    if (cat) {
      const sub = cat.subcategories.find((s) => s.slug === optionSlug);
      if (sub) return sub.name;
    }
    for (const [slug, entry] of Object.entries(masterCategories)) {
      if (entry.subcategories.some((s) => s.toLowerCase().replace(/\s+/g, "-") === optionSlug.toLowerCase().replace(/\s+/g, "-"))) {
        const match = entry.subcategories.find((s) => s.toLowerCase().replace(/\s+/g, "-") === optionSlug.toLowerCase().replace(/\s+/g, "-"));
        if (match) return match;
      }
    }
    return optionSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /* Fetch groups + paid stats */
  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    // Constrained to the current user's payments — firestore.rules only allow
    // reading payments where uid/phone matches the authenticated user.
    const unsub = onSnapshot(
      collection(db, "groups"),
      async (snapshot) => {
        // Payments are BEST-EFFORT on the dashboard. The payments list query is
        // rule-gated to phone-verified ID tokens (isOwnDoc), so Google/email
        // logins without a phone claim are denied here. That denial must NEVER
        // stop groups/matches from rendering — so fetch payments separately and
        // keep paid-state badges as a graceful fallback.
        let paidGroups = new Set<string>();
        let paidCount = 0;
        let paidTotal = 0;
        try {
          const paymentsSnap = await getDocs(
            query(collection(db, "payments"), where("uid", "==", phone))
          );
          paymentsSnap.forEach((p) => {
            const pdata = p.data() as any;
            if (pdata.uid === phone && (pdata.status === "paid" || pdata.paid === true)) {
              paidGroups.add(pdata.groupId);
              paidCount++;
              paidTotal += Number(pdata.amount || 29);
            }
          });
          setPaidStats({ count: paidCount, total: paidTotal });
        } catch (err) {
          // Non-fatal: paid badges fall back to unpaid; payment/chat unlock still
          // works through the server-side /api/verify-chat-access (admin SDK).
          console.warn(
            "Payments lookup skipped:",
            (err as any)?.code || (err as any)?.message || err
          );
        }

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
            collaboratorBrand: data.collaboratorBrand || "",
            collaboratorId: data.collaboratorId || "",
            state: data.state || "",
            district: data.district || "",
            city: data.city || "",
          });
        });

        groups.sort((a, b) => {
          const aExpired = isExpired(a.createdAt);
          const bExpired = isExpired(b.createdAt);
          if (aExpired && !bExpired) return 1;
          if (!aExpired && bExpired) return -1;
          const aExpiring = getExpiryStatus(a.createdAt).status === "expiring-soon";
          const bExpiring = getExpiryStatus(b.createdAt).status === "expiring-soon";
          if (!aExpiring && !bExpiring) return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
          if (aExpiring && !bExpiring) return 1;
          if (!aExpiring && bExpiring) return -1;
          return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
        });
        setMatches(groups);
        setLoading(false);
      },
      (err) => {
        console.error("Groups listener error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [phone]);

  /* Latest selection */
  useEffect(() => {
    if (!phone) return;
    const loadSelection = async () => {
      try {
        const snap = await getDocs(collection(db, "selections"));
        const list = snap.docs.map((d) => d.data());
        const mine = list.filter((s: any) => s.phone === phone);
        mine.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        if (mine.length > 0) setLatestSelection(mine[0]);
      } catch (err) {
        console.error(err);
      }
    };
    loadSelection();
  }, [phone]);

  /* Delete match (SOFT delete — My Matches retention) */
  const deleteMatch = async (groupId: string) => {
    if (!confirm("Remove this match from your list?")) return;
    try {
      // `groups` updates are ADMINS ONLY in firestore.rules, so the removal
      // goes through the Admin-SDK API (same pattern as /api/join-group).
      // The server performs a SOFT delete: the group doc is never physically
      // deleted (it is the source of truth for other members' My Matches
      // history) — only the caller's membership is removed and recorded in
      // deletedByUsers / deletedByUserAt for auditability.
      const currentUser = auth.currentUser;
      if (!currentUser) {
        toast.error("Please log in again");
        return;
      }
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/remove-match", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Remove it from this user's view only; other members are unaffected.
      setMatches((prev: any[]) => prev.filter((g) => g.id !== groupId));
      toast.success("Match removed");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove");
    }
  };

  /* No login */
  if (!phone) {
    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto text-white">
        <h1 className="text-4xl font-bold text-[#D4AF37]">My Partners</h1>
        <p className="mt-5 text-gray-400">Please login first.</p>
      </div>
    );
  }

  /* Loading */
  if (loading) return <DashboardSkeleton />;

  const activeMatches = matches.filter(g => !isExpired(g.createdAt)).length;
  const pendingRequests = matches.filter(g => {
    if (isExpired(g.createdAt)) return false;
    if (g.isPaid) return false;
    if (!userProfile?.state) return g.membersCount < g.requiredSize;
    const info = computeGroupMatch(g.members, g.category, g.option);
    return info.matchingCount < g.requiredSize;
  }).length;
  const completedPartnerships = matches.filter(g => g.isPaid || g.status === "completed" || g.status === "expired" || isExpired(g.createdAt)).length;
  const totalSavings = paidStats.total;
  const readyMatches = matches.filter(g => {
    if (isExpired(g.createdAt)) return false;
    if (g.isPaid) return false;
    if (!userProfile?.state) return g.membersCount >= g.requiredSize;
    const info = computeGroupMatch(g.members, g.category, g.option);
    return info.matchingCount >= g.requiredSize;
  }).length;

  const pendingGroups = matches.filter(g => !isExpired(g.createdAt) && !g.isPaid && !(userProfile?.state ? computeGroupMatch(g.members, g.category, g.option).matchingCount >= g.requiredSize : g.membersCount >= g.requiredSize));
  const readyGroups = matches.filter(g => !isExpired(g.createdAt) && !g.isPaid && (userProfile?.state ? computeGroupMatch(g.members, g.category, g.option).matchingCount >= g.requiredSize : g.membersCount >= g.requiredSize));
  const completedGroups = matches.filter(g => g.isPaid || g.status === "completed" || g.status === "expired" || isExpired(g.createdAt));

  /* Group card renderer */
  const renderGroupCard = (group: Group, idx: number, section: "pending" | "ready" | "completed") => {
    const matchInfo = userProfile?.state
      ? computeGroupMatch(group.members, group.category, group.option)
      : { matchingCount: 0, matchLevel: "none" as const };
    const matchingCount = section === "completed" ? group.membersCount : matchInfo.matchingCount;
    const required = group.requiredSize;
    const isSearching = matchingCount <= 1;
    const expiry = getExpiryStatus(group.createdAt);
    const statusInfo = getGroupStatus(group, matchingCount, required);
    const isPaid = group.isPaid;
    const isExpiredGroup =
      group.status === "expired" ||
      isExpired(group.createdAt);
    const businessName = group.collaboratorBrand || group.collaboratorId || latestSelection?.collaboratorName || latestSelection?.collaboratorId || "";
    // Two-line My Matches hierarchy:
    //   Line 1: State → District → City
    //   Line 2: Category → Subcategory → Gym/Group (when one was selected)
    const locLine =
      [
        group.state || userProfile?.state || "",
        group.district || userProfile?.district || "",
        group.city || userProfile?.city || group.members?.[0]?.city || "",
      ]
        .filter(Boolean)
        .join(" → ") || "Location not set";
    const hierarchyLine =
      `${getCategoryDisplayName(group.category)} → ${getSubcategoryDisplayName(group.category, group.option)}` +
      (businessName ? ` → ${businessName}` : "");

    return (
      <motion.div
        key={group.id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05 }}
        className="card-premium p-0 overflow-hidden"
      >
        <div className="p-5">
          {/* Header: Title + Status */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white font-heading leading-tight">
                {getSubcategoryDisplayName(group.category, group.option)}
              </h3>
              <p className="text-[11px] text-gray-300 mt-1 flex items-center gap-1 flex-wrap">
                <svg className="w-3 h-3 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {locLine}
              </p>
              <p className="text-[11px] text-[#D4AF37] mt-0.5 break-words">{hierarchyLine}</p>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${statusInfo.color}`}>
              {statusInfo.label}
            </div>
          </div>

          {/* Divider */}
          <div className="section-divider-light mb-3" />

          {/* Progress */}
          {!isPaid && !isExpiredGroup && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-gray-400">
                  {isSearching ? (
                    <span className="text-blue-400">🔍 Searching...</span>
                  ) : matchingCount >= required ? (
                    <span className="text-green-400">✅ Group Complete</span>
                  ) : (
                    <span className="text-yellow-400">👥 Building group</span>
                  )}
                </span>
                <span className="text-gray-500">{matchingCount}/{required} members</span>
              </div>
              <div className="progress-bar">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${matchingCount >= required ? 'progress-complete' : expiry.status === 'expiring-soon' ? 'progress-expiring' : 'progress-active'}`}
                  style={{ width: `${Math.min((matchingCount / required) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Payment status */}
          <div className="flex items-center gap-2 text-[11px] mb-2">
            {isPaid ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                💳 Payment: Completed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                💳 Payment: Pending
              </span>
            )}
            {isPaid ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                💬 Chat: Unlocked
              </span>
            ) : null}
          </div>

          {/* Created date */}
          <div className="text-[10px] text-gray-500">
            {group.createdAt?.seconds && (
              <span>Created: {formatDate(group.createdAt)}</span>
            )}
          </div>
        </div>

        {/* Actions footer */}
        <div className="border-t border-white/5 px-5 py-3 flex gap-2 flex-wrap bg-black/20">
          {!isPaid ? (
            isExpiredGroup ? (
              <button disabled className="px-4 py-2 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold cursor-not-allowed">
                ⌛ Match expired
              </button>
            ) : matchingCount >= required ? (
              <button onClick={() => (window.location.href = `/payment?groupId=${group.id}`)}
                className="btn-primary text-xs px-4 py-2">
                🔓 Unlock for ₹29
              </button>
            ) : (
              <button disabled className="px-4 py-2 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold cursor-not-allowed">
                ⏳ Waiting for members
              </button>
            )
          ) : (
            <button onClick={() => router.push(`/chat/${group.id}`)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-xs font-bold hover:scale-105 transition">
              💬 Open Chat
              {(unreadCounts[group.id] || 0) > 0 && <span className="ml-2">💬 {unreadCounts[group.id]}</span>}
            </button>
          )}
          <button onClick={() => deleteMatch(group.id)}
            className="px-4 py-2 rounded-xl bg-red-600/15 border border-red-500/20 text-red-400 text-xs font-bold hover:scale-105 transition">
            ❌ Remove
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="pt-28 px-6 max-w-5xl mx-auto text-white pb-mobile-cta">
      <Seo
        title="My Partners"
        description="View your active matches, pending requests, and completed partnerships on PartnerSync."
        canonicalPath="/dashboard"
      />
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl sm:text-4xl font-bold text-[#D4AF37]"
      >
        My Partners
      </motion.h1>

      <p className="text-gray-400 text-sm mt-2">
        <span className="text-gray-500">Your ID: {myUserId}</span>
      </p>

      {/* Top statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        <div className="card-glass-premium p-5 text-center hover:border-blue-500/30 transition-all duration-300">
          <p className="text-3xl font-bold text-blue-400">{activeMatches}</p>
          <p className="text-xs text-gray-400 mt-1">Active Matches</p>
        </div>
        <div className="card-glass-premium p-5 text-center hover:border-yellow-500/30 transition-all duration-300">
          <p className="text-3xl font-bold text-yellow-400">{pendingRequests}</p>
          <p className="text-xs text-gray-400 mt-1">Pending Requests</p>
        </div>
        <div className="card-glass-premium p-5 text-center hover:border-green-500/30 transition-all duration-300">
          <p className="text-3xl font-bold text-green-400">{completedPartnerships}</p>
          <p className="text-xs text-gray-400 mt-1">Completed Partnerships</p>
        </div>
        <div className="card-glass-premium p-5 text-center hover:border-[#D4AF37]/30 transition-all duration-300">
          <p className="text-3xl font-bold text-[#D4AF37]">₹{totalSavings.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Savings</p>
        </div>
      </motion.div>

      <StatsCards activeMatches={activeMatches} readyMatches={readyMatches} nearbyCount={nearbyPartners.length} />

      {/* Empty state */}
      {matches.length === 0 && (
        <>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 card-glass-premium p-8 text-center max-w-lg mx-auto">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold text-[#D4AF37] mb-2">Finding Compatible Members</h3>
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full rounded-full progress-active"
                initial={{ width: "0%" }}
                animate={{ width: "65%" }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
              />
            </div>
            <p className="text-sm text-gray-400 mb-2">
              Expected Match: <span className="text-[#D4AF37] font-medium">2-6 Hours</span>
            </p>
            <p className="text-xs text-gray-500">👥 {nearbyPartners.length} People Currently Searching</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/find-partners" className="btn-primary text-sm">Find Partners</Link>
              <Link href="/create-group" className="px-6 py-3 rounded-xl border border-white/20 text-sm font-semibold hover:bg-white/5 transition">
                Create Group
              </Link>
            </div>
          </motion.div>
          <EmptyState nearbyCount={nearbyPartners.length} />
        </>
      )}

      {/* Sections */}
      {matches.length > 0 && (
        <div className="mt-6 space-y-8">
          {/* Pending Requests */}
          {pendingGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#FFD166] mb-4 flex items-center gap-2">
                <span className="text-yellow-400">⏳</span> Pending Requests
                <span className="text-xs text-gray-500 font-normal">({pendingGroups.length})</span>
              </h2>
              <div className="space-y-4">
                {pendingGroups.map((group, idx) => renderGroupCard(group, idx, "pending"))}
              </div>
            </div>
          )}

          {/* Active Partnerships */}
          {readyGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#FFD166] mb-4 flex items-center gap-2">
                <span className="text-green-400">✅</span> Active Partnerships
                <span className="text-xs text-gray-500 font-normal">({readyGroups.length})</span>
              </h2>
              <div className="space-y-4">
                {readyGroups.map((group, idx) => renderGroupCard(group, idx, "ready"))}
              </div>
            </div>
          )}

          {/* Completed Partnerships */}
          {completedGroups.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-[#FFD166] mb-4 flex items-center gap-2">
                <span className="text-emerald-400">🏆</span> Completed & Past Partnerships
                <span className="text-xs text-gray-500 font-normal">({completedGroups.length})</span>
              </h2>
              <div className="space-y-4">
                {completedGroups.map((group, idx) => renderGroupCard(group, idx, "completed"))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nearby Candidates */}
      {userProfile?.state && nearbyPartners.length > 0 && (
        <div className="mt-12 mb-16">
          <motion.h2 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold text-[#D4AF37] mb-1">
            📍 Nearby Candidates
          </motion.h2>
          <p className="text-gray-400 text-xs mb-6">
            Potential matches near you. Identity remains hidden until payment unlocks.
          </p>

          <div className="space-y-4">
            {nearbyPartners.map((partner, idx) => {
              const uniqueDistance = partner.city
                ? partner.city === userProfile?.city
                  ? "📍 Same City"
                  : `${partner.city}, ${partner.state}`
                : partner.state;

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
                if (partner.compatReasons.length > 0) partner.compatReasons.forEach(r => whyReasons.push(r));
                else if (partner.matchLabel) whyReasons.push(`📍 ${partner.matchLabel}`);
              }

              return (
                <motion.div
                  key={partner.uid}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="card-premium p-4 border-l-4"
                  style={{ borderLeftColor: partner.compatibility >= 90 ? "#10b981" : partner.compatibility >= 75 ? "#3b82f6" : partner.compatibility >= 50 ? "#f59e0b" : "#6b7280" }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-xs font-bold flex-shrink-0">
                      {partner.userId.slice(-4)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-semibold text-sm font-mono">{partner.userId}</h3>
                        <span className="badge-verified text-[9px]">✓ Verified</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
                        {partner.category && <span className="text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">📁 {partner.category}</span>}
                        {partner.option && <span className="text-gray-300 bg-gray-800/50 px-2 py-0.5 rounded">🏷 {partner.option}</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs font-bold ${partner.compatibility >= 90 ? "text-green-400" : partner.compatibility >= 75 ? "text-blue-400" : partner.compatibility >= 50 ? "text-yellow-400" : "text-gray-400"}`}>
                          {partner.compatibility}% Compatible
                        </span>
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${partner.compatibility}%`,
                            background: partner.compatibility >= 90 ? "linear-gradient(90deg, #10b981, #34d399)" : partner.compatibility >= 75 ? "linear-gradient(90deg, #3b82f6, #60a5fa)" : partner.compatibility >= 50 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "linear-gradient(90deg, #6b7280, #9ca3af)"
                          }} />
                        </div>
                      </div>
                      {partner.compatReasons.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {partner.compatReasons.map((reason, i) => (
                            <span key={i} className="text-[9px] text-green-400/70 bg-green-500/5 px-1.5 py-0.5 rounded">{reason}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-[10px] text-gray-500 flex-wrap">
                        <span>📍 {uniqueDistance}</span>
                        {partner.distance && <span className="text-[9px] text-gray-400">📏 {partner.distance} KM Away</span>}
                        {partner.matchLabel && (
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${partner.matchTier <= 1 ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>
                            {partner.matchLabel}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Active in {partner.category || ""}{partner.option ? ` → ${partner.option}` : ""}
                      </div>
                      {whyReasons.length > 0 && (
                        <div className="mt-2 border border-green-500/10 bg-green-500/5 rounded-lg p-2">
                          <p className="text-[9px] text-green-400 font-medium mb-1">🎯 Why this match?</p>
                          <div className="flex flex-wrap gap-1">
                            {whyReasons.map((reason, i) => (
                              <span key={i} className="text-[8px] text-gray-400 bg-gray-800/50 px-1.5 py-0.5 rounded">{reason}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => startMatch(partner)}
                        disabled={startingMatch === partner.uid}
                        className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black hover:scale-105 transition disabled:opacity-50"
                      >
                        {startingMatch === partner.uid ? "Sending..." : "Start Match"}
                      </button>
                      <button
                        onClick={() => router.push("/find-partners")}
                        className="px-3 py-1.5 rounded-lg text-[9px] bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition"
                      >
                        View All
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      <div className="sticky-bottom-cta">
        <Link href="/find-partners" className="block w-full text-center py-3 rounded-xl font-bold bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black text-sm">
          Find Partners
        </Link>
      </div>
    </div>
  );
}