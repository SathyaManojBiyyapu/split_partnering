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

  /* Compute matching members in a group based on current user's location */
  /* Members are already in the same group (same category+option).
     A member counts toward progress ONLY if state, district, AND city all match. */
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

    let count = 0;

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
      matchLevel: count > 0 ? "same-city" : "none",
    };
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
                  "",

                option:
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

      {/* ===== NEARBY PARTNERS (LOCATION-BASED) ===== */}

      {userProfile?.state && nearbyPartners.length > 0 && (

        <div className="mt-12">

          <h2 className="text-2xl font-bold text-[#FFD166] mb-2">
            📍 Nearby Partners
          </h2>

          <p className="text-gray-400 text-sm mb-6">
            Potential matches in your area based on location proximity.
          </p>

          <div className="space-y-4">

            {nearbyPartners.map(
              (partner, idx) => (
                <div
                  key={idx}
                  className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">

                    <img
                      src={
                        partner.photoURL ||
                        "https://ui-avatars.com/api/?background=000000&color=FFD166&name=User"
                      }
                      alt=""
                      className="w-12 h-12 rounded-full border border-[#FFD166]"
                    />

                    <div>

                      <p className="font-bold text-white">
                        {partner.name}
                      </p>

                      <p className="text-xs text-gray-400 mt-0.5">
                        {partner.city}
                        {partner.city && partner.district ? ", " : ""}
                        {partner.district}
                        {" • "}
                        {partner.state}
                      </p>

                      <p className="text-[10px] text-[#FFD166] mt-0.5">
                        {partner.matchLevel === "same-city"
                          ? "⭐ Same City"
                          : partner.matchLevel === "same-district"
                          ? "📌 Same District"
                          : "📍 Same State"}
                      </p>

                    </div>

                  </div>

                  <span
                    className={`text-[10px] px-3 py-1 rounded-full font-bold ${
                      partner.matchLevel === "same-city"
                        ? "bg-green-600 text-white"
                        : partner.matchLevel === "same-district"
                        ? "bg-yellow-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {partner.matchLevel === "same-city"
                      ? "Best Match"
                      : partner.matchLevel === "same-district"
                      ? "Good Match"
                      : "Nearby"}
                  </span>

                </div>
              )
            )}

          </div>

        </div>
      )}

      {matches.length === 0 ? (

        <p className="mt-8 text-gray-400">
          No partners saved yet.
        </p>

      ) : (

        <div className="mt-10 space-y-5">

          {matches.map(
            (group) => (

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

                {/* TOP */}

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

                    <p className="mt-2 text-sm text-gray-400">

                      {userProfile?.state
                        ? (() => {
                            const result = computeGroupMatch(
                              group.members,
                              group.category,
                              group.option
                            );
                            const matchingCount = result.matchingCount;
                            const matchLevel = result.matchLevel;
                            const required = group.requiredSize;
                            const isReady = matchingCount >= required;

                            return (
                              <>
                                <span>
                                  Progress: {Math.min(matchingCount, required)} / {required}
                                </span>
                                {matchingCount > 0 && (
                                  <span className="block text-[10px] mt-1 text-green-400">
                                    ✓ Exact Location Match — Same City
                                  </span>
                                )}
                                {matchingCount === 0 && userProfile.state && (
                                  <span className="block text-[10px] text-yellow-400 mt-1">
                                    ⏳ Waiting for location-matched partners
                                  </span>
                                )}
                              </>
                            );
                          })()
                        : `Progress: ${group.membersCount} / ${group.requiredSize}`
                      }

                    </p>

                  </div>

                  <div
                    className={`px-4 py-2 rounded-full text-xs font-bold ${
                      group.status ===
                      "completed"
                        ? "bg-blue-600"
                        : (() => {
                            if (!userProfile?.state) {
                              return group.status === "ready"
                                ? "bg-green-600"
                                : "bg-yellow-500 text-black";
                            }
                            const result = computeGroupMatch(
                              group.members,
                              group.category,
                              group.option
                            );
                            return result.matchingCount >= group.requiredSize
                              ? "bg-green-600"
                              : isExpired(group.createdAt, group.category)
                              ? "bg-red-600"
                              : "bg-yellow-500 text-black";
                          })()
                    }`}
                  >

                    {isExpired(
                      group.createdAt,
                      group.category
                    )
                      ? "Expired"
                      : (() => {
                          if (!userProfile?.state) {
                            return group.status === "ready"
                              ? "Ready for payment"
                              : group.status;
                          }
                          const result = computeGroupMatch(
                            group.members,
                            group.category,
                            group.option
                          );
                          return result.matchingCount >= group.requiredSize
                            ? "Ready for payment"
                            : "Waiting";
                        })()}

                  </div>

                </div>

                {/* LOCKED */}

                {!group.isPaid && (

                  <div
                    className="
                      mt-5
                      rounded-2xl
                      border border-yellow-500/30
                      bg-yellow-500/10
                      p-5
                    "
                  >

                    <p className="text-yellow-400 text-lg font-bold">
                      🔒 Partner Details Locked
                    </p>

                    <p className="mt-2 text-xs text-yellow-300">
                      Secure payment required to unlock
                      members and private coordination.
                    </p>

                    <p className="text-sm text-gray-400 mt-2 leading-relaxed">

                      Complete the ₹29 payment
                      to unlock partner details,
                      private chat access,
                      and full coordination tools.

                    </p>

                  </div>
                )}

                {/* MEMBERS AFTER PAYMENT */}

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
                      onClick={() =>
                        router.push(
                          `/chat/${group.id}`
                        )
                      }
                      className="
                        px-5 py-2 rounded-xl
                        bg-green-600
                        font-bold
                        hover:scale-105
                        transition
                      "
                    >

                      Open Chat

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
            )
          )}

        </div>
      )}

    </div>
  );
}