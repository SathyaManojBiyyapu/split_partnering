"use client";

import {
  useEffect,
  useState,
} from "react";

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

import { isExpired } from "@/app/data/matchExpiry";

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
  matchLevel: "same-city" | "same-district" | "same-state";
  groupId: string;
};

export default function DashboardPage() {

  const router =
    useRouter();

  const [matches, setMatches] =
    useState<Group[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    latestSelection,
    setLatestSelection,
  ] = useState<any>(null);

  const [unreadCounts, setUnreadCounts] =
    useState<Record<string, number>>({});

  /* USER */

  const rawPhone =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "phone"
        )
      : null;

  const phone =
    rawPhone?.trim() || null;

  /* LOCATION-BASED MATCHING */

  const [userProfile, setUserProfile] =
    useState<any>(null);

  const [nearbyPartners, setNearbyPartners] =
    useState<PartnerMatch[]>([]);

  /* COUNTDOWN TIMER STATE */
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000); // update every minute
    return () => clearInterval(interval);
  }, []);

  /* Compute matching members in a group based on current user's location */
  /* FIX: Self always counts as 1. Additional location-matched members add to count. */
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

    /* Self always counts as 1 */
    let count = 1;

    for (const m of groupMembers) {
      const member = typeof m === "string" ? { phone: m } : m;

      /* Skip self */
      if (member.phone?.trim() === phone) continue;

      const mState = member.state || "";
      const mDistrict = member.district || "";
      const mCity = member.city || "";

      /* REQUIRE ALL THREE: state, district, city must match the current user */
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

  /* Compute countdown display */
  function getCountdown(createdAt: any): string {
    if (!createdAt?.seconds) return "";
    const created = new Date(createdAt.seconds * 1000);
    const expiresAt = new Date(created.getTime() + 72 * 60 * 60 * 1000); // 72 hours
    const diff = expiresAt.getTime() - now;

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  /* Progress bar component */
  function ProgressBar({ current, max }: { current: number; max: number }) {
    const percent = Math.min((current / max) * 100, 100);
    const barColor = percent >= 100 ? "bg-green-500" : "bg-[#FFD166]";
    return (
      <div className="mt-2">
        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${percent}%` }}
          ></div>
        </div>
        <p className="text-[11px] text-gray-500 mt-0.5">{Math.round(percent)}% complete</p>
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

  function getStatusColor(group: Group, matchingCount: number, required: number): string {
    if (isExpired(group.createdAt, group.category)) return "bg-red-600";
    if (group.isPaid) return "bg-emerald-500";
    if (matchingCount >= required) return "bg-green-600";
    if (matchingCount <= 1) return "bg-blue-600";
    return "bg-yellow-500 text-black";
  }

  function getStatusLabel(group: Group, matchingCount: number, required: number): string {
    if (isExpired(group.createdAt, group.category)) return "Expired";
    if (group.isPaid) return "Paid";
    if (matchingCount >= required) return "Ready for payment";
    if (matchingCount <= 1) return "Searching";
    return "Waiting";
  }

  /* Match quality badge */
  function getMatchBadge(matchLevel: string): { label: string; stars: string; color: string } {
    switch (matchLevel) {
      case "same-city":
        return { label: "Perfect Match", stars: "★★★★★", color: "text-green-400" };
      case "same-district":
        return { label: "Strong Match", stars: "★★★★", color: "text-yellow-400" };
      default:
        return { label: "Regional Match", stars: "★★", color: "text-blue-400" };
    }
  }

  useEffect(() => {

    if (!phone) {

      return;
    }

    const loadNearby =
      async () => {

        try {

          /* FETCH CURRENT USER PROFILE */

          const userRef =
            doc(
              db,
              "users",
              phone
            );

          const userSnap =
            await getDoc(
              userRef
            );

          if (
            !userSnap.exists()
          )
            return;

          const me =
            userSnap.data() as any;

          setUserProfile(me);

          if (
            !me.state
          )
            return;

          /* FETCH USERS IN SAME STATE ONLY */

          const usersSnap =
            await getDocs(
              query(
                collection(
                  db,
                  "users"
                ),
                where(
                  "state",
                  "==",
                  me.state
                )
              )
            );

          const partners: PartnerMatch[] =
            [];

          const currentUserPhone =
            phone;

          usersSnap.forEach(
            (uDoc) => {

              const u =
                uDoc.data() as any;

              if (
                u.phone ===
                  currentUserPhone
              )
                return;

              if (
                !u.state
              )
                return;

              let matchLevel:
                "same-city" | "same-district" | "same-state" =
                  "same-state";

              /* PRIORITY: Same City = Highest */

              if (
                u.city &&
                me.city &&
                u.city ===
                  me.city
              ) {

                matchLevel =
                  "same-city";

              } else if (

                /* Same District = High */

                u.district &&
                me.district &&
                u.district ===
                  me.district
              ) {

                matchLevel =
                  "same-district";
              }

              partners.push({

                uid:
                  u.phone,

                name:
                  u.name ||
                  "User",

                phone:
                  u.phone,

                city:
                  u.city ||
                  "",

                district:
                  u.district ||
                  "",

                state:
                  u.state,

                photoURL:
                  u.photoURL ||
                  "",

                category:
                  u.category ||
                  "",

                option:
                  u.option ||
                  "",

                matchLevel,

                groupId:
                  "",
              });
            }
          );

          /* SORT: same-city first, then same-district, then same-state */

          const priority: Record<string, number> = {
            "same-city": 0,
            "same-district": 1,
            "same-state": 2,
          };

          partners.sort(
            (a, b) =>
              (priority[a.matchLevel] || 0) -
              (priority[b.matchLevel] || 0)
          );

          setNearbyPartners(
            partners
          );

        } catch (err) {

          console.error(
            "Matching error:",
            err
          );
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

    const unsub =
      onSnapshot(
        collection(db, "groups"),

        async (snapshot) => {

          try {

            const paymentsSnap =
              await getDocs(
                collection(
                  db,
                  "payments"
                )
              );

            const paidGroups =
              new Set<string>();

            paymentsSnap.forEach(
              (p) => {

                const pdata =
                  p.data();

                if (
                  pdata.uid ===
                    phone &&
                  (
                    pdata.status ===
                      "paid" ||
                    pdata.paid ===
                      true
                  )
                ) {

                  paidGroups.add(
                    pdata.groupId
                  );
                }
              }
            );

            const groups: Group[] =
              [];

            snapshot.forEach(
              (docSnap) => {

                const data =
                  docSnap.data() as any;

                const members =
                  Array.isArray(
                    data.members
                  )
                    ? data.members
                    : [];

                const hasPhone =
                  members.some(
                    (
                      m: any
                    ) => {

                      if (
                        typeof m ===
                        "string"
                      ) {

                        return (
                          m.trim() ===
                          phone
                        );
                      }

                      return (
                        m?.phone
                          ?.trim() ===
                        phone
                      );
                    }
                  );

                const hasUID =
                  Array.isArray(
                    data.memberUIDs
                  ) &&
                  data.memberUIDs.includes(
                    phone
                  );

                if (
                  !hasPhone &&
                  !hasUID
                ) {

                  return;
                }

                groups.push({

                  id:
                    docSnap.id,

                  category:
                    data.category ||
                    "Unknown",

                  option:
                    data.option ||
                    "Unknown",

                  members,

                  membersCount:
                    data.membersCount ||
                    members.length,

                  requiredSize:
                    data.requiredSize ||
                    0,

                  status:
                    data.status ||
                    "waiting",

                  createdAt:
                    data.createdAt,

                  isPaid:
                    paidGroups.has(
                      docSnap.id
                    ),
                });
              }
            );

            groups.sort(
              (a, b) =>
                (b.createdAt
                  ?.seconds ||
                  0) -
                (a.createdAt
                  ?.seconds ||
                  0)
            );

            setMatches(groups);

          } catch (err) {

            console.error(
              err
            );
          }

          setLoading(false);
        }
      );

    return () =>
      unsub();

  }, [phone]);

  /* LATEST SELECTION */

  useEffect(() => {

    if (!phone)
      return;

    const loadSelection =
      async () => {

        try {

          const snap =
            await getDocs(
              collection(
                db,
                "selections"
              )
            );

          const list =
            snap.docs.map(
              (d) =>
                d.data()
            );

          const mine =
            list.filter(
              (s: any) =>
                s.phone ===
                phone
            );

          mine.sort(
            (a: any, b: any) =>
              (b.createdAt
                ?.seconds ||
                0) -
              (a.createdAt
                ?.seconds ||
                0)
          );

          if (
            mine.length >
            0
          ) {

            setLatestSelection(
              mine[0]
            );
          }

        } catch (err) {

          console.error(
            err
          );
        }
      };

    loadSelection();

  }, [phone]);

  /* DELETE MATCH */

  const deleteMatch =
    async (
      groupId: string
    ) => {

      const ok =
        confirm(
          "Remove this match?"
        );

      if (!ok)
        return;

      try {

        const gRef =
          doc(
            db,
            "groups",
            groupId
          );

        const snap =
          await getDoc(
            gRef
          );

        if (
          !snap.exists()
        )
          return;

        const data =
          snap.data() as any;

        const members =
          data.members ||
          [];

        const removeMember =
          members.find(
            (
              m: any
            ) => {

              if (
                typeof m ===
                "string"
              ) {

                return (
                  m.trim() ===
                  phone
                );
              }

              return (
                m?.phone ===
                phone
              );
            }
          );

        const newCount =
          Math.max(
            0,
            (
              data.membersCount ||
              members.length
            ) - 1
          );

        await updateDoc(
          gRef,
          {

            members:
              arrayRemove(
                removeMember
              ),

            memberUIDs:
              arrayRemove(
                phone
              ),

            membersCount:
              newCount,
          }
        );

        if (
          newCount ===
          0
        ) {

          await deleteDoc(
            gRef
          );
        }

        alert(
          "Removed successfully"
        );

      } catch (err) {

        console.error(
          err
        );

        alert(
          "Failed to remove"
        );
      }
    };

  /* NO LOGIN */

  if (!phone) {

    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto text-white">

        <h1 className="text-4xl font-bold text-[#FFD166]">
          My Partners
        </h1>

        <p className="mt-5 text-gray-400">
          Please login first.
        </p>

      </div>
    );
  }

  /* LOADING */

  if (loading) {

    return (
      <div className="pt-32 px-6 max-w-5xl mx-auto text-white">

        <h1 className="text-4xl font-bold text-[#FFD166]">
          My Partners
        </h1>

        <p className="mt-5 text-gray-400">
          Loading...
        </p>

      </div>
    );
  }

  /* Compute summary stats */
  const activeMatches = matches.filter(g => !isExpired(g.createdAt, g.category)).length;
  const readyMatches = matches.filter(g => {
    if (isExpired(g.createdAt, g.category)) return false;
    if (g.isPaid) return false;
    if (!userProfile?.state) return g.membersCount >= g.requiredSize;
    const info = computeGroupMatch(g.members, g.category, g.option);
    return info.matchingCount >= g.requiredSize;
  }).length;

  return (

    <div className="pt-32 px-6 max-w-5xl mx-auto text-white">

      <h1 className="text-4xl font-bold text-[#FFD166]">
        My Partners
      </h1>

      {latestSelection && (

        <p className="mt-4 text-gray-400">

          Latest selection:

          <span className="text-[#FFD166] font-bold ml-2">

            {
              latestSelection.category
            }

            {" → "}

            {
              latestSelection.option
            }

          </span>

        </p>
      )}

      {/* ===== SECTION 9: DASHBOARD SUMMARY CARDS ===== */}

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0c0c0c] border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{activeMatches}</p>
          <p className="text-xs text-gray-400 mt-1">Active Matches</p>
        </div>
        <div className="bg-[#0c0c0c] border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{readyMatches}</p>
          <p className="text-xs text-gray-400 mt-1">Ready to Unlock</p>
        </div>
        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-[#FFD166]">{nearbyPartners.length}</p>
          <p className="text-xs text-gray-400 mt-1">Nearby Candidates</p>
        </div>
      </div>

      {matches.length === 0 ? (

        <p className="mt-8 text-gray-400">
          No partners saved yet.
        </p>

      ) : (

        <div className="mt-6 space-y-5">

          {matches.map(
            (group) => {

              /* Pre-compute match info for this group */
              const matchInfo = userProfile?.state
                ? computeGroupMatch(
                    group.members,
                    group.category,
                    group.option
                  )
                : { matchingCount: 0, matchLevel: "none" as const };
              const matchingCount = matchInfo.matchingCount;
              const required = group.requiredSize;
              const isReady = userProfile?.state
                ? matchingCount >= required
                : group.membersCount >= group.requiredSize;
              const isSearching = matchingCount <= 1;
              const countdown = getCountdown(group.createdAt);
              const statusColor = getStatusColor(group, matchingCount, required);
              const statusLabel = getStatusLabel(group, matchingCount, required);
              const matchBadge = getMatchBadge(matchInfo.matchLevel);

              return (
              <div
                key={group.id}
                className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-2xl p-5"
              >

                {/* EXPIRY BANNER */}

                {isExpired(
                  group.createdAt,
                  group.category
                ) && (
                  <div className="mb-3 px-4 py-2 bg-red-900/30 border border-red-500/30 rounded-xl text-center">
                    <p className="text-red-400 text-xs font-bold">
                      ⏰ This match has expired
                    </p>
                  </div>
                )}

                {/* ===== SECTION 1: MY ACTIVE MATCH ===== */}

                <div className="flex justify-between items-center flex-wrap gap-3">

                  <div>

                    <h2 className="text-2xl font-bold text-[#FFD166]">

                      {
                        group.category
                      }

                      {" → "}

                      {
                        group.option
                      }

                    </h2>

                    {/* ===== SECTION 2: MATCH PROGRESS ===== */}

                    <p className="mt-2 text-sm text-gray-400">

                      {userProfile?.state
                        ? (() => {

                            return (
                              <>
                                <span>
                                  Progress: {Math.min(matchingCount, required)} / {required}
                                </span>
                                {matchingCount > 1 && (
                                  <span className="block text-[10px] mt-1 text-green-400">
                                    ✓ Exact Location Match — Same City
                                  </span>
                                )}
                                {matchingCount <= 1 && userProfile.state && (
                                  <span className="block text-[10px] text-blue-400 mt-1">
                                    🔍 Searching for compatible partners in your city...
                                  </span>
                                )}
                              </>
                            );
                          })()
                        : `Progress: ${Math.min(group.membersCount, group.requiredSize)} / ${group.requiredSize}`
                      }

                    </p>

                    {/* VISUAL PROGRESS BAR */}
                    {userProfile?.state ? (
                      <ProgressBar current={matchingCount} max={required} />
                    ) : (
                      <ProgressBar current={group.membersCount} max={group.requiredSize} />
                    )}

                    {/* COUNTDOWN TIMER */}
                    {group.createdAt && !isExpired(group.createdAt, group.category) && (
                      <p className="text-[10px] text-gray-500 mt-2">
                        ⏱ Match expires in: <span className="text-gray-300 font-medium">{countdown}</span>
                      </p>
                    )}

                  </div>

                  <div className={`px-4 py-2 rounded-full text-xs font-bold ${statusColor}`}>
                    {statusLabel}
                  </div>

                </div>

                {/* ===== SECTION 3: CANDIDATE STATUS (Before Payment) ===== */}

                {!group.isPaid && (
                  (() => {

                    if (matchingCount > 1) {
                      return (
                        <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
                          <p className="text-green-400 text-lg font-bold flex items-center gap-2">
                            ✅ Possible Candidate Found
                          </p>
                          <div className="mt-3 space-y-1.5 text-sm text-gray-300">
                            <p>
                              <span className="text-[#FFD166] font-medium">Category:</span>{" "}
                              {group.category}
                            </p>
                            <p>
                              <span className="text-[#FFD166] font-medium">Brand:</span>{" "}
                              {group.option}
                            </p>
                            <p>
                              <span className="text-[#FFD166] font-medium">Location Match:</span>{" "}
                              Same City
                            </p>
                            <p>
                              <span className="text-[#FFD166] font-medium">Status:</span>{" "}
                              {isReady ? "Ready for Unlock" : "Candidate Ready"}
                            </p>
                          </div>
                          {isReady && (
                            <p className="mt-3 text-xs text-green-300">
                              ✓ Location-Matched Candidate Available
                            </p>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="mt-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                        <p className="text-blue-400 text-lg font-bold flex items-center gap-2">
                          🔍 Searching for compatible partners in your city...
                        </p>
                        <p className="mt-2 text-xs text-blue-300">
                          Average matching time: 12–48 hours
                        </p>
                        <p className="mt-1 text-[10px] text-blue-200/70">
                          We will notify you when a compatible partner joins.
                        </p>
                      </div>
                    );
                  })()
                )}

                {/* ===== SECTION 4: UNLOCK SECTION (Before Payment) ===== */}

                {!group.isPaid && isReady && (
                  <div className="mt-5 rounded-2xl border border-green-500/30 bg-green-900/20 p-5 text-center">
                    <p className="text-green-400 text-lg font-bold">
                      Ready for Unlock
                    </p>
                    <p className="mt-1 text-sm text-green-300">
                      Location-Matched Candidate Available
                    </p>
                    <p className="mt-3 text-xs text-gray-400">
                      Unlock to reveal partner identity and start chatting.
                    </p>
                  </div>
                )}

                {/* MEMBERS AFTER PAYMENT (Revealed only after payment) */}

                {group.isPaid && (

                  <div className="mt-5 space-y-3">

                    {group.members.map(
                      (
                        m: any,
                        i: number
                      ) => {

                        const member =
                          typeof m ===
                          "string"
                            ? {
                                name:
                                  "User",
                                phone:
                                  m,
                              }
                            : m;

                        return (

                          <div
                            key={i}
                            className="bg-black/40 rounded-xl p-4 flex items-center justify-between"
                          >

                            <div className="flex items-center gap-4">

                              <img
                                src={
                                  member.photoURL ||
                                  "https://ui-avatars.com/api/?background=000000&color=FFD166&name=User"
                                }
                                alt="user"
                                className="w-12 h-12 rounded-full border border-[#FFD166]"
                              />

                              <div>

                                <p className="font-bold">

                                  👤 {
                                    member.name ||
                                    "User"
                                  }

                                  <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-500"></span>

                                </p>

                                <p className="text-sm text-gray-400 mt-1">
                                  📞 {
                                    member.phone ||
                                    "N/A"
                                  }
                                </p>

                                <p className="text-xs text-gray-500 mt-1">
                                  Joined recently
                                </p>

                              </div>

                            </div>

                            <span
                              className={`text-xs font-bold ${
                                member.paid
                                  ? "text-green-400"
                                  : "text-red-400"
                              }`}
                            >
                              {
                                member.paid
                                  ? "PAID"
                                  : "NOT PAID"
                              }
                            </span>

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

                {/* ACTIONS */}

                <div className="flex gap-3 mt-5 flex-wrap">

                  {!group.isPaid ? (

                    isReady ? (
                      <button
                        onClick={() =>
                          window.location.href =
                            `/payment?groupId=${group.id}`
                        }
                        className="
                          px-5 py-2 rounded-xl
                          bg-[#FFD166]
                          text-black
                          font-bold
                          hover:scale-105
                          transition
                        "
                      >
                        🔓 Unlock for ₹29
                      </button>
                    ) : (
                      <button
                        disabled
                        className="
                          px-5 py-2 rounded-xl
                          bg-gray-700
                          text-gray-400
                          font-bold
                          cursor-not-allowed
                          transition
                        "
                      >
                        ⏳ Payment unlocks when group is complete
                      </button>
                    )

                  ) : (

                    <button
                      onClick={() =>
                        router.push(
                          `/chat/${group.id}`
                        )
                      }
                      className="
                        px-5 py-2 rounded-xl
                        bg-purple-600
                        font-bold
                        hover:scale-105
                        transition
                      "
                    >

                      💬 Open Chat

                      {(unreadCounts[group.id] || 0) > 0 && (
                        <span className="ml-2 text-xs">
                          💬 {unreadCounts[group.id]}
                        </span>
                      )}

                    </button>

                  )}

                  <button
                    onClick={() =>
                      deleteMatch(
                        group.id
                      )
                    }
                    className="
                      px-5 py-2 rounded-xl
                      bg-red-600
                      font-bold
                      hover:scale-105
                      transition
                    "
                  >
                    ❌ Remove Match
                  </button>

                </div>

              </div>
            );}
          )}

        </div>
      )}

      {/* ===== SECTION 5: NEARBY PARTNERS (at the bottom, secondary information) ===== */}

      {userProfile?.state && nearbyPartners.length > 0 && (

        <div className="mt-12 mb-10">

          <h2 className="text-2xl font-bold text-[#FFD166] mb-2">
            📍 Nearby Partners
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Other users in your area. Primary focus should be on your active matches above.
          </p>

          <div className="space-y-4">

            {nearbyPartners.map(
              (partner, idx) => {

                const badge = getMatchBadge(partner.matchLevel);

                return (
                <div
                  key={idx}
                  className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >

                  <div className="flex items-start gap-4">

                    {/* NO avatar image shown - privacy preserved */}

                    <div className="w-12 h-12 rounded-full border border-[#FFD166] flex items-center justify-center bg-black/40 shrink-0">
                      <span className="text-lg">📍</span>
                    </div>

                    <div className="min-w-0">

                      {/* NO real name shown - privacy preserved */}
                      <p className="font-bold text-white text-base">
                        Potential Match
                      </p>

                      {partner.category && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Category: <span className="text-[#FFD166]">{partner.category}</span>
                        </p>
                      )}

                      {partner.option && (
                        <p className="text-xs text-gray-400">
                          Brand: <span className="text-[#FFD166]">{partner.option}</span>
                        </p>
                      )}

                      <p className="text-xs text-gray-400 mt-0.5">
                        Location:
                        {" "}
                        {partner.city}
                        {partner.city && partner.district ? ", " : ""}
                        {partner.district}
                        {" • "}
                        {partner.state}
                      </p>

                      <p className={`text-[11px] ${badge.color} mt-1`}>
                        {badge.stars} {badge.label}
                      </p>

                    </div>

                  </div>

                  <span
                    className={`text-[10px] px-3 py-1 rounded-full font-bold shrink-0 self-start sm:self-center ${
                      partner.matchLevel === "same-city"
                        ? "bg-green-600 text-white"
                        : partner.matchLevel === "same-district"
                        ? "bg-yellow-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {partner.matchLevel === "same-city"
                      ? "★★★★★ Perfect Match"
                      : partner.matchLevel === "same-district"
                      ? "★★★★ Strong Match"
                      : "★★ Regional Match"}
                  </span>

                </div>
              );}
            )}

          </div>

        </div>
      )}

    </div>
  );
}