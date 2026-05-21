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
} from "firebase/firestore";

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

  /* -----------------------------------
      USER
  ----------------------------------- */

  const rawPhone =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "phone"
        )
      : null;

  const phone =
    rawPhone?.trim() || null;

  /* -----------------------------------
      FETCH GROUPS
  ----------------------------------- */

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

            const currentUID =
              auth.currentUser?.uid;

            /* PAYMENTS */

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
                    currentUID &&
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

                /* OLD STRING MEMBERS */

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

                /* UID MATCH */

                const hasUID =
                  currentUID &&
                  Array.isArray(
                    data.memberUIDs
                  ) &&
                  data.memberUIDs.includes(
                    currentUID
                  );

                /* OBJECT UID MATCH */

                const objectUID =
                  members.some(
                    (
                      m: any
                    ) => {

                      if (
                        typeof m ===
                        "string"
                      )
                        return false;

                      return (
                        m?.uid ===
                        currentUID
                      );
                    }
                  );

                if (
                  !hasPhone &&
                  !hasUID &&
                  !objectUID
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

            /* SORT */

            groups.sort(
              (a, b) =>
                (b.createdAt
                  ?.seconds ||
                  0) -
                (a.createdAt
                  ?.seconds ||
                  0)
            );

            console.log(
              "MY MATCHES:",
              groups
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

  /* -----------------------------------
      FETCH LATEST SELECTION
  ----------------------------------- */

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

  /* -----------------------------------
      DELETE MATCH
  ----------------------------------- */

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
                auth
                  .currentUser
                  ?.uid
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

  /* -----------------------------------
      NO LOGIN
  ----------------------------------- */

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

  /* -----------------------------------
      LOADING
  ----------------------------------- */

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

  /* -----------------------------------
      UI
  ----------------------------------- */

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

                      Progress:
                      {" "}

                      {
                        group.membersCount
                      }

                      /

                      {
                        group.requiredSize
                      }

                    </p>

                  </div>

                  <div
                    className={`px-4 py-2 rounded-full text-xs font-bold ${
                      group.status ===
                      "completed"
                        ? "bg-blue-600"
                        : group.status ===
                          "ready"
                        ? "bg-green-600"
                        : "bg-yellow-500 text-black"
                    }`}
                  >
                    {
                      group.status
                    }
                  </div>

                </div>

                {/* MEMBERS */}

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
                          className="bg-black/40 rounded-xl p-4"
                        >

                          <p className="font-bold">
                            👤 {
                              member.name ||
                              "User"
                            }
                          </p>

                          <p className="text-sm text-gray-400 mt-1">
                            📞 {
                              member.phone ||
                              "N/A"
                            }
                          </p>

                          <div className="mt-2">

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

                        </div>
                      );
                    }
                  )}

                </div>

                {/* ACTIONS */}

                <div className="flex gap-3 mt-5 flex-wrap">

                  {!group.isPaid ? (

                    <button
                      onClick={() =>
                        router.push(
                          `/payment?groupId=${group.id}`
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-[#FFD166] text-black font-bold"
                    >
                      Pay Now
                    </button>

                  ) : (

                    <button
                      onClick={() =>
                        router.push(
                          `/chat/${group.id}`
                        )
                      }
                      className="px-4 py-2 rounded-lg bg-green-600 font-bold"
                    >
                      Open Chat
                    </button>

                  )}

                  <button
                    onClick={() =>
                      deleteMatch(
                        group.id
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-red-600 font-bold"
                  >
                    Remove Match
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