"use client";

import { useEffect, useState } from "react";
import { db } from "@/firebase/config";

import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  where,
  query,
  getDocs,
} from "firebase/firestore";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Hari@2307";

/* ----------------------------
   FORMAT DATE
---------------------------- */

const formatDateTime = (ts: any) => {
  if (!ts?.seconds) return "N/A";

  const d = new Date(ts.seconds * 1000);

  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
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

  /* STATS */

  const [totalRevenue, setTotalRevenue] =
    useState(0);

  const [totalPaidUsers, setTotalPaidUsers] =
    useState(0);

  const [totalUsers, setTotalUsers] =
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
     FETCH GROUPS
  ---------------------------- */

  useEffect(() => {
    if (!authorized) return;

    setLoading(true);

    const ref = collection(db, "groups");

    const unsubscribe = onSnapshot(
      ref,
      async (snap) => {
        const docs = snap.docs;

        let revenue = 0;
        let paidCount = 0;
        let userCount = 0;

        const builtGroups =
          await Promise.all(
            docs.map(async (gDoc) => {
              const data =
                gDoc.data() as any;

              /* REMOVE EMPTY */

              if (
                !Array.isArray(data.members) ||
                data.members.length === 0
              ) {
                await deleteDoc(gDoc.ref);

                return null;
              }

              const cleanedMembers =
                (data.members || []).map(
                  (m: any) =>
                    typeof m === "string"
                      ? {
                          phone: m.trim(),
                          joinedAt:
                            data.createdAt,
                        }
                      : m
                );

              userCount +=
                cleanedMembers.length;

              /* USERS */

              const userDocs =
                await Promise.all(
                  cleanedMembers.map((m: any) =>                    getDoc(
                      doc(
                        db,
                        "users",
                        m.phone
                      )
                    )
                  )
                );

              /* PAYMENTS */

              const paymentsRef =
                collection(
                  db,
                  "payments"
                );

              const qPayments = query(
                paymentsRef,
                where(
                  "groupId",
                  "==",
                  gDoc.id
                )
              );

              const paymentSnap =
                await getDocs(
                  qPayments
                );

              const paidUsers: string[] =
                [];

              paymentSnap.forEach((p) => {
                const pdata =
                  p.data();

                if (
                  pdata.status ===
                  "paid"
                ) {
                  paidUsers.push(
                    pdata.uid
                  );

                  revenue +=
                    pdata.amount || 0;

                  paidCount++;
                }
              });

              /* MEMBERS */

              const membersDetailed =
                userDocs.map(
                  (uSnap, idx) => ({
                    phone:
                      cleanedMembers[idx]
                        .phone,

                    joinedAt:
                      cleanedMembers[idx]
                        .joinedAt,

                    name: uSnap.exists()
                      ? ((uSnap.data() as any)
                          ?.name ??
                          "Unknown User")
                      : "Unknown User",

                    paid:
                      paidUsers.length >
                      idx,
                  })
                );

              return {
                id: gDoc.id,

                ...data,

                members:
                  cleanedMembers,

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
            })
          );

        const list = builtGroups.filter(
          (g): g is any => g !== null
        );

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

        setLoading(false);
      }
    );

    return () => unsubscribe();
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
     MARK COMPLETED
  ---------------------------- */

  const markCompleted = async (
    id: string
  ) => {
    await updateDoc(
      doc(db, "groups", id),
      {
        status: "completed",

        lastActivityAt: new Date(),
      }
    );
  };

  /* ----------------------------
     DELETE GROUP
  ---------------------------- */

  const deleteGroup = async (
    id: string
  ) => {
    if (
      !confirm("Delete this group?")
    )
      return;

    await deleteDoc(
      doc(db, "groups", id)
    );
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
    <div className="pt-28 px-6 bg-black text-[#F5F5F5]">
      {/* HEADER */}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[#FFD166]">
          Admin — Partner Groups
        </h1>

        <button
          onClick={adminLogout}
          className="px-3 py-1 bg-red-600 rounded text-xs"
        >
          Logout
        </button>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
      </div>

      {/* GROUPS */}

      {loading ? (
        <p className="text-gray-400">
          Loading...
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className="p-4 bg-[#0c0c0c] border border-[#FFD166]/30 rounded-xl"
            >
              {/* TOP */}

              <div className="flex justify-between items-center">
                <p className="text-xl font-bold text-[#FFD166]">
                  {g.category} →{" "}
                  {g.option}
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
                {g.requiredSize}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                📅{" "}
                {formatDateTime(
                  g.createdAt
                )}
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
                      {/* LEFT */}

                      <div>
                        <p className="text-sm font-bold">
                          👤 {m.name}
                        </p>

                        <p className="text-xs text-gray-400">
                          📞 {m.phone}
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

                        {/* EXTRA */}

                        <div className="mt-2 flex gap-2 flex-wrap">
                          <span className="text-[10px] px-2 py-1 rounded-full bg-[#FFD166]/10 text-[#FFD166]">
                            Members:{" "}
                            {
                              g.membersCount
                            }
                            /
                            {
                              g.requiredSize
                            }
                          </span>

                          <span
                            className={`text-[10px] px-2 py-1 rounded-full ${
                              g.status ===
                              "ready"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {g.status ===
                            "ready"
                              ? "Ready To Chat"
                              : "Waiting"}
                          </span>
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
                )}
              </div>

              {/* ACTIONS */}

              <div className="flex gap-2 mt-4">
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
                    deleteGroup(g.id)
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