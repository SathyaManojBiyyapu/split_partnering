"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  db,
  auth,
} from "@/firebase/config";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  useRouter,
} from "next/navigation";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

/* ---------------------------------------
   FORMAT DATE
---------------------------------------- */

const formatDateTime = (
  ts: any
) => {

  try {

    if (
      !ts?.seconds
    ) {

      return "N/A";
    }

    const d =
      new Date(
        ts.seconds *
          1000
      );

    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;

  } catch {

    return "N/A";
  }
};

export default function AdminPage() {

  const router =
    useRouter();

  const [
    authorized,
    setAuthorized,
  ] = useState(
    false
  );

  const [groups, setGroups] =
    useState<any[]>(
      []
    );

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    search,
    setSearch,
  ] = useState("");

  /* STATS */

  const [
    totalRevenue,
    setTotalRevenue,
  ] = useState(0);

  const [
    totalPaidUsers,
    setTotalPaidUsers,
  ] = useState(0);

  const [
    totalUsers,
    setTotalUsers,
  ] = useState(0);

  const [
    completedGroups,
    setCompletedGroups,
  ] = useState(0);

  /* ---------------------------------------
     ADMIN AUTH
  ---------------------------------------- */

  useEffect(() => {

    const unsub =
      onAuthStateChanged(
        auth,
        (
          user
        ) => {

          if (
            user?.email ===
            "sathyamanojbiyyapu@gmail.com"
          ) {

            setAuthorized(
              true
            );

          } else {

            setAuthorized(
              false
            );

            router.push(
              "/"
            );
          }

          setLoading(
            false
          );
        }
      );

    return () =>
      unsub();

  }, [router]);

  /* ---------------------------------------
     FETCH DASHBOARD
  ---------------------------------------- */

  useEffect(() => {

    if (
      !authorized
    )
      return;

    setRefreshing(
      true
    );

    const unsub =
      onSnapshot(
        collection(
          db,
          "groups"
        ),

        async (
          snapshot
        ) => {

          try {

            const paymentsSnap =
              await getDocs(
                collection(
                  db,
                  "payments"
                )
              );

            const paidMap: any =
              {};

            let revenue = 0;

            let paidCount = 0;

            paymentsSnap.forEach(
              (
                p
              ) => {

                const pdata =
                  p.data();

                if (
                  pdata.status ===
                    "paid" ||
                  pdata.paid ===
                    true
                ) {

                  if (
                    !paidMap[
                      pdata.groupId
                    ]
                  ) {

                    paidMap[
                      pdata.groupId
                    ] =
                      [];
                  }

                  paidMap[
                    pdata.groupId
                  ].push(
                    pdata.uid
                  );

                  revenue +=
                    pdata.amount ||
                    29;

                  paidCount++;
                }
              }
            );

            let userCount = 0;

            let completedCount = 0;

            const builtGroups =
              [];

            for (const gDoc of snapshot.docs) {

              const data =
                gDoc.data() as any;

              const cleanedMembers =
                Array.isArray(
                  data.members
                )
                  ? data.members.map(
                      (
                        m: any
                      ) => {

                        if (
                          typeof m ===
                          "string"
                        ) {

                          return {

                            uid:
                              m.trim(),

                            phone:
                              m.trim(),

                            name:
                              data.createdByName ||
                              "Unknown User",

                            gender:
                              data.gender ||
                              "N/A",

                            photoURL:
                              "",

                            joinedAt:
                              data.createdAt,

                            paid:
                              false,
                          };
                        }

                        return {

                          uid:
                            m?.uid ||
                            m?.phone ||
                            "",

                          phone:
                            m?.phone ||
                            "N/A",

                          name:
                            m?.name ||
                            "Unknown User",

                          gender:
                            m?.gender ||
                            "N/A",

                          photoURL:
                            m?.photoURL ||
                            "",

                          joinedAt:
                            m?.joinedAt ||
                            data.createdAt,

                          paid:
                            m?.paid ||
                            false,
                        };
                      }
                    )
                  : [];

              /* AUTO DELETE EMPTY */

              if (
                cleanedMembers.length <= 0
              ) {

                try {

                  await deleteDoc(
                    doc(
                      db,
                      "groups",
                      gDoc.id
                    )
                  );

                } catch {}

                continue;
              }

              userCount +=
                cleanedMembers.length;

              const paidUsers =
                paidMap[
                  gDoc.id
                ] || [];

              const membersDetailed =
                cleanedMembers.map(
                  (
                    m: any
                  ) => ({

                    uid:
                      m.uid,

                    phone:
                      m.phone,

                    name:
                      m.name,

                    gender:
                      m.gender ||
                      "N/A",

                    photoURL:
                      m.photoURL ||
                      "",

                    joinedAt:
                      m.joinedAt,

                    paid:
                      paidUsers.includes(
                        m.uid
                      ) ||
                      paidUsers.includes(
                        m.phone
                      ) ||
                      m.paid ||
                      false,
                  })
                );

              if (
                data.status ===
                "completed"
              ) {

                completedCount++;
              }

              builtGroups.push({

                id:
                  gDoc.id,

                ...data,

                membersDetailed,

                membersCount:
                  typeof data.membersCount ===
                  "number"
                    ? data.membersCount
                    : cleanedMembers.length,

                lastActivityAt:
                  data.lastActivityAt ??
                  data.createdAt,
              });
            }

            builtGroups.sort(
              (
                a,
                b
              ) => {

                const ta =
                  a
                    .lastActivityAt
                    ?.seconds ||
                  a
                    .createdAt
                    ?.seconds ||
                  0;

                const tb =
                  b
                    .lastActivityAt
                    ?.seconds ||
                  b
                    .createdAt
                    ?.seconds ||
                  0;

                return (
                  tb -
                  ta
                );
              }
            );

            setGroups(
              builtGroups
            );

            setTotalRevenue(
              revenue
            );

            setTotalPaidUsers(
              paidCount
            );

            setTotalUsers(
              userCount
            );

            setCompletedGroups(
              completedCount
            );

          } catch (
            err
          ) {

            console.error(
              "Dashboard error:",
              err
            );
          }

          setRefreshing(
            false
          );
        }
      );

    return () =>
      unsub();

  }, [authorized]);

  /* ---------------------------------------
     LOGOUT
  ---------------------------------------- */

  const adminLogout =
    async () => {

      await signOut(
        auth
      );

      setAuthorized(
        false
      );

      router.push(
        "/"
      );

      alert(
        "Logged out successfully"
      );
    };

  /* ---------------------------------------
     MARK COMPLETE
  ---------------------------------------- */

  const markCompleted =
    async (
      id: string
    ) => {

      try {

        await updateDoc(
          doc(
            db,
            "groups",
            id
          ),
          {

            status:
              "completed",

            lastActivityAt:
              new Date(),
          }
        );

        alert(
          "Group marked completed ✅"
        );

      } catch (
        err
      ) {

        console.error(
          err
        );
      }
    };

  /* ---------------------------------------
     DELETE GROUP
  ---------------------------------------- */

  const deleteGroup =
    async (
      id: string
    ) => {

      if (
        !confirm(
          "Delete this group permanently?"
        )
      ) {

        return;
      }

      try {

        await deleteDoc(
          doc(
            db,
            "groups",
            id
          )
        );

        setGroups(
          (
            prev
          ) =>
            prev.filter(
              (
                g
              ) =>
                g.id !==
                id
            )
        );

        alert(
          "Group deleted successfully ✅"
        );

      } catch (
        err
      ) {

        console.error(
          err
        );

        alert(
          "Delete failed"
        );
      }
    };

  if (
    loading
  ) {

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Checking admin access...
      </div>
    );
  }

  if (
    !authorized
  ) {

    return null;
  }

  const filteredGroups =
    groups.filter(
      (
        g
      ) => {

        const q =
          search.toLowerCase();

        return (
          g.category
            ?.toLowerCase()
            .includes(q) ||
          g.option
            ?.toLowerCase()
            .includes(q)
        );
      }
    );

  return (

    <div className="pt-28 px-6 bg-black text-[#F5F5F5] min-h-screen">

      {/* HEADER */}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">

        <h1 className="text-3xl font-bold text-[#FFD166]">
          Admin — Partner Groups
        </h1>

        <div className="flex gap-2 flex-wrap">

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Search category..."
            className="bg-[#0c0c0c] border border-[#FFD166]/20 px-3 py-2 rounded text-sm"
          />

          <button
            onClick={() =>
              window.location.reload()
            }
            className="px-3 py-1 bg-blue-600 rounded text-xs"
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={
              adminLogout
            }
            className="px-3 py-1 bg-red-600 rounded text-xs"
          >
            Logout
          </button>

        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
          <p className="text-gray-400 text-sm">
            Revenue
          </p>

          <h2 className="text-2xl font-bold text-green-400 mt-1">
            ₹{totalRevenue}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
          <p className="text-gray-400 text-sm">
            Paid Users
          </p>

          <h2 className="text-2xl font-bold text-[#FFD166] mt-1">
            {totalPaidUsers}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
          <p className="text-gray-400 text-sm">
            Total Members
          </p>

          <h2 className="text-2xl font-bold text-blue-400 mt-1">
            {totalUsers}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
        
          <p className="text-gray-400 text-sm">
            Completed
          </p>

          <h2 className="text-2xl font-bold text-purple-400 mt-1">
            {completedGroups}
          </h2>
        </div>

      </div>

      {/* GROUPS */}

      {filteredGroups.length === 0 ? (

        <div className="text-center text-gray-400 mt-20">
          No groups found
        </div>

      ) : (

        <div className="space-y-4">

          {filteredGroups.map(
            (
              g
            ) => (

              <div
                key={g.id}
                className="p-4 bg-[#0c0c0c] border border-[#FFD166]/30 rounded-xl"
              >

                <div className="flex justify-between items-center flex-wrap gap-2">

                  <p className="text-xl font-bold text-[#FFD166]">
                    {g.category} → {g.option}
                  </p>

                  <span
                    className={`px-3 py-1 text-xs font-bold rounded-full ${
                      g.status ===
                      "completed"
                        ? "bg-green-600"
                        : g.status ===
                          "ready"
                        ? "bg-blue-600"
                        : "bg-yellow-500 text-black"
                    }`}
                  >
                    {g.status === "ready"
                      ? "Ready for payment"
                      : g.status}
                  </span>

                </div>

                <p className="text-[#FFD166] font-bold mt-1">
                  {g.membersCount}/{g.requiredSize}
                </p>

                <p className="text-xs text-gray-400 mt-1">
                  📅 {formatDateTime(g.createdAt)}
                </p>

                {/* MEMBERS */}

                <div className="mt-4 space-y-2">

                  {g.membersDetailed?.map(
                    (
                      m: any,
                      i: number
                    ) => (

                      <div
                        key={i}
                        className="flex justify-between items-center bg-black/40 p-3 rounded"
                      >

                        <div className="flex items-center gap-4">

                          <img
                            src={
                              m.photoURL ||
                              "https://ui-avatars.com/api/?background=000000&color=FFD166&name=User"
                            }
                            alt="user"
                            className="w-12 h-12 rounded-full border border-[#FFD166]"
                          />

                          <div>

                            <p className="text-sm font-bold">
                              👤 {m.name}
                            </p>

                            <p className="text-xs text-gray-400">
                              📞 {m.phone}
                            </p>

                            <p className="text-xs text-pink-400">
                              🚻 {m.gender}
                            </p>

                            <p className="text-xs text-gray-500">
                              📅 {formatDateTime(m.joinedAt)}
                            </p>

                            <div className="mt-2 flex items-center gap-2">

                              <div
                                className={`w-2 h-2 rounded-full ${
                                  m.paid
                                    ? "bg-green-400"
                                    : "bg-red-500"
                                }`}
                              />

                              <p
                                className={`text-xs font-bold ${
                                  m.paid
                                    ? "text-green-400"
                                    : "text-red-500"
                                }`}
                              >
                                {m.paid
                                  ? "Paid"
                                  : "Not Paid"}
                              </p>

                            </div>

                          </div>

                        </div>

                        <button
                          onClick={() =>
                            window.open(
                              `https://wa.me/91${m.phone}?text=${encodeURIComponent(
                                "Hello! Your partner group is ready."
                              )}`
                            )
                          }
                          className="text-green-400 text-2xl"
                        >
                          🟢
                        </button>

                      </div>
                    )
                  )}

                </div>

                {/* ACTIONS */}

                <div className="flex gap-2 mt-4 flex-wrap">

                  <button
                    className="bg-blue-600 px-3 py-1 rounded"
                    onClick={() =>
                      markCompleted(
                        g.id
                      )
                    }
                  >
                    Mark Completed
                  </button>

                  <button
                    className="bg-red-600 px-3 py-1 rounded"
                    onClick={() =>
                      deleteGroup(
                        g.id
                      )
                    }
                  >
                    Delete Group
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