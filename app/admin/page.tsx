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
} from "firebase/firestore";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Hari@2307";

/* ✅ UI ONLY: FORMAT DATE & TIME */
const formatDateTime = (ts: any) => {
  if (!ts?.seconds) return "N/A";
  const d = new Date(ts.seconds * 1000);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
};

export default function AdminPage() {
  const [authorized, setAuthorized] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /* ----------------------------
       AUTO LOGIN
  ---------------------------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("isAdmin") === "true") {
      setAuthorized(true);
    }
  }, []);

  /* ----------------------------
       FETCH GROUPS (FAST + SAFE)
  ---------------------------- */
  useEffect(() => {
    if (!authorized) return;

    setLoading(true);
    const ref = collection(db, "groups");

    const unsubscribe = onSnapshot(ref, async (snap) => {
      const docs = snap.docs;

      const builtGroups = await Promise.all(
        docs.map(async (gDoc) => {
          const data = gDoc.data() as any;

          // AUTO DELETE EMPTY OR CORRUPTED GROUPS
          if (!Array.isArray(data.members) || data.members.length === 0) {
            await deleteDoc(gDoc.ref);
            return null;
          }

          const cleanedMembers: any[] = (data.members || []).map((m: any) =>
            typeof m === "string"
              ? { phone: m.trim(), joinedAt: data.createdAt }
              : m
          );

          const userDocs = await Promise.all(
            cleanedMembers.map((m) =>
              getDoc(doc(db, "users", m.phone))
            )
          );

          const membersDetailed = userDocs.map((uSnap, idx) => ({
            phone: cleanedMembers[idx].phone,
            joinedAt: cleanedMembers[idx].joinedAt,
            name: uSnap.exists()
              ? ((uSnap.data() as any)?.name ?? "Unknown User")
              : "Unknown User",
          }));

          return {
            id: gDoc.id,
            ...data,
            members: cleanedMembers,
            membersDetailed,
            membersCount:
              typeof data.membersCount === "number"
                ? data.membersCount
                : cleanedMembers.length,

            // 🔥 ADDED (does NOT replace anything)
            lastActivityAt: data.lastActivityAt ?? data.createdAt,
          };
        })
      );

      const list = builtGroups.filter((g): g is any => g !== null);

      // 🔥 ADDED SORT (existing logic kept, extended)
      list.sort((a, b) => {
        const ta =
          a.lastActivityAt?.seconds || a.createdAt?.seconds || 0;
        const tb =
          b.lastActivityAt?.seconds || b.createdAt?.seconds || 0;
        return tb - ta;
      });

      setGroups(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [authorized]);

  /* ----------------------------
       LOGIN
  ---------------------------- */
  const loginAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput === ADMIN_USERNAME && passwordInput === ADMIN_PASSWORD) {
      localStorage.setItem("isAdmin", "true");
      setAuthorized(true);
    } else {
      alert("❌ Wrong username or password");
    }
  };

  /* ----------------------------
       LOGOUT
  ---------------------------- */
  const adminLogout = () => {
    localStorage.removeItem("isAdmin");
    setAuthorized(false);
    alert("Logged out of admin panel.");
  };

  /* ----------------------------
       MARK COMPLETED
  ---------------------------- */
  const markCompleted = async (id: string) => {
    await updateDoc(doc(db, "groups", id), {
      status: "completed",

      // 🔥 ADDED
      lastActivityAt: new Date(),
    });
  };

  /* ----------------------------
       DELETE GROUP
  ---------------------------- */
  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group?")) return;
    await deleteDoc(doc(db, "groups", id));
  };

  /* ----------------------------
       LOGIN UI
  ---------------------------- */
  if (!authorized) {
    return (
      <div className="pt-32 text-white flex flex-col items-center">
        <h1 className="text-3xl font-bold text-[#FFD166]">Admin Login</h1>
        <form className="mt-6 w-72 space-y-4" onSubmit={loginAdmin}>
          <input
            className="p-3 rounded bg-black border border-[#FFD166] text-[#FFD166] w-full"
            placeholder="Username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
          />
          <input
            type="password"
            className="p-3 rounded bg-black border border-[#FFD166] text-[#FFD166] w-full"
            placeholder="Password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
          />
          <button className="w-full bg-[#FFD166] py-2 text-black rounded font-bold">
            Login
          </button>
        </form>
      </div>
    );
  }

  /* ----------------------------
       DASHBOARD UI
  ---------------------------- */
  return (
    <div className="pt-28 px-6 bg-black text-[#F5F5F5]">
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

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div
              key={g.id}
              className="p-4 bg-[#0c0c0c] border border-[#FFD166]/30 rounded-xl"
            >
              <div className="flex justify-between items-center">
                <p className="text-xl font-bold text-[#FFD166]">
                  {g.category} → {g.option}
                </p>

                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full ${
                    g.status === "completed"
                      ? "bg-green-600"
                      : g.status === "ready"
                      ? "bg-blue-600"
                      : "bg-yellow-500 text-black"
                  }`}
                >
                  {g.status ?? "waiting"}
                </span>
              </div>

              <p className="text-[#FFD166] font-bold mt-1">
                {g.membersCount}/{g.requiredSize}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                📅 {formatDateTime(g.createdAt)}
              </p>

              {/* 🔥 ADDED — INDIVIDUAL MEMBERS */}
              <div className="mt-4 space-y-2">
                {g.membersDetailed?.map((m: any, i: number) => (
                  <div
                    key={i}
                    className="flex justify-between items-center bg-black/40 p-2 rounded"
                  >
                    <div>
                      <p className="text-sm font-bold">👤 {m.name}</p>
                      <p className="text-xs text-gray-400">📞 {m.phone}</p>
                      <p className="text-xs text-gray-500">
                        📅 {formatDateTime(m.joinedAt)}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        window.open(
                          `https://wa.me/91${m.phone}?text=${encodeURIComponent(
                            "Hello! Your partner group is ready."
                          )}`
                        )
                      }
                      className="text-green-400 text-xl"
                    >
                      🟢
                    </button>
                  </div>
                ))}
              </div>

              {/* EXISTING BUTTONS — UNTOUCHED */}
              <div className="flex gap-2 mt-4">
                <button
                  className="bg-blue-600 px-3 py-1 rounded"
                  onClick={() => markCompleted(g.id)}
                >
                  Mark Completed
                </button>
                <button
                  className="bg-red-600 px-3 py-1 rounded"
                  onClick={() => deleteGroup(g.id)}
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
