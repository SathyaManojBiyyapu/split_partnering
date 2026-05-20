"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Hari@2307";

/* ----------------------------
   FORMAT DATE
---------------------------- */

const formatDateTime = (ts: any) => {
  try {
    if (!ts?.seconds) return "N/A";

    const d = new Date(ts.seconds * 1000);

    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
  } catch {
    return "N/A";
  }
};

export default function AdminPage() {
  const [authorized, setAuthorized] =
    useState(false);

  const [usernameInput, setUsernameInput] =
    useState("");

  const [passwordInput, setPasswordInput] =
    useState("");

  const [groups, setGroups] = useState<any[]>(
    []
  );

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  /* STATS */

  const [totalRevenue, setTotalRevenue] =
    useState(0);

  const [totalPaidUsers, setTotalPaidUsers] =
    useState(0);

  const [totalUsers, setTotalUsers] =
    useState(0);

  const [completedGroups, setCompletedGroups] =
    useState(0);

  /* ----------------------------
     AUTO LOGIN
  ---------------------------- */

  useEffect(() => {
    if (typeof window === "undefined")
      return;

    if (
      localStorage.getItem("isAdmin") ===
      "true"
    ) {
      setAuthorized(true);
    }
  }, []);

  /* ----------------------------
     FETCH DASHBOARD
  ---------------------------- */

  const fetchDashboard = async () => {
    try {
      setLoading(true);

      /* FETCH ALL DATA ONCE */

      const groupsSnap = await getDocs(
        collection(db, "groups")
      );

      const paymentsSnap = await getDocs(
        collection(db, "payments")
      );

      /* PAYMENT MAP */

      const paidMap: any = {};

      let revenue = 0;
      let paidCount = 0;

      paymentsSnap.forEach((p) => {
        const pdata = p.data();

        if (pdata.status === "paid") {
          if (!paidMap[pdata.groupId]) {
            paidMap[pdata.groupId] = [];
          }

          paidMap[pdata.groupId].push(
            pdata.uid
          );

          revenue += pdata.amount || 0;

          paidCount++;
        }
      });

      let userCount = 0;
      let completedCount = 0;

      const builtGroups =
        groupsSnap.docs.map((gDoc) => {
          const data = gDoc.data() as any;

          /* SAFE MEMBERS */

          const cleanedMembers =
            Array.isArray(data.members)
              ? data.members.map(
                  (m: any) => {
                    if (
                      typeof m === "string"
                    ) {
                      return {
                        phone: m.trim(),
                        name:
                          "Unknown User",
                        joinedAt:
                          data.createdAt,
                        paid: false,
                      };
                    }

                    return {
                      phone:
                        m?.phone ||
                        "N/A",

                      name:
                        m?.name ||
                        "Unknown User",

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

          userCount +=
            cleanedMembers.length;

          /* PAID USERS */

          const paidUsers =
            paidMap[gDoc.id] || [];

          /* MEMBERS */

          const membersDetailed =
            cleanedMembers.map(
              (
                m: any,
                idx: number
              ) => ({
                phone: m.phone,

                name: m.name,

                joinedAt:
                  m.joinedAt,

                paid:
                  paidUsers.length >
                    idx ||
                  m.paid,
              })
            );

          if (
            data.status ===
            "completed"
          ) {
            completedCount++;
          }

          return {
            id: gDoc.id,

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
          };
        });

      /* REMOVE NULLS */

      const list = builtGroups.filter(
        Boolean
      );

      /* SORT */

      list.sort((a, b) => {
        const ta =
          a.lastActivityAt?.seconds ||
          a.createdAt?.seconds ||
          0;

        const tb =
          b.lastActivityAt?.seconds ||
          b.createdAt?.seconds ||
          0;

        return tb - ta;
      });

      setGroups(list);

      setTotalRevenue(revenue);

      setTotalPaidUsers(paidCount);

      setTotalUsers(userCount);

      setCompletedGroups(
        completedCount
      );
    } catch (err) {
      console.error(
        "Dashboard error:",
        err
      );
    }

    setLoading(false);

    setRefreshing(false);
  };

  /* ----------------------------
     INITIAL FETCH
  ---------------------------- */

  useEffect(() => {
    if (!authorized) return;

    fetchDashboard();
  }, [authorized]);

  /* ----------------------------
     LOGIN
  ---------------------------- */

  const loginAdmin = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      usernameInput ===
        ADMIN_USERNAME &&
      passwordInput ===
        ADMIN_PASSWORD
    ) {
      localStorage.setItem(
        "isAdmin",
        "true"
      );

      setAuthorized(true);
    } else {
      alert(
        "❌ Wrong username or password"
      );
    }
  };

  /* ----------------------------
     LOGOUT
  ---------------------------- */

  const adminLogout = () => {
    localStorage.removeItem(
      "isAdmin"
    );

    setAuthorized(false);

    alert(
      "Logged out successfully"
    );
  };

  /* ----------------------------
     REFRESH
  ---------------------------- */

  const refreshDashboard = async () => {
    setRefreshing(true);

    await fetchDashboard();
  };

  /* ----------------------------
     MARK COMPLETED
  ---------------------------- */

  const markCompleted = async (
    id: string
  ) => {
    try {
      await updateDoc(
        doc(db, "groups", id),
        {
          status: "completed",

          lastActivityAt:
            new Date(),
        }
      );

      setGroups((prev) =>
        prev.map((g) =>
          g.id === id
            ? {
                ...g,
                status:
                  "completed",
              }
            : g
        )
      );

      alert(
        "Group marked completed ✅"
      );
    } catch (err) {
      console.error(err);
    }
  };

  /* ----------------------------
     DELETE GROUP
  ---------------------------- */

  const deleteGroup = async (
    id: string
  ) => {
    if (
      !confirm(
        "Delete this group?"
      )
    )
      return;

    try {
      await deleteDoc(
        doc(db, "groups", id)
      );

      setGroups((prev) =>
        prev.filter(
          (g) => g.id !== id
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  /* ----------------------------
     LOGIN PAGE
  ---------------------------- */

  if (!authorized) {
    return (
      <div className="pt-32 text-white flex flex-col items-center">
        <h1 className="text-3xl font-bold text-[#FFD166]">
          Admin Login
        </h1>

        <form
          className="mt-6 w-72 space-y-4"
          onSubmit={loginAdmin}
        >
          <input
            className="p-3 rounded bg-black border border-[#FFD166] text-[#FFD166] w-full"
            placeholder="Username"
            value={usernameInput}
            onChange={(e) =>
              setUsernameInput(
                e.target.value
              )
            }
          />

          <input
            type="password"
            className="p-3 rounded bg-black border border-[#FFD166] text-[#FFD166] w-full"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) =>
              setPasswordInput(
                e.target.value
              )
            }
          />

          <button className="w-full bg-[#FFD166] py-2 text-black rounded font-bold">
            Login
          </button>
        </form>
      </div>
    );
  }

  /* ----------------------------
     DASHBOARD
  ---------------------------- */

  return (
    <div className="pt-28 px-6 bg-black text-[#F5F5F5] min-h-screen">
      {/* HEADER */}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-3xl font-bold text-[#FFD166]">
          Admin — Partner Groups
        </h1>

        <div className="flex gap-2">
          <button
            onClick={
              refreshDashboard
            }
            className="px-3 py-1 bg-blue-600 rounded text-xs"
          >
            {refreshing
              ? "Refreshing..."
              : "Refresh"}
          </button>

          <button
            onClick={adminLogout}
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

      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 bg-[#111] rounded-xl" />
          <div className="h-32 bg-[#111] rounded-xl" />
          <div className="h-32 bg-[#111] rounded-xl" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center text-gray-400 mt-20">
          No groups found
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className="p-4 bg-[#0c0c0c] border border-[#FFD166]/30 rounded-xl"
            >
              {/* TOP */}

              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-xl font-bold text-[#FFD166]">
                  {g.category ||
                    "Unknown"}{" "}
                  →{" "}
                  {g.option ||
                    "Unknown"}
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
                  {g.status ??
                    "waiting"}
                </span>
              </div>

              <p className="text-[#FFD166] font-bold mt-1">
                {g.membersCount}/
                {g.requiredSize ||
                  "N/A"}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                📅{" "}
                {formatDateTime(
                  g.createdAt
                )}
              </p>

              {/* MEMBERS */}

              <div className="mt-4 space-y-2">
                {g.membersDetailed?.length >
                0 ? (
                  g.membersDetailed.map(
                    (
                      m: any,
                      i: number
                    ) => (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-black/40 p-3 rounded"
                      >
                        {/* LEFT */}

                        <div>
                          <p className="text-sm font-bold">
                            👤{" "}
                            {m.name}
                          </p>

                          <p className="text-xs text-gray-400">
                            📞{" "}
                            {m.phone}
                          </p>

                          <p className="text-xs text-gray-500">
                            📅{" "}
                            {formatDateTime(
                              m.joinedAt
                            )}
                          </p>

                          {/* PAID STATUS */}

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

                        {/* WHATSAPP */}

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
                  )
                ) : (
                  <div className="text-gray-500 text-sm">
                    No members
                  </div>
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
          ))}
        </div>
      )}
    </div>
  );
}