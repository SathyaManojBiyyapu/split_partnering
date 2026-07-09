"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "@/firebase/config";
import { collection, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
import {
  subscribeToAllMarketplaceBusinesses,
  getMarketplaceStats,
  createMarketplaceBusiness,
  updateMarketplaceBusiness,
  deleteMarketplaceBusiness,
  toggleVisibleMarketplaceBusiness,
  toggleFeaturedMarketplaceBusiness,
  duplicateMarketplaceBusiness,
  bulkDeleteMarketplaceBusinesses,
  bulkSetVisibleMarketplaceBusinesses,
  bulkSetFeaturedMarketplaceBusinesses,
  MarketplaceBusiness,
  MarketplaceStats,
  ScopeType,
} from "@/app/lib/marketplaceManager";
import { categoryConfigs, getCategoryName, allCategorySlugs } from "@/app/data/categoryConfig";
import toast from "react-hot-toast";

/* ----------------------------------------
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

const scopeColors: Record<ScopeType, string> = {
  national: "bg-purple-600/20 text-purple-400 border-purple-500/30",
  state: "bg-blue-600/20 text-blue-400 border-blue-500/30",
  district: "bg-green-600/20 text-green-400 border-green-500/30",
  city: "bg-yellow-600/20 text-yellow-400 border-yellow-500/30",
};

/* ----------------------------------------
   MARKETPLACE MANAGER COMPONENT
---------------------------------------- */

export default function MarketplaceManager() {
  const [businesses, setBusinesses] = useState<MarketplaceBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterScope, setFilterScope] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");
  const [filterFeatured, setFilterFeatured] = useState<string>("all");
  const [filterVisible, setFilterVisible] = useState<string>("all");
  
  // Selection for bulk ops
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<MarketplaceBusiness | null>(null);

  // Load businesses
  useEffect(() => {
    const unsub = subscribeToAllMarketplaceBusinesses((data) => {
      setBusinesses(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const stats: MarketplaceStats = getMarketplaceStats(businesses);

  // Filter businesses
  const filtered = businesses.filter((b) => {
    if (search) {
      const q = search.toLowerCase();
      const match =
        (b.businessName || "").toLowerCase().includes(q) ||
        (b.category || "").toLowerCase().includes(q) ||
        (b.subcategory || "").toLowerCase().includes(q) ||
        (b.state || "").toLowerCase().includes(q) ||
        (b.district || "").toLowerCase().includes(q) ||
        (b.city || "").toLowerCase().includes(q) ||
        (b.scope || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterScope !== "all" && b.scope !== filterScope) return false;
    if (filterCategory !== "all" && b.categorySlug !== filterCategory) return false;
    if (filterVerified !== "all" && (filterVerified === "verified" ? !b.verified : b.verified)) return false;
    if (filterFeatured !== "all" && (filterFeatured === "featured" ? !b.featured : b.featured)) return false;
    if (filterVisible !== "all" && (filterVisible === "visible" ? !b.visible : b.visible)) return false;
    return true;
  });

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => `${b.categorySlug}::${b.id}`)));
    }
    setSelectAll(!selectAll);
  };

  const getSelectedItems = () => {
    return Array.from(selectedIds).map((id) => {
      const [categorySlug, businessId] = id.split("::");
      return { categorySlug, businessId };
    });
  };

  // Bulk operations
  const handleBulkDelete = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    if (!confirm(`Delete ${items.length} businesses permanently?`)) return;
    try {
      await bulkDeleteMarketplaceBusinesses(items);
      toast.success(`Deleted ${items.length} businesses`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err?.message || "Bulk delete failed");
    }
  };

  const handleBulkHide = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    try {
      await bulkSetVisibleMarketplaceBusinesses(items, false);
      toast.success(`Hidden ${items.length} businesses`);
    } catch (err: any) {
      toast.error(err?.message || "Bulk hide failed");
    }
  };

  const handleBulkShow = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    try {
      await bulkSetVisibleMarketplaceBusinesses(items, true);
      toast.success(`Shown ${items.length} businesses`);
    } catch (err: any) {
      toast.error(err?.message || "Bulk show failed");
    }
  };

  const handleBulkFeature = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    try {
      await bulkSetFeaturedMarketplaceBusinesses(items, true);
      toast.success(`Featured ${items.length} businesses`);
    } catch (err: any) {
      toast.error(err?.message || "Bulk feature failed");
    }
  };

  const handleBulkUnfeature = async () => {
    const items = getSelectedItems();
    if (items.length === 0) return;
    try {
      await bulkSetFeaturedMarketplaceBusinesses(items, false);
      toast.success(`Unfeatured ${items.length} businesses`);
    } catch (err: any) {
      toast.error(err?.message || "Bulk unfeature failed");
    }
  };

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mb-6">
        <StatCard value={stats.total} label="Total" color="text-blue-400" />
        <StatCard value={stats.verified} label="Verified" color="text-green-400" />
        <StatCard value={stats.featured} label="Featured" color="text-purple-400" />
        <StatCard value={stats.hidden} label="Hidden" color="text-red-400" />
        <StatCard value={stats.national} label="National" color="text-purple-400" />
        <StatCard value={stats.state} label="State" color="text-blue-400" />
        <StatCard value={stats.district} label="District" color="text-green-400" />
        <StatCard value={stats.city} label="City" color="text-yellow-400" />
        <StatCard value={stats.categories} label="Categories" color="text-[#FFD166]" />
        <StatCard value={stats.citiesCovered} label="Cities" color="text-[#FFD166]" />
      </div>

      {/* Add Business Button */}
      <div className="mb-6">
        <button
          onClick={() => {
            setEditingBusiness(null);
            setShowAddModal(true);
          }}
          className="px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-[#D4AF37] to-[#E6C97A] text-black hover:scale-[1.02] transition-all"
        >
          + Add Marketplace Business
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, category, city..."
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs flex-1 min-w-[150px]"
        />
        <select
          value={filterScope}
          onChange={(e) => setFilterScope(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Scopes</option>
          <option value="national">National</option>
          <option value="state">State</option>
          <option value="district">District</option>
          <option value="city">City</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Categories</option>
          {allCategorySlugs.map((slug) => (
            <option key={slug} value={slug}>
              {getCategoryName(slug)}
            </option>
          ))}
        </select>
        <select
          value={filterVerified}
          onChange={(e) => setFilterVerified(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Verified</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        <select
          value={filterFeatured}
          onChange={(e) => setFilterFeatured(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Featured</option>
          <option value="featured">Featured</option>
          <option value="unfeatured">Not Featured</option>
        </select>
        <select
          value={filterVisible}
          onChange={(e) => setFilterVisible(e.target.value)}
          className="bg-[#0c0c0c] border border-[#FFD166]/20 px-2 py-1 rounded text-xs"
        >
          <option value="all">All Visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 p-3 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">{selectedIds.size} selected</span>
          <button onClick={handleBulkDelete} className="px-2 py-1 bg-red-600 rounded text-[10px]">Delete</button>
          <button onClick={handleBulkHide} className="px-2 py-1 bg-gray-600 rounded text-[10px]">Hide</button>
          <button onClick={handleBulkShow} className="px-2 py-1 bg-green-600 rounded text-[10px]">Show</button>
          <button onClick={handleBulkFeature} className="px-2 py-1 bg-purple-600 rounded text-[10px]">Feature</button>
          <button onClick={handleBulkUnfeature} className="px-2 py-1 bg-yellow-600 rounded text-[10px]">Unfeature</button>
        </div>
      )}

      {/* Business List */}
      {loading ? (
        <div className="text-center text-gray-400 py-8 animate-pulse">Loading marketplace businesses...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-8 bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl">
          <p>No marketplace businesses found.</p>
          {search && <p className="text-xs text-gray-500 mt-1">Try a different search query.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All checkbox */}
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={selectAll}
              onChange={toggleSelectAll}
              className="accent-[#D4AF37]"
            />
            <span className="text-[10px] text-gray-500">Select All ({filtered.length} visible)</span>
          </div>

          {filtered.map((business, idx) => {
            const key = `${business.categorySlug}::${business.id}`;
            const isSelected = selectedIds.has(key);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className={`p-4 bg-[#0c0c0c] border rounded-xl transition ${
                  isSelected ? "border-[#FFD166] bg-[#FFD166]/5" : "border-[#FFD166]/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(key)}
                    className="accent-[#D4AF37] mt-1"
                  />

                  {/* Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
                    <img
                      src={business.image || business.defaultImage || "/placeholder.webp"}
                      alt={business.businessName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white">{business.businessName}</h3>
                      {business.verified && <span className="badge-verified text-[8px]">✓</span>}
                      {business.featured && <span className="text-[8px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-full">⭐ Featured</span>}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${scopeColors[business.scope] || scopeColors.city}`}>
                        {business.scope?.toUpperCase() || "CITY"}
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${business.visible ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                        {business.visible ? "Visible" : "Hidden"}
                      </span>
                    </div>
                    
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-gray-400">
                      <span>{business.category} {business.subcategory ? `→ ${business.subcategory}` : ""}</span>
                      {business.scope === "national" && <span>🌍 India</span>}
                      {business.scope === "state" && <span>📍 {business.state}</span>}
                      {business.scope === "district" && <span>📍 {business.district}, {business.state}</span>}
                      {business.scope === "city" && <span>📍 {business.city}, {business.district}, {business.state}</span>}
                    </div>

                    <div className="mt-1 flex flex-wrap gap-2 text-[9px] text-gray-500">
                      <span>👥 {business.waitingUsers} waiting</span>
                      <span>👤 {business.createdBy || "Admin"}</span>
                      <span>📅 {formatDateTime(business.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingBusiness(business);
                        setShowAddModal(true);
                      }}
                      className="px-2 py-1 bg-blue-600/50 rounded text-[8px] hover:bg-blue-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${business.businessName}"?`)) return;
                        try {
                          await deleteMarketplaceBusiness(business.categorySlug, business.id!);
                          toast.success("Deleted");
                        } catch (err: any) {
                          toast.error(err?.message || "Delete failed");
                        }
                      }}
                      className="px-2 py-1 bg-red-600/50 rounded text-[8px] hover:bg-red-600"
                    >
                      Delete
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await toggleVisibleMarketplaceBusiness(business.categorySlug, business.id!, !business.visible);
                          toast.success(business.visible ? "Hidden" : "Shown");
                        } catch (err: any) {
                          toast.error(err?.message || "Toggle failed");
                        }
                      }}
                      className={`px-2 py-1 rounded text-[8px] ${business.visible ? "bg-gray-600/50 hover:bg-gray-600" : "bg-green-600/50 hover:bg-green-600"}`}
                    >
                      {business.visible ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await toggleFeaturedMarketplaceBusiness(business.categorySlug, business.id!, !business.featured);
                          toast.success(business.featured ? "Unfeatured" : "Featured");
                        } catch (err: any) {
                          toast.error(err?.message || "Toggle failed");
                        }
                      }}
                      className={`px-2 py-1 rounded text-[8px] ${business.featured ? "bg-yellow-600/50 hover:bg-yellow-600" : "bg-purple-600/50 hover:bg-purple-600"}`}
                    >
                      {business.featured ? "Unfeature" : "Feature"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await duplicateMarketplaceBusiness(business.categorySlug, business.id!);
                          toast.success("Duplicated");
                        } catch (err: any) {
                          toast.error(err?.message || "Duplicate failed");
                        }
                      }}
                      className="px-2 py-1 bg-gray-700/50 rounded text-[8px] hover:bg-gray-700"
                    >
                      Duplicate
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <AddMarketplaceBusinessModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingBusiness(null);
        }}
        existingBusiness={editingBusiness}
      />
    </div>
  );
}

/* ----------------------------------------
   STAT CARD
---------------------------------------- */

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-[#0c0c0c] border border-[#FFD166]/20 rounded-xl p-3 text-center">
      <p className={`text-lg sm:text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[9px] text-gray-400">{label}</p>
    </div>
  );
}

/* ----------------------------------------
   ADD/EDIT BUSINESS MODAL
---------------------------------------- */

interface AddMarketplaceBusinessModalProps {
  open: boolean;
  onClose: () => void;
  existingBusiness?: MarketplaceBusiness | null;
}

function AddMarketplaceBusinessModal({ open, onClose, existingBusiness }: AddMarketplaceBusinessModalProps) {
  const isEditing = !!existingBusiness;

  const [businessName, setBusinessName] = useState(existingBusiness?.businessName || "");
  const [categorySlug, setCategorySlug] = useState(existingBusiness?.categorySlug || "gym");
  const [subcategory, setSubcategory] = useState(existingBusiness?.subcategory || "");
  const [description, setDescription] = useState(existingBusiness?.description || "");
  const [image, setImage] = useState(existingBusiness?.image || "");
  const [scope, setScope] = useState<ScopeType>(existingBusiness?.scope || "city");
  const [country, setCountry] = useState(existingBusiness?.country || "India");
  const [state, setState] = useState(existingBusiness?.state || "");
  const [district, setDistrict] = useState(existingBusiness?.district || "");
  const [city, setCity] = useState(existingBusiness?.city || "");
  const [verified, setVerified] = useState(existingBusiness?.verified ?? true);
  const [featured, setFeatured] = useState(existingBusiness?.featured ?? false);
  const [visible, setVisible] = useState(existingBusiness?.visible ?? true);
  const [waitingUsers, setWaitingUsers] = useState(existingBusiness?.waitingUsers ?? 0);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setBusinessName(existingBusiness?.businessName || "");
      setCategorySlug(existingBusiness?.categorySlug || "gym");
      setSubcategory(existingBusiness?.subcategory || "");
      setDescription(existingBusiness?.description || "");
      setImage(existingBusiness?.image || "");
      setScope(existingBusiness?.scope || "city");
      setCountry(existingBusiness?.country || "India");
      setState(existingBusiness?.state || "");
      setDistrict(existingBusiness?.district || "");
      setCity(existingBusiness?.city || "");
      setVerified(existingBusiness?.verified ?? true);
      setFeatured(existingBusiness?.featured ?? false);
      setVisible(existingBusiness?.visible ?? true);
      setWaitingUsers(existingBusiness?.waitingUsers ?? 0);
    }
  }, [open, existingBusiness]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = businessName.trim();
    if (!name) {
      toast.error("Business name is required");
      return;
    }

    setSubmitting(true);
    try {
      const adminPhone = typeof window !== "undefined" ? localStorage.getItem("phone") || "admin" : "admin";

      if (isEditing && existingBusiness?.id && existingBusiness?.categorySlug) {
        await updateMarketplaceBusiness(existingBusiness.categorySlug, existingBusiness.id, {
          businessName: name,
          category: getCategoryName(categorySlug),
          categorySlug,
          subcategory,
          description,
          image,
          scope,
          country,
          state,
          district,
          city,
          verified,
          featured,
          visible,
          waitingUsers,
        });
        toast.success(`"${name}" updated`);
      } else {
        await createMarketplaceBusiness({
          businessName: name,
          category: getCategoryName(categorySlug),
          categorySlug,
          subcategory,
          description,
          image,
          verified,
          featured,
          visible,
          scope,
          country,
          state,
          district,
          city,
          waitingUsers,
          createdBy: adminPhone,
        });
        toast.success(`"${name}" created in marketplace`);
      }
      onClose();
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err?.message || "Operation failed");
    }
    setSubmitting(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-premium p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-heading text-[#FFD166]">
                  {isEditing ? `Edit: ${existingBusiness?.businessName}` : "Add Marketplace Business"}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white transition text-lg">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Business Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-gray-400 text-xs mb-1.5">Business Name *</label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g. Gold's Gym"
                      className="input w-full"
                      autoFocus
                      maxLength={200}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Category *</label>
                    <select
                      value={categorySlug}
                      onChange={(e) => setCategorySlug(e.target.value)}
                      className="input w-full"
                    >
                      {allCategorySlugs.map((slug) => (
                        <option key={slug} value={slug}>{getCategoryName(slug)}</option>
                      ))}
                    </select>
                  </div>

                  {/* Subcategory */}
                  <div>
                    <label className="block text-gray-400 text-xs mb-1.5">Subcategory</label>
                    <input
                      type="text"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      placeholder="e.g. Gym Membership Split"
                      className="input w-full"
                    />
                  </div>

                  {/* Description */}
                  <div className="sm:col-span-2">
                    <label className="block text-gray-400 text-xs mb-1.5">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description..."
                      rows={2}
                      className="input w-full resize-none"
                    />
                  </div>

                  {/* Image URL */}
                  <div className="sm:col-span-2">
                    <label className="block text-gray-400 text-xs mb-1.5">Image URL</label>
                    <input
                      type="text"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="/gym.webp or https://..."
                      className="input w-full"
                    />
                  </div>
                </div>

                {/* Location Scope */}
                <div className="border-t border-white/10 pt-4">
                  <label className="block text-gray-400 text-xs mb-2">Location Scope *</label>
                  <div className="flex gap-2 mb-3">
                    {(["national", "state", "district", "city"] as ScopeType[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setScope(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                          scope === s
                            ? "bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#FFD166]"
                            : "bg-[#0c0c0c] border-gray-700 text-gray-300 hover:border-[#D4AF37]/30"
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-400 text-xs mb-1.5">Country</label>
                      <input
                        type="text"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="input w-full"
                        disabled={scope === "national"}
                      />
                    </div>
                    {scope !== "national" && (
                      <div>
                        <label className="block text-gray-400 text-xs mb-1.5">State *</label>
                        <input
                          type="text"
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="e.g. Andhra Pradesh"
                          className="input w-full"
                        />
                      </div>
                    )}
                    {(scope === "district" || scope === "city") && (
                      <div>
                        <label className="block text-gray-400 text-xs mb-1.5">District *</label>
                        <input
                          type="text"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                          placeholder="e.g. Guntur"
                          className="input w-full"
                        />
                      </div>
                    )}
                    {scope === "city" && (
                      <div>
                        <label className="block text-gray-400 text-xs mb-1.5">City *</label>
                        <input
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Tenali"
                          className="input w-full"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Toggles */}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={verified}
                        onChange={(e) => setVerified(e.target.checked)}
                        className="accent-[#D4AF37]"
                      />
                      <span className="text-xs text-gray-300">Verified</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={featured}
                        onChange={(e) => setFeatured(e.target.checked)}
                        className="accent-[#D4AF37]"
                      />
                      <span className="text-xs text-gray-300">Featured</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => setVisible(e.target.checked)}
                        className="accent-[#D4AF37]"
                      />
                      <span className="text-xs text-gray-300">Visible</span>
                    </label>
                    <div>
                      <label className="block text-gray-400 text-xs mb-0.5">Waiting Users</label>
                      <input
                        type="number"
                        value={waitingUsers}
                        onChange={(e) => setWaitingUsers(parseInt(e.target.value) || 0)}
                        className="bg-[#0c0c0c] border border-gray-700 px-2 py-1 rounded text-xs w-20"
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={submitting || !businessName.trim()}
                    className="btn-primary flex-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Saving..." : isEditing ? "Update Business" : "Create Business"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 text-sm hover:text-white transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}