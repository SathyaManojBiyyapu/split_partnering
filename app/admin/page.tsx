"use client";

import { useEffect, useState } from "react";

import {
  db,
  auth,
} from "@/firebase/config";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { useRouter } from "next/navigation";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

/* -----------------------------
   FORMAT DATE
----------------------------- */

const formatDateTime = (ts: any) => {
  try {
    if (!ts) return "N/A";

    let date;

    if (ts?.seconds) {
      date = new Date(ts.seconds * 1000);
    } else {
      date = new Date(ts);
    }

    return `${date.toLocaleDateString()} · ${date.toLocaleTimeString()}`;
  } catch {
    return "N/A";
  }
};

export default function AdminPage() {
  const router = useRouter();

  const [authorized, setAuthorized] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [groups, setGroups] = useState<any[]>([]);

  /* STATS */

  const [totalRevenue, setTotalRevenue] =
    useState(0);

  const [totalPaidUsers, setTotalPaidUsers] =
    useState(0);

  const [totalUsers, setTotalUsers] =
    useState(0);

  const [completedGroups, setCompletedGroups] =
    useState(0);

  /* -----------------------------
     ADMIN AUTH
  ----------------------------- */

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (
          user?.email ===
          "sathyamanojbiyyapu@gmail.com"
        ) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          router.push("/");
        }

        setLoading(false);
      }
    );

    return () => unsub();
  }, [router]);

  /* -----------------------------
     FETCH DASHBOARD
  ----------------------------- */

  const fetchDashboard = async () => {
    try {
      setRefreshing(true);

      /* GROUPS */

      const groupsSnap = await getDocs(
        collection(db, "groups")
      );

      /* PAYMENTS */

      const paymentsSnap = await getDocs(
        collection(db, "payments")
      );

      /* PAYMENT MAP */

      const paidMap: any = {};

      let revenue = 0;

      let paidUsersCount = 0;

      paymentsSnap.forEach((p) => {
        const pdata = p.data();

        if (
          pdata.status === "paid" ||
          pdata.paid === true
        ) {
          if (!paidMap[pdata.groupId]) {
            paidMap[pdata.groupId] = [];
          }

          paidMap[pdata.groupId].push(
            pdata.uid
          );

          revenue += pdata.amount || 99;

          paidUsersCount++;
        }
      });

      let userCount = 0;

      let completedCount = 0;

      const builtGroups = groupsSnap.docs.map(
        (gDoc) => {
          const data = gDoc.data() as any;

          /* MEMBERS */

          let cleanedMembers: any[] = [];

          if (Array.isArray(data.members)) {
            cleanedMembers = data.members.map(
              (m: any) => {
                /* OLD STRING FORMAT */

                if (typeof m === "string") {
                  return {
                    uid: "",
                    phone: m,
                    name:
                      data.createdByName ||
                      "User",
                    gender:
                      data.gender || "N/A",
                    joinedAt:
                      data.createdAt || null,
                    paid: false,
                  };
                }

                /* NEW FORMAT */

                return {
                  uid: m?.uid || "",
                  phone:
                    m?.phone ||
                    m?.number ||
                    "N/A",
                  name:
                    m?.name || "User",
                  gender:
                    m?.gender || "N/A",
                  joinedAt:
                    m?.joinedAt ||
                    data.createdAt ||
                    null,
                  paid: m?.paid || false,
                };
              }
            );
          }

          /* FALLBACK */

          if (
            cleanedMembers.length === 0 &&
            data.memberUIDs?.length
          ) {
            cleanedMembers =
              data.memberUIDs.map(
                (uid: string) => ({
                  uid,
                  phone: "N/A",
                  name: "User",
                  gender: "N/A",
                  joinedAt:
                    data.createdAt ||
                    null,
                  paid: false,
                })
              );
          }

          userCount +=
            cleanedMembers.length;

          const paidUsers =
            paidMap[gDoc.id] || [];

          const membersDetailed =
            cleanedMembers.map(
              (m: any) => ({
                ...m,

                paid:
                  paidUsers.includes(
                    m.uid
                  ) ||
                  m.paid ||
                  false,
              })
            );

          if (
            data.status === "completed"
          ) {
            completedCount++;
          }

          return {
            id: gDoc.id,

            ...data,

            membersDetailed,

            membersCount:
              data.membersCount ||
              cleanedMembers.length,

            lastActivityAt:
              data.lastActivityAt ||
              data.createdAt,
          };
        }
      );

      /* SORT */

      builtGroups.sort((a, b) => {
        const ta =
          a.lastActivityAt?.seconds || 0;

        const tb =
          b.lastActivityAt?.seconds || 0;

        return tb - ta;
      });

      console.log(
        "FINAL GROUPS:",
        builtGroups
      );

      setGroups(builtGroups);

      setTotalRevenue(revenue);

      setTotalPaidUsers(paidUsersCount);

      setTotalUsers(userCount);

      setCompletedGroups(completedCount);
    } catch (err) {
      console.error(
        "Dashboard fetch error:",
        err
      );
    }

    setRefreshing(false);
  };

  /* -----------------------------
     INITIAL FETCH
  ----------------------------- */

  useEffect(() => {
    if (!authorized) return;

    fetchDashboard();
  }, [authorized]);

  /* -----------------------------
     LOGOUT
  ----------------------------- */

  const adminLogout = async () => {
    await signOut(auth);

    router.push("/");
  };

  /* -----------------------------
     COMPLETE
  ----------------------------- */

  const markCompleted = async (
    id: string
  ) => {
    try {
      await updateDoc(
        doc(db, "groups", id),
        {
          status: "completed",
          lastActivityAt: new Date(),
        }
      );

      fetchDashboard();

      alert("Completed ✅");
    } catch (err) {
      console.error(err);
    }
  };

  /* -----------------------------
     DELETE
  ----------------------------- */

  const deleteGroup = async (
    id: string
  ) => {
    const ok = confirm(
      "Delete group?"
    );

    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "groups", id)
      );

      fetchDashboard();
    } catch (err) {
      console.error(err);
    }
  };

  /* -----------------------------
     LOADING
  ----------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Checking admin access...
      </div>
    );
  }

  if (!authorized) return null;

  /* -----------------------------
     UI
  ----------------------------- */

  return (
    <div className="min-h-screen bg-black text-white pt-28 px-6">

      {/* HEADER */}

      <div className="flex justify-between items-center flex-wrap gap-3 mb-8">

        <h1 className="text-4xl font-bold text-[#FFD166]">
          Admin — Partner Groups
        </h1>

        <div className="flex gap-2">

          <button
            onClick={fetchDashboard}
            className="bg-blue-600 px-4 py-2 rounded-lg"
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={adminLogout}
            className="bg-red-600 px-4 py-2 rounded-lg"
          >
            Logout
          </button>

        </div>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-5">
          <p className="text-gray-400">
            Revenue
          </p>

          <h2 className="text-3xl text-green-400 font-bold mt-2">
            ₹{totalRevenue}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-5">
          <p className="text-gray-400">
            Paid Users
          </p>

          <h2 className="text-3xl text-[#FFD166] font-bold mt-2">
            {totalPaidUsers}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-5">
          <p className="text-gray-400">
            Total Members
          </p>

          <h2 className="text-3xl text-blue-400 font-bold mt-2">
            {totalUsers}
          </h2>
        </div>

        <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-5">
          <p className="text-gray-400">
            Completed
          </p>

          <h2 className="text-3xl text-purple-400 font-bold mt-2">
            {completedGroups}
          </h2>
        </div>

      </div>

      {/* GROUPS */}

      {groups.length === 0 ? (

        <div className="text-center text-gray-400 mt-20 text-xl">
          No groups found
        </div>

      ) : (

        <div className="space-y-5">

          {groups.map((g) => (

            <div
              key={g.id}
              className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-2xl p-5"
            >

              {/* TOP */}

              <div className="flex justify-between items-center flex-wrap gap-3">

                <div>

                  <h2 className="text-2xl font-bold text-[#FFD166]">
                    {g.category} → {g.option}
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    {g.membersCount}/
                    {g.requiredSize} members
                  </p>

                  <p className="text-xs text-gray-500 mt-1">
                    Created:
                    {" "}
                    {formatDateTime(
                      g.createdAt
                    )}
                  </p>

                </div>

                <span
                  className={`px-4 py-2 rounded-full text-xs font-bold ${
                    g.status ===
                    "completed"
                      ? "bg-green-600"
                      : g.status ===
                        "ready"
                      ? "bg-blue-600"
                      : "bg-yellow-500 text-black"
                  }`}
                >
                  {g.status}
                </span>

              </div>

              {/* MEMBERS */}

              <div className="mt-5 space-y-3">

                {g.membersDetailed?.map(
                  (
                    m: any,
                    i: number
                  ) => (

                    <div
                      key={i}
                      className="bg-black/50 rounded-xl p-4 flex justify-between items-center flex-wrap gap-3"
                    >

                      <div>

                        <p className="font-bold">
                          👤 {m.name}
                        </p>

                        <p className="text-sm text-gray-400">
                          📞 {m.phone}
                        </p>

                        <p className="text-sm text-pink-400">
                          🚻 {m.gender}
                        </p>

                        <p className="text-xs text-gray-500">
                          📅 {formatDateTime(
                            m.joinedAt
                          )}
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
                              ? "PAID"
                              : "NOT PAID"}
                          </p>

                        </div>

                      </div>

                      {/* WHATSAPP */}

                      <button
                        onClick={() =>
                          window.open(
                            `https://wa.me/91${m.phone}?text=${encodeURIComponent(
                              "Hello! Your partner group is ready 🎉"
                            )}`
                          )
                        }
                        className="text-3xl"
                      >
                        🟢
                      </button>

                    </div>
                  )
                )}

              </div>

              {/* ACTIONS */}

              <div className="flex gap-3 mt-5 flex-wrap">

                <button
                  onClick={() =>
                    markCompleted(g.id)
                  }
                  className="bg-blue-600 px-4 py-2 rounded-lg"
                >
                  Mark Completed
                </button>

                <button
                  onClick={() =>
                    deleteGroup(g.id)
                  }
                  className="bg-red-600 px-4 py-2 rounded-lg"
                >
                  Delete
                </button>

              </div>

            </div>
          ))}

        </div>
      )}

    </div>
  );
}