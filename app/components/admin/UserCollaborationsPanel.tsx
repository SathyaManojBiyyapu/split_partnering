"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  approveUserCollaboration,
  rejectUserCollaboration,
  subscribeToUserCollaborationsWithError,
  UserCollaboration,
} from "@/app/lib/userCollaborations";
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

/** Case-insensitive status key so legacy records ("Pending", "APPROVED", ...) still count. */
const statusKey = (c: UserCollaboration) => String(c?.status || "pending").toLowerCase();

const statusBadge = (status: string) =>
  status === "approved" ? "bg-green-600" : status === "rejected" ? "bg-red-600" : "bg-yellow-500 text-black";

/**
 * Group records by Parent → Collaboration/category → user-created child/entity.
 * Every valid child (JS Gym, ABC Fitness, XYZ Training Center, ...) is listed
 * underneath its Category → SubCategory group — nothing is hard-coded.
 */
const groupByHierarchy = (
  collabs: UserCollaboration[]
): { category: string; subCategory: string; children: UserCollaboration[] }[] => {
  const groups = new Map<string, { category: string; subCategory: string; children: UserCollaboration[] }>();
  for (const c of collabs) {
    const category = (c.category || "Uncategorized").trim();
    const subCategory = (c.subCategory || "").trim();
    const key = `${category}::${subCategory}`;
    if (!groups.has(key)) groups.set(key, { category, subCategory, children: [] });
    groups.get(key)!.children.push(c);
  }
  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      children: g.children.sort(
        (a, b) => ((b.submittedAt as any)?.seconds || 0) - ((a.submittedAt as any)?.seconds || 0)
      ),
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory));
};

export default function UserCollaborationsPanel() {
  const [collaborations, setCollaborations] = useState<UserCollaboration[]>([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToUserCollaborationsWithError((cols, err) => {
      setCollaborations(cols);
      setLoadError(err || null);
      setLoading(false);
    });
  }, []);

  const filtered = collaborations.filter((c) => {
    if (filterStatus !== "all" && statusKey(c) !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (c.businessName || "").toLowerCase().includes(q) ||
        (c.category || "").toLowerCase().includes(q) ||
        (c.subCategory || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.createdByName || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const groups = groupByHierarchy(filtered);

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
    pending: collaborations.filter((c) => statusKey(c) === "pending").length,
    approved: collaborations.filter((c) => statusKey(c) === "approved").length,
    rejected: collaborations.filter((c) => statusKey(c) === "rejected").length,
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

      {/* Status filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["all", "pending", "approved", "rejected"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded text-[11px] font-bold border transition ${
              filterStatus === s
                ? s === "pending"
                  ? "bg-yellow-500 text-black border-yellow-500"
                  : s === "approved"
                  ? "bg-green-600 border-green-500"
                  : s === "rejected"
                  ? "bg-red-600 border-red-500"
                  : "bg-blue-600 border-blue-500"
                : "bg-[#0c0c0c] border-gray-700 text-gray-400 hover:border-[#FFD166]/40"
            }`}
          >
            {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search business or entity name..."
        className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs flex-1 min-w-[150px] mb-4 w-full"
      />

      {loadError && (
        <div className="text-center text-red-400 py-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-4">
          <p className="text-xs font-medium">⚠️ Could not load user collaborations: {loadError}</p>
          <p className="text-[10px] text-gray-400 mt-1">
            Make sure the current admin account is signed in, then refresh the page.
          </p>
        </div>
      )}

      {/* List — grouped by Parent → Collaboration/category → user-created entities */}
      {groups.length === 0 ? (
        <div className="text-center text-gray-400 py-8 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
          <p>No user collaborations found{filterStatus !== "all" ? ` (${filterStatus})` : ""}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={`${group.category}::${group.subCategory}`} className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl overflow-hidden">
              {/* Category → Collaboration/category group header */}
              <div className="px-4 py-2.5 bg-[#D4AF37]/10 border-b border-[#FFD166]/20 flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">{group.category}</span>
                {group.subCategory && <span className="text-sm text-[#FFD166]">→ {group.subCategory}</span>}
                <span className="ml-auto text-[10px] text-gray-500">{group.children.length} entit{group.children.length === 1 ? "y" : "ies"}</span>
              </div>
              <div className="divide-y divide-white/5">
                {group.children.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="p-4"
                  >
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 mb-0.5">
                          {group.category}
                          {group.subCategory ? ` → ${group.subCategory}` : ""}
                          {" → "}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white break-words">{c.businessName}</h3>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${statusBadge(c.status)}`}>{c.status}</span>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">Submitted {formatDateTime(c.submittedAt)}</p>
                      </div>
                    </div>

                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                      <div className="bg-black/40 rounded p-2">
                        <p className="text-gray-500">📍 Location</p>
                        <p className="text-white">{c.city || "N/A"}</p>
                        <p className="text-gray-400">{c.district}, {c.state}</p>
                      </div>
                      <div className="bg-black/40 rounded p-2">
                        <p className="text-gray-500">Submitted By</p>
                        <p className="text-white">{c.createdByName || "Anonymous"}</p>
                        <p className="text-gray-400">{c.createdByPhone || ""}</p>
                      </div>
                      <div className="bg-black/40 rounded p-2">
                        <p className="text-gray-500">Contact</p>
                        <p className="text-white">{c.createdByEmail || "N/A"}</p>
                        <p className="text-gray-400">Phone: {c.createdByPhone || "N/A"}</p>
                      </div>
                    </div>

                    {/* Admin actions */}
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {statusKey(c) === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(c)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-[10px] font-bold transition"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => handleReject(c)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-[10px] font-bold transition"
                          >
                            ❌ Reject
                          </button>
                        </>
                      )}
                      {statusKey(c) === "approved" && (
                        <span className="px-2 py-1 bg-green-600/30 text-green-400 rounded text-[10px]">
                          ✓ Approved {c.approvedAt ? formatDateTime(c.approvedAt) : ""}
                        </span>
                      )}
                      {statusKey(c) === "rejected" && (
                        <span className="px-2 py-1 bg-red-600/30 text-red-400 rounded text-[10px]">
                          ✗ Rejected {c.rejectedAt ? formatDateTime(c.rejectedAt) : ""}
                        </span>
                      )}
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(
                              {
                                name: c.businessName,
                                category: group.category,
                                subCategory: group.subCategory,
                                city: c.city,
                                district: c.district,
                                state: c.state,
                                submittedBy: c.createdByName,
                                phone: c.createdByPhone,
                                email: c.createdByEmail,
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

