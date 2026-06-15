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
  query,
  orderBy,
  where,
  Timestamp,
} from "firebase/firestore";

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

const generateUserId = (phone: string): string => {
  if (!phone) return "PS-00000";
  const digits = phone.replace(/\D/g, "");
  return `PS-${digits.slice(-5)}`;
};

const formatCurrency = (amount: number) => {
  return `₹${amount.toLocaleString()}`;
};

const categoryList = ["Fashion", "Movies", "Gym", "Travel", "Books", "Events", "Lenskart", "Coupons", "Villas"];

/* ---------------------------------------
   STATUS CONFIG
---------------------------------------- */

const statusColors: Record<string, string> = {
  Requested: "bg-blue-600",
  Pending: "bg-yellow-500 text-black",
  Ready: "bg-green-600",
  Paid: "bg-emerald-500",
  Cancelled: "bg-gray-600",
  Expired: "bg-red-600",
};

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Raw data
  const [groups, setGroups] = useState<any[]>([]);
  const [matchRequests, setMatchRequests] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [userDocs, setUserDocs] = useState<any[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterCity, setFilterCity] = useState("All");

  // View states
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"matches" | "groups" | "analytics" | "users" | "fraud" | "collaborators">("matches");
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [collaboratorFilterStatus, setCollaboratorFilterStatus] = useState("all");

  /* ---------------------------------------
     ADMIN AUTH
  ---------------------------------------- */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email === "sathyamanojbiyyapu@gmail.com") {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.push("/");
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  /* ---------------------------------------
     FETCH ALL DATA
  ---------------------------------------- */

  useEffect(() => {
    if (!authorized) return;
    setRefreshing(true);

    // Groups
    const unsubGroups = onSnapshot(collection(db, "groups"), (snapshot) => {
      const gs: any[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        const members = Array.isArray(data.members) ? data.members : [];
        const cleaned = members.map((m: any) => {
          if (typeof m === "string") return { uid: m.trim(), phone: m.trim(), name: "User", photoURL: "", paid: false };
          return {
            uid: m?.uid || m?.phone || "",
            phone: m?.phone || "N/A",
            name: m?.name || "User",
            photoURL: m?.photoURL || "",
            paid: m?.paid || false,
          };
        });
        gs.push({
          id: d.id,
          ...data,
          membersDetailed: cleaned,
          membersCount: typeof data.membersCount === "number" ? data.membersCount : cleaned.length,
        });
      });
      gs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setGroups(gs);
    });

    // Match Requests
    const unsubMatches = onSnapshot(
      query(collection(db, "matchRequests"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const reqs: any[] = [];
        snapshot.forEach((d) => reqs.push({ id: d.id, ...d.data() }));
        setMatchRequests(reqs);
      }
    );

    // Payments
    const unsubPayments = onSnapshot(collection(db, "payments"), (snapshot) => {
      const ps: any[] = [];
      snapshot.forEach((d) => ps.push({ id: d.id, ...d.data() }));
      setPayments(ps);
    });

    // Users
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const us: any[] = [];
      snapshot.forEach((d) => us.push({ id: d.id, ...d.data() }));
      setUserDocs(us);
      setAllUsers(us.filter(u => u.profileCompleted));
    });

    // Collaborators
    const unsubCollaborators = onSnapshot(
      query(collection(db, "collaborators"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const cols: any[] = [];
        snapshot.forEach((d) => cols.push({ id: d.id, ...d.data() }));
        setCollaborators(cols);
      }
    );

    setTimeout(() => setRefreshing(false), 2000);

    return () => {
      unsubGroups();
      unsubMatches();
      unsubPayments();
      unsubUsers();
      unsubCollaborators();
    };
  }, [authorized]);

  /* ---------------------------------------
     COMPUTED ANALYTICS
  ---------------------------------------- */

  // Match analytics
  const totalMatchRequests = matchRequests.length;
  const requestedMatches = matchRequests.filter(r => r.status === "Requested").length;
  const pendingMatches = matchRequests.filter(r => r.status === "Pending").length;
  const readyMatches = matchRequests.filter(r => r.status === "Ready").length;
  const paidMatches = matchRequests.filter(r => r.status === "Paid").length;
  const expiredMatches = matchRequests.filter(r => r.status === "Expired").length;
  const cancelledMatches = matchRequests.filter(r => r.status === "Cancelled").length;
  const activeMatches = requestedMatches + pendingMatches;

  // Payment analytics
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date();
  monthStart.setDate(monthStart.getDate() - 30);

  const todayPayments = payments.filter(p => {
    const d = p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : new Date(p.createdAt);
    return d >= todayStart;
  });
  const weeklyPayments = payments.filter(p => {
    const d = p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : new Date(p.createdAt);
    return d >= weekStart;
  });
  const monthlyPayments = payments.filter(p => {
    const d = p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : new Date(p.createdAt);
    return d >= monthStart;
  });

  const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.amount || 29), 0);
  const weeklyRevenue = weeklyPayments.reduce((sum, p) => sum + (p.amount || 29), 0);
  const monthlyRevenue = monthlyPayments.reduce((sum, p) => sum + (p.amount || 29), 0);
  const totalRevenue = payments.reduce((sum, p) => sum + (p.amount || 29), 0);

  // Category analytics
  const categoryAnalytics = categoryList.map(cat => {
    const catMatches = matchRequests.filter(r => r.category === cat);
    return {
      name: cat,
      totalUsers: userDocs.filter(u => u.category === cat).length,
      totalMatches: catMatches.length,
      readyMatches: catMatches.filter(r => r.status === "Ready" || r.status === "Paid").length,
      paidMatches: catMatches.filter(r => r.status === "Paid").length,
    };
  });

  // City analytics
  const cityMap: Record<string, { users: Set<string>; matches: number; paid: number }> = {};
  userDocs.forEach(u => {
    if (u.city) {
      if (!cityMap[u.city]) cityMap[u.city] = { users: new Set(), matches: 0, paid: 0 };
      cityMap[u.city].users.add(u.phone);
    }
  });
  matchRequests.forEach(r => {
    const cityA = r.userA?.city;
    const cityB = r.userB?.city;
    if (cityA) {
      if (!cityMap[cityA]) cityMap[cityA] = { users: new Set(), matches: 0, paid: 0 };
      cityMap[cityA].matches++;
      if (r.status === "Paid") cityMap[cityA].paid++;
    }
    if (cityB) {
      if (!cityMap[cityB]) cityMap[cityB] = { users: new Set(), matches: 0, paid: 0 };
      cityMap[cityB].matches++;
      if (r.status === "Paid") cityMap[cityB].paid++;
    }
  });
  const cityAnalytics = Object.entries(cityMap)
    .map(([city, data]) => ({ city, users: data.users.size, matches: data.matches, paid: data.paid }))
    .sort((a, b) => b.users - a.users);

  // Conversion funnel
  const totalUsers = userDocs.length;
  const matchedUsers = matchRequests.length;
  const readyMatchCount = readyMatches + paidMatches;
  const paidMatchCount = paidMatches;

  // Recent activity
  const recentActivity: { time: Date; text: string; type: string }[] = [];
  matchRequests.slice(0, 20).forEach(r => {
    const time = r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000) : new Date();
    if (r.status === "Requested") {
      recentActivity.push({ time, text: `${r.userA?.userId || "?"} requested ${r.category || "?"} → ${r.option || "?"}`, type: "request" });
    }
    if (r.status === "Paid") {
      recentActivity.push({ time, text: `${r.userA?.userId || "?"} completed payment`, type: "payment" });
    }
    if (r.status === "Expired") {
      recentActivity.push({ time, text: `${r.userA?.userId || "?"} match expired`, type: "expired" });
    }
  });
  payments.slice(0, 10).forEach(p => {
    const time = p.createdAt?.seconds ? new Date(p.createdAt.seconds * 1000) : new Date();
    recentActivity.push({ time, text: `Payment completed — ${formatCurrency(p.amount || 29)}`, type: "payment" });
  });
  recentActivity.sort((a, b) => b.time.getTime() - a.time.getTime());

  // Fraud monitoring
  const phoneCounts: Record<string, number> = {};
  userDocs.forEach(u => {
    if (u.phone) phoneCounts[u.phone] = (phoneCounts[u.phone] || 0) + 1;
  });
  const duplicatePhones = Object.entries(phoneCounts).filter(([_, count]) => count > 1);
  const failedPayments = payments.filter(p => p.status === "failed" || p.failed === true);

  // Filter match requests
  const filteredMatches = matchRequests.filter(r => {
    if (filterStatus !== "All" && r.status !== filterStatus) return false;
    if (filterCategory !== "All" && r.category !== filterCategory) return false;
    if (filterCity !== "All") {
      const matchesCity = r.userA?.city === filterCity || r.userB?.city === filterCity;
      if (!matchesCity) return false;
    }
    return true;
  });

  /* ---------------------------------------
     ACTIONS
  ---------------------------------------- */

  const adminLogout = async () => {
    await signOut(auth);
    setAuthorized(false);
    router.push("/");
  };

  const updateMatchStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, "matchRequests", id), { status, updatedAt: new Date() });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMatchRequest = async (id: string) => {
    if (!confirm("Delete this match request?")) return;
    try {
      await deleteDoc(doc(db, "matchRequests", id));
    } catch (err) {
      console.error(err);
    }
  };

  const markGroupCompleted = async (id: string) => {
    try {
      await updateDoc(doc(db, "groups", id), { status: "completed", lastActivityAt: new Date() });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("Delete this group permanently?")) return;
    try {
      await deleteDoc(doc(db, "groups", id));
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black text-white flex items-center justify-center">Checking admin access...</div>;
  }

  if (!authorized) return null;

  /* ============================================
     RENDER
  ============================================ */

  return (
    <div className="min-h-screen bg-black text-[#F5F5F5]">

      {/* ===== HEADER ===== */}
      <div className="sticky top-0 z-30 bg-black/80 backdrop-blur-xl border-b border-[#D4AF37]/10 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-[#FFD166]">Admin</h1>
          <div className="flex gap-2 flex-wrap items-center text-xs">
            <span className="text-gray-400">{new Date().toLocaleDateString()}</span>
            <button onClick={() => window.location.reload()} className="px-2 py-1 bg-blue-600 rounded">
              {refreshing ? "..." : "Refresh"}
            </button>
            <button onClick={adminLogout} className="px-2 py-1 bg-red-600 rounded">Logout</button>
          </div>
        </div>
        {/* Tab nav */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-2 overflow-x-auto text-xs pb-1">
          {(["matches", "groups", "analytics", "users", "fraud", "collaborators"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-full transition whitespace-nowrap ${
                activeTab === tab ? "bg-[#D4AF37] text-black font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              {tab === "matches" ? "🔄 Matches" : tab === "groups" ? "📦 Groups" : tab === "analytics" ? "📊 Analytics" : tab === "users" ? "👥 Users" : tab === "fraud" ? "🚩 Fraud" : "🤝 Collaborators"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">

        {/* ===== 14: SUMMARY HEADER ===== */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-blue-400">{totalUsers}</p>
            <p className="text-[9px] text-gray-400">Total Users</p>
          </div>
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-blue-400">{activeMatches}</p>
            <p className="text-[9px] text-gray-400">Active Matches</p>
          </div>
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-green-400">{readyMatchCount}</p>
            <p className="text-[9px] text-gray-400">Ready Matches</p>
          </div>
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-emerald-400">{paidMatchCount}</p>
            <p className="text-[9px] text-gray-400">Paid Matches</p>
          </div>
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-[#FFD166]">{formatCurrency(totalRevenue)}</p>
            <p className="text-[9px] text-gray-400">Revenue</p>
          </div>
          <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
            <p className="text-lg sm:text-xl font-bold text-purple-400">{groups.length}</p>
            <p className="text-[9px] text-gray-400">Groups</p>
          </div>
        </div>

        {/* ==========================================
            TAB: MATCHES
        ========================================== */}
        {activeTab === "matches" && (
          <div>

            {/* 3: Match Analytics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-6">
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{totalMatchRequests}</p>
                <p className="text-[9px] text-gray-400">Total Requests</p>
              </div>
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{requestedMatches}</p>
                <p className="text-[9px] text-gray-400">Requested</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">{pendingMatches}</p>
                <p className="text-[9px] text-gray-400">Pending</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-400">{readyMatchCount}</p>
                <p className="text-[9px] text-gray-400">Ready</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{expiredMatches}</p>
                <p className="text-[9px] text-gray-400">Expired</p>
              </div>
              <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-gray-400">{cancelledMatches}</p>
                <p className="text-[9px] text-gray-400">Cancelled</p>
              </div>
            </div>

            {/* 8: Conversion Funnel */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">📊 Match Conversion Funnel</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Users Joined", value: totalUsers, pct: 100, color: "bg-blue-500" },
                  { label: "Match Requested", value: matchedUsers, pct: totalUsers ? Math.round((matchedUsers / totalUsers) * 100) : 0, color: "bg-blue-400" },
                  { label: "Ready", value: readyMatchCount, pct: totalUsers ? Math.round((readyMatchCount / totalUsers) * 100) : 0, color: "bg-green-500" },
                  { label: "Paid", value: paidMatchCount, pct: totalUsers ? Math.round((paidMatchCount / totalUsers) * 100) : 0, color: "bg-emerald-500" },
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <p className="text-xl font-bold text-white">{item.value}</p>
                    <p className="text-[10px] text-gray-400">{item.label}</p>
                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden mt-1">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <p className="text-[9px] text-gray-500 mt-0.5">{item.pct}%</p>
                  </div>
                ))}
              </div>
              {/* Funnel arrows */}
              <div className="flex justify-between mt-2 text-[9px] text-gray-600">
                <span>↓</span><span>↓</span><span>↓</span>
              </div>
            </div>

            {/* 9: Filters */}
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
              >
                <option value="All">All Status</option>
                <option value="Requested">Requested</option>
                <option value="Pending">Pending</option>
                <option value="Ready">Ready</option>
                <option value="Paid">Paid</option>
                <option value="Expired">Expired</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
              >
                <option value="All">All Categories</option>
                {categoryList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
              >
                <option value="All">All Cities</option>
                {cityAnalytics.slice(0, 10).map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search User ID..."
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs flex-1 min-w-[120px]"
              />
            </div>

            {/* 1: Match Requests List */}
            {filteredMatches.length === 0 ? (
              <div className="text-center text-gray-400 py-8 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
                <p>No match requests found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredMatches.map((req) => {
                  const userIdA = req.userA?.userId || generateUserId(req.userA?.phone);
                  const userIdB = req.userB?.userId || generateUserId(req.userB?.phone);
                  const matchesSearch = userIdA.includes(search) || userIdB.includes(search);

                  if (search && !matchesSearch) return null;

                  return (
                    <div key={req.id} className="p-3 sm:p-4 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm">🤝</span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#FFD166] font-mono break-all">
                              {userIdA} ↔ {userIdB}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {req.category || "N/A"} {req.option ? `→ ${req.option}` : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:ml-auto">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${statusColors[req.status] || "bg-gray-600"}`}>
                            {req.status || "Requested"}
                          </span>
                          <span className="text-[9px] text-gray-500">{formatDateTime(req.createdAt)}</span>
                        </div>
                      </div>

                      {/* Details grid */}
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">User A</p>
                          <p className="text-white font-mono">{userIdA}</p>
                          <p className="text-gray-400">{req.userA?.city || ""}{req.userA?.city && ", "}{req.userA?.state || ""}</p>
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">User B</p>
                          <p className="text-white font-mono">{userIdB}</p>
                          <p className="text-gray-400">{req.userB?.city || ""}{req.userB?.city && ", "}{req.userB?.state || ""}</p>
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">Match</p>
                          <p className={`font-bold ${req.compatibility >= 90 ? "text-green-400" : req.compatibility >= 50 ? "text-blue-400" : "text-yellow-400"}`}>
                            {req.matchQuality || "N/A"}
                          </p>
                          <p className="text-gray-400">{req.compatibility || 0}% Compatible</p>
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">{req.userA?.district || req.userB?.district ? "District" : ""}</p>
                          <p className="text-white">{req.userA?.district || req.userB?.district || "—"}</p>
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => setViewingUser(req.userA)} className="text-[9px] text-[#FFD166] hover:underline">View A</button>
                            <button onClick={() => setViewingUser(req.userB)} className="text-[9px] text-[#FFD166] hover:underline">View B</button>
                          </div>
                        </div>
                      </div>

                      {/* 12: Quick Actions */}
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {req.status === "Requested" && (
                          <button onClick={() => updateMatchStatus(req.id, "Pending")} className="px-2 py-1 bg-yellow-600 rounded text-[10px]">Pending</button>
                        )}
                        {(req.status === "Requested" || req.status === "Pending") && (
                          <button onClick={() => updateMatchStatus(req.id, "Ready")} className="px-2 py-1 bg-green-600 rounded text-[10px]">Ready</button>
                        )}
                        {req.status !== "Expired" && req.status !== "Cancelled" && (
                          <>
                            <button onClick={() => updateMatchStatus(req.id, "Expired")} className="px-2 py-1 bg-red-700 rounded text-[10px]">Expire</button>
                            <button onClick={() => updateMatchStatus(req.id, "Cancelled")} className="px-2 py-1 bg-gray-600 rounded text-[10px]">Cancel</button>
                          </>
                        )}
                        <button onClick={() => deleteMatchRequest(req.id)} className="px-2 py-1 bg-red-600 rounded text-[10px]">Delete</button>
                        <button onClick={() => { navigator.clipboard.writeText(`${userIdA}, ${userIdB}`); }} className="px-2 py-1 bg-blue-600/50 rounded text-[10px]">Copy</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 12: Export Data */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  const csv = [["UserA_ID", "UserB_ID", "Category", "Option", "Status", "Compatibility", "CityA", "CityB", "Created"].join(","),
                    ...filteredMatches.map(r =>
                      [r.userA?.userId || "", r.userB?.userId || "", r.category || "", r.option || "", r.status || "", r.compatibility || 0, r.userA?.city || "", r.userB?.city || "", formatDateTime(r.createdAt)].join(",")
                    )].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `match-requests-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 bg-green-700 rounded text-xs"
              >
                Export CSV
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: GROUPS
        ========================================== */}
        {activeTab === "groups" && (
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No groups found</div>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="p-4 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <p className="text-base sm:text-lg font-bold text-[#FFD166]">{g.category} → {g.option}</p>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      g.status === "completed" ? "bg-green-600" : g.status === "ready" ? "bg-blue-600" : "bg-yellow-500 text-black"
                    }`}>{g.status}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{g.membersCount}/{g.requiredSize} members · {formatDateTime(g.createdAt)}</p>
                  <div className="mt-3 space-y-2">
                    {(g.membersDetailed || []).map((m: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 bg-black/40 p-2 rounded">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-[10px] text-[#FFD166] font-bold flex-shrink-0">
                          {generateUserId(m.phone).slice(-4)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white">{m.name}</p>
                          <p className="text-[10px] text-gray-400">{m.phone}</p>
                        </div>
                        <span className={`text-[10px] font-bold ${m.paid ? "text-green-400" : "text-red-400"}`}>
                          {m.paid ? "Paid" : "Not Paid"}
                        </span>
                        <button
                          onClick={() => window.open(`https://wa.me/91${m.phone}`)}
                          className="text-green-400 text-sm"
                        >🟢</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => markGroupCompleted(g.id)} className="px-2 py-1 bg-blue-600 rounded text-[10px]">Complete</button>
                    <button onClick={() => deleteGroup(g.id)} className="px-2 py-1 bg-red-600 rounded text-[10px]">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==========================================
            TAB: ANALYTICS
        ========================================== */}
        {activeTab === "analytics" && (
          <div>

            {/* 7: Payment Analytics */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">💰 Payment Analytics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-black/40 rounded-lg">
                  <p className="text-lg font-bold text-green-400">{formatCurrency(todayRevenue)}</p>
                  <p className="text-[10px] text-gray-400">Today</p>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg">
                  <p className="text-lg font-bold text-green-400">{formatCurrency(weeklyRevenue)}</p>
                  <p className="text-[10px] text-gray-400">This Week</p>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg">
                  <p className="text-lg font-bold text-green-400">{formatCurrency(monthlyRevenue)}</p>
                  <p className="text-[10px] text-gray-400">This Month</p>
                </div>
                <div className="text-center p-3 bg-black/40 rounded-lg">
                  <p className="text-lg font-bold text-[#FFD166]">{formatCurrency(totalRevenue)}</p>
                  <p className="text-[10px] text-gray-400">Total</p>
                </div>
              </div>
            </div>

            {/* 4: Category Analytics */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4 mb-6">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">📁 Category Analytics</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left py-2 pr-2">Category</th>
                      <th className="text-center py-2 px-2">Users</th>
                      <th className="text-center py-2 px-2">Matches</th>
                      <th className="text-center py-2 px-2">Ready</th>
                      <th className="text-center py-2 px-2">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryAnalytics.map((cat) => (
                      <tr key={cat.name} className="border-b border-gray-800/50">
                        <td className="py-2 pr-2 text-white font-medium">{cat.name}</td>
                        <td className="text-center py-2 px-2 text-blue-400">{cat.totalUsers}</td>
                        <td className="text-center py-2 px-2 text-yellow-400">{cat.totalMatches}</td>
                        <td className="text-center py-2 px-2 text-green-400">{cat.readyMatches}</td>
                        <td className="text-center py-2 px-2 text-emerald-400">{cat.paidMatches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5: City Analytics */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">📍 Top Cities</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-800">
                      <th className="text-left py-2 pr-2">City</th>
                      <th className="text-center py-2 px-2">Users</th>
                      <th className="text-center py-2 px-2">Matches</th>
                      <th className="text-center py-2 px-2">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cityAnalytics.slice(0, 15).map((city) => (
                      <tr key={city.city} className="border-b border-gray-800/50">
                        <td className="py-2 pr-2 text-white">{city.city}</td>
                        <td className="text-center py-2 px-2 text-blue-400">{city.users}</td>
                        <td className="text-center py-2 px-2 text-yellow-400">{city.matches}</td>
                        <td className="text-center py-2 px-2 text-emerald-400">{city.paid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: USERS
        ========================================== */}
        {activeTab === "users" && (
          <div>
            {/* Viewing user modal */}
            {viewingUser && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingUser(null)}>
                <div className="bg-[#0c0c0c] border border-[#FFD166]/30 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-[#FFD166]">User Details</h3>
                    <button onClick={() => setViewingUser(null)} className="text-gray-400 hover:text-white">✕</button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">User ID</span>
                      <span className="text-white font-mono">{viewingUser.userId || generateUserId(viewingUser.phone)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Name</span>
                      <span className="text-white">{viewingUser.name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Phone</span>
                      <span className="text-white">{viewingUser.phone || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">City</span>
                      <span className="text-white">{viewingUser.city || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">District</span>
                      <span className="text-white">{viewingUser.district || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">State</span>
                      <span className="text-white">{viewingUser.state || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Category</span>
                      <span className="text-white">{viewingUser.category || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Profile</span>
                      <span className={viewingUser.profileCompleted ? "text-green-400" : "text-red-400"}>
                        {viewingUser.profileCompleted ? "Completed ✅" : "Incomplete"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users table */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4 overflow-x-auto">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">👥 All Users</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-800">
                    <th className="text-left py-2 pr-2">User ID</th>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Phone</th>
                    <th className="text-left py-2 px-2">City</th>
                    <th className="text-center py-2 px-2">Profile</th>
                    <th className="text-center py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userDocs.filter(u => {
                    if (search) {
                      const q = search.toLowerCase();
                      return (u.name || "").toLowerCase().includes(q) || (u.phone || "").includes(q) || generateUserId(u.phone).toLowerCase().includes(q);
                    }
                    return true;
                  }).slice(0, 50).map((u) => (
                    <tr key={u.phone || u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 pr-2 text-[#FFD166] font-mono">{generateUserId(u.phone)}</td>
                      <td className="py-2 px-2 text-white">{u.name || "N/A"}</td>
                      <td className="py-2 px-2 text-gray-400">{u.phone || "N/A"}</td>
                      <td className="py-2 px-2 text-gray-400">{u.city || u.state || "N/A"}</td>
                      <td className="text-center py-2 px-2">
                        <span className={u.profileCompleted ? "text-green-400" : "text-red-400"}>
                          {u.profileCompleted ? "✅" : "❌"}
                        </span>
                      </td>
                      <td className="text-center py-2 px-2">
                        <button
                          onClick={() => setViewingUser(u)}
                          className="text-[10px] text-[#FFD166] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {userDocs.length > 50 && (
                <p className="text-[10px] text-gray-500 mt-2">Showing 50 of {userDocs.length} users</p>
              )}
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: FRAUD
        ========================================== */}
        {activeTab === "fraud" && (
          <div className="space-y-6">
            {/* Duplicate phones */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">🚩 Duplicate Phone Numbers</h3>
              {duplicatePhones.length === 0 ? (
                <p className="text-xs text-gray-500">No duplicates found</p>
              ) : (
                <div className="space-y-2">
                  {duplicatePhones.map(([phone, count]) => (
                    <div key={phone} className="flex items-center justify-between bg-red-900/20 p-2 rounded">
                      <span className="text-xs text-white font-mono">{phone}</span>
                      <span className="text-xs text-red-400">{count} accounts</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Failed payments */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-red-400 mb-3">💳 Failed Payments</h3>
              {failedPayments.length === 0 ? (
                <p className="text-xs text-gray-500">No failed payments</p>
              ) : (
                <div className="space-y-2">
                  {failedPayments.slice(0, 20).map((p, i) => (
                    <div key={i} className="flex items-center justify-between bg-red-900/20 p-2 rounded">
                      <span className="text-xs text-white">{p.uid || "Unknown"}</span>
                      <span className="text-xs text-red-400">{p.amount ? formatCurrency(p.amount) : "₹29"} · {formatDateTime(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 10: Recent Activity */}
            <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-4">
              <h3 className="text-sm font-bold text-[#FFD166] mb-3">📝 Recent Activity</h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {recentActivity.slice(0, 30).map((activity, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-gray-800/30">
                    <span className={
                      activity.type === "request" ? "text-blue-400" :
                      activity.type === "payment" ? "text-green-400" :
                      "text-red-400"
                    }>●</span>
                    <span className="text-gray-300 flex-1 truncate">{activity.text}</span>
                    <span className="text-gray-500 flex-shrink-0">{activity.time.toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            TAB: COLLABORATORS
        ========================================== */}
        {activeTab === "collaborators" && (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={collaboratorFilterStatus}
                onChange={(e) => setCollaboratorFilterStatus(e.target.value)}
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="featured">Featured</option>
                <option value="hidden">Hidden</option>
              </select>
              <input
                value={collaboratorSearch}
                onChange={(e) => setCollaboratorSearch(e.target.value)}
                placeholder="Search business or brand..."
                className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs flex-1 min-w-[150px]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-blue-400">{collaborators.length}</p>
                <p className="text-[9px] text-gray-400">Total</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-yellow-400">{collaborators.filter(c => c.status === "pending").length}</p>
                <p className="text-[9px] text-gray-400">Pending</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-green-400">{collaborators.filter(c => c.status === "approved" || c.status === "featured").length}</p>
                <p className="text-[9px] text-gray-400">Approved</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-red-400">{collaborators.filter(c => c.status === "rejected").length}</p>
                <p className="text-[9px] text-gray-400">Rejected</p>
              </div>
            </div>

            {collaborators.length === 0 ? (
              <div className="text-center text-gray-400 py-8 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
                <p>No collaborator requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {collaborators
                  .filter(c => {
                    if (collaboratorFilterStatus !== "all" && c.status !== collaboratorFilterStatus) return false;
                    if (collaboratorSearch) {
                      const q = collaboratorSearch.toLowerCase();
                      return (c.businessName || "").toLowerCase().includes(q) || (c.brandName || "").toLowerCase().includes(q);
                    }
                    return true;
                  })
                  .map((c) => (
                    <div key={c.id} className="p-4 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
                      <div className="flex justify-between items-start flex-wrap gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-white">{c.businessName || "Unknown"}</h3>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full ${
                              c.status === "approved" ? "bg-green-600" :
                              c.status === "featured" ? "bg-purple-600" :
                              c.status === "rejected" ? "bg-red-600" :
                              c.status === "hidden" ? "bg-gray-600" :
                              "bg-yellow-500 text-black"
                            }`}>{c.status || "pending"}</span>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {c.category} → {c.brandName}
                          </p>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatDateTime(c.createdAt)}
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">Contact</p>
                          <p className="text-white">{c.phone || "N/A"}</p>
                          {c.email && <p className="text-gray-400">{c.email}</p>}
                        </div>
                        <div className="bg-black/40 rounded p-2">
                          <p className="text-gray-500">Location</p>
                          <p className="text-white">{c.city || "N/A"}</p>
                          {c.website && <p className="text-blue-400 truncate">{c.website}</p>}
                        </div>
                        <div className="bg-black/40 rounded p-2 sm:col-span-1 col-span-2">
                          <p className="text-gray-500">Description</p>
                          <p className="text-white truncate">{c.description || "N/A"}</p>
                        </div>
                      </div>

                      {/* Admin actions */}
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        {c.status !== "approved" && (
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, "collaborators", c.id), { status: "approved", updatedAt: new Date() });
                            }}
                            className="px-2 py-1 bg-green-600 rounded text-[10px]"
                          >
                            Approve
                          </button>
                        )}
                        {c.status !== "featured" && c.status === "approved" && (
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, "collaborators", c.id), { status: "featured", updatedAt: new Date() });
                            }}
                            className="px-2 py-1 bg-purple-600 rounded text-[10px]"
                          >
                            Feature
                          </button>
                        )}
                        {c.status !== "rejected" && (
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, "collaborators", c.id), { status: "rejected", updatedAt: new Date() });
                            }}
                            className="px-2 py-1 bg-red-600 rounded text-[10px]"
                          >
                            Reject
                          </button>
                        )}
                        {c.status !== "hidden" && (
                          <button
                            onClick={async () => {
                              await updateDoc(doc(db, "collaborators", c.id), { status: "hidden", updatedAt: new Date() });
                            }}
                            className="px-2 py-1 bg-gray-600 rounded text-[10px]"
                          >
                            Hide
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Delete this collaborator?")) return;
                            await deleteDoc(doc(db, "collaborators", c.id));
                          }}
                          className="px-2 py-1 bg-red-700 rounded text-[10px]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}