"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/firebase/config";
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { approveUserCollaboration, rejectUserCollaboration } from "@/app/lib/userCollaborations";
import toast from "react-hot-toast";

/* ---------------------------------------
   HELPERS
---------------------------------------- */

const formatDateTime = (ts: any) => {
  try {
    if (!ts?.seconds) return "N/A";
    const d = new Date(ts.seconds * 1000);
    return `${d.toLocaleDateString()} · ${d.toLocaleTimeString()}`;
  } catch {
    return "N/A";
  }
};

interface UserCollaboration {
  id?: string;
  businessName: string;
  category: string;
  categorySlug?: string;
  subCategory: string;
  state: string;
  district: string;
  city: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdByPhone: string;
  submittedAt: any;
  status: string;
  verified: boolean;
  image: string | null;
  source: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedAt?: any;
  rejectionReason?: string;
}

export default function UserCollaborationsPanel() {
  const [collaborations, setCollaborations] = useState<UserCollaboration[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const collabRef = collection(db, "userCollaborations");
    const q = query(collabRef, orderBy("submittedAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      const cols: UserCollaboration[] = [];
      snapshot.forEach((d) => {
        cols.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
      });
      setCollaborations(cols);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching user collaborations:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const filtered = collaborations.filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.businessName || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.createdByName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleApprove = async (collab: UserCollaboration) => {
    if (!collab.id) return;
    if (!confirm(`Approve "${collab.businessName}"? This will create it in ${collab.city} marketplace.`)) return;

    try {
      const adminPhone = typeof window !== "undefined" ? localStorage.getItem("phone") || "admin" : "admin";
      await approveUserCollaboration(collab.id, adminPhone);
      toast.success(`"${collab.businessName}" approved and created in ${collab.city}!`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to approve: " + (err.message || ""));
    }
  };

  const handleReject = async (collab: UserCollaboration) => {
    if (!collab.id) return;
    if (!confirm(`Reject "${collab.businessName}"?`)) return;

    try {
      await rejectUserCollaboration(collab.id);
      toast.success(`"${collab.businessName}" rejected.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to reject: " + (err.message || ""));
    }
  };

  const stats = {
    total: collaborations.length,
    pending: collaborations.filter((c) => c.status === "pending").length,
    approved: collaborations.filter((c) => c.status === "approved").length,
    rejected: collaborations.filter((c) => c.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-8">
        <div className="animate-pulse">Loading user collaborations...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-blue-400">{stats.total}</p>
          <p className="text-[9px] text-gray-400">Total</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-yellow-400">{stats.pending}</p>
          <p className="text-[9px] text-gray-400">Pending</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-green-400">{stats.approved}</p>
          <p className="text-[9px] text-gray-400">Approved</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
          <p className="text-lg font-bold text-red-400">{stats.rejected}</p>
          <p className="text-[9px] text-gray-400">Rejected</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search business, category, city, or submitter..."
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs flex-1 min-w-[150px]"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-8 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
          <p>No user collaborations found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((collab) => (
            <motion.div
              key={collab.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl"
            >
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">{collab.businessName}</h3>
                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                      collab.status === "approved" ? "bg-green-600" :
                      collab.status === "rejected" ? "bg-red-600" :
                      "bg-yellow-500 text-black"
                    }`}>{collab.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {collab.category} {collab.subCategory ? `→ ${collab.subCategory}` : ""}
                  </p>
                </div>
                <div className="text-[10px] text-gray-500">
                  {formatDateTime(collab.submittedAt)}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                <div className="bg-black/40 rounded p-2">
                  <p className="text-gray-500">📍 Location</p>
                  <p className="text-white">{collab.city || "N/A"}</p>
                  <p className="text-gray-400">{collab.district}, {collab.state}</p>
                </div>
                <div className="bg-black/40 rounded p-2">
                  <p className="text-gray-500">Submitted By</p>
                  <p className="text-white">{collab.createdByName || "Anonymous"}</p>
                  <p className="text-gray-400">{collab.createdByPhone || ""}</p>
                </div>
                <div className="bg-black/40 rounded p-2">
                  <p className="text-gray-500">Contact</p>
                  <p className="text-white">{collab.createdByEmail || "N/A"}</p>
                  <p className="text-gray-400">Phone: {collab.createdByPhone || "N/A"}</p>
                </div>
              </div>

              {/* Admin actions */}
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {collab.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleApprove(collab)}
                      className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-[10px] font-bold transition"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReject(collab)}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-[10px] font-bold transition"
                    >
                      ❌ Reject
                    </button>
                  </>
                )}
                {collab.status === "approved" && (
                  <span className="px-2 py-1 bg-green-600/30 text-green-400 rounded text-[10px]">
                    ✓ Approved {collab.approvedAt ? formatDateTime(collab.approvedAt) : ""}
                  </span>
                )}
                {collab.status === "rejected" && (
                  <span className="px-2 py-1 bg-red-600/30 text-red-400 rounded text-[10px]">
                    ✗ Rejected {collab.rejectedAt ? formatDateTime(collab.rejectedAt) : ""}
                  </span>
                )}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(
                        {
                          name: collab.businessName,
                          category: collab.category,
                          subCategory: collab.subCategory,
                          city: collab.city,
                          district: collab.district,
                          state: collab.state,
                          submittedBy: collab.createdByName,
                          phone: collab.createdByPhone,
                          email: collab.createdByEmail,
                        },
                        null,
                        2
                      )
                    );
                    toast.success("Details copied to clipboard");
                  }}
                  className="px-2 py-1 bg-blue-600/50 rounded text-[10px]"
                >
                  📋 Copy
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}