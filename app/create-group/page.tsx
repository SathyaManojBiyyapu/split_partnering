"use client";

import { Suspense, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { db, auth } from "@/firebase/config";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { categoryData, slugToCategoryName, masterCategories } from "@/app/data/subcategories";
import toast from "react-hot-toast";
import Seo from "@/app/components/Seo";

/* -----------------------------------------
   GROUP SIZE (preserved from save/page.tsx)
------------------------------------------ */
const GROUP_SIZE: Record<string, number> = {
  split: 2,
  pass: 2,
  supplements: 3,
  "peter-england": 2,
  "louis-philippe": 2,
  unlimited: 2,
  trends: 2,
  wrogn: 2,
  wildcraft: 2,
  zara: 2,
  hm: 2,
  nike: 2,
  adidas: 2,
  "save-ticket": 2,
  "bulk-ticket": 2,
  splitbuy: 2,
  "lens-split": 2,
  car: 4,
  bike: 2,
  "couple-entry": 2,
  "group-save": 4,
  "best-deals": 2,
  "gift-card": 2,
  room: 6,
  weekend: 4,
  java: 2,
  python: 2,
  c: 2,
  dsa: 2,
  oops: 2,
  cn: 2,
  dbms: 2,
  os: 2,
  "previous-papers": 2,
};

const getRequiredSize = (opt: string) => GROUP_SIZE[opt] || 2;

/* -----------------------------------------
   MASK PHONE
------------------------------------------ */
const maskPhone = (phone: string) => {
  if (!phone) return "Hidden";
  if (phone.length < 5) return "xxxxx";
  return "xxxxx" + phone.slice(-5);
};

/* -----------------------------------------
   CREATE OR JOIN GROUP (preserved from save/page.tsx)
------------------------------------------ */
async function createOrJoinGroup(
  category: string,
  option: string,
  rawPhone: string,
  collaboratorId?: string,
  collaboratorName?: string
) {
  const cleanPhone = rawPhone.trim();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const userRef = doc(db, "users", cleanPhone);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};

  const groupsRef = collection(db, "groups");
  const q = query(
    groupsRef,
    where("category", "==", category),
    where("option", "==", option)
  );
  const snap = await getDocs(q);

  const memberObject = {
    uid: cleanPhone,
    phone: cleanPhone,
    maskedPhone: maskPhone(cleanPhone),
    name: userData.name || currentUser.displayName || "User",
    gender: userData.gender || "",
    photoURL: userData.photoURL || "",
    joinedAt: new Date(),
    online: true,
    paid: false,
    state: userData.state || "",
    district: userData.district || "",
    city: userData.city || "",
  };

  for (const gdoc of snap.docs) {
    const g = gdoc.data();
    const members = Array.isArray(g.members) ? g.members : [];
    const required = g.requiredSize || getRequiredSize(option);

    const alreadyExists = members.some((m: any) => {
      if (typeof m === "string") return m.trim() === cleanPhone;
      return m?.phone?.trim() === cleanPhone;
    });

    if (alreadyExists) {
      return { status: "already", membersCount: members.length, groupId: gdoc.id };
    }

    if (members.length < required) {
      const gRef = doc(db, "groups", gdoc.id);
      const updatedCount = members.length + 1;

      await updateDoc(gRef, {
        members: arrayUnion(memberObject),
        memberUIDs: arrayUnion(cleanPhone),
        membersCount: updatedCount,
        updatedAt: serverTimestamp(),
        lastActivityAt: serverTimestamp(),
        status: updatedCount >= required ? "ready" : "waiting",
      });

      if (updatedCount >= required) {
        await updateDoc(gRef, { readyAt: serverTimestamp() });
        if (typeof window !== "undefined") {
          toast.success("🎉 Your group is now ready!");
        }

        const chatsRef = collection(db, "chats");
        const qChat = query(chatsRef, where("groupId", "==", gdoc.id));
        const chatSnap = await getDocs(qChat);

        if (chatSnap.empty) {
          await addDoc(chatsRef, {
            groupId: gdoc.id,
            createdAt: serverTimestamp(),
            members: Array.isArray(g.members) ? [...g.members, memberObject] : [memberObject],
            memberUIDs: g.memberUIDs ? [...g.memberUIDs, cleanPhone] : [cleanPhone],
            lastMessage: "",
            lastMessageAt: serverTimestamp(),
            unreadCounts: {},
            isActive: true,
          });
        }
      }

      return {
        status: updatedCount >= required ? "ready" : "joined",
        membersCount: updatedCount,
        groupId: gdoc.id,
      };
    }
  }

  const newGroupRef = doc(groupsRef);
  const required = getRequiredSize(option);

  // expiresAt = 24 hours from now (server-side cleanup uses createdAt as source of truth)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await setDoc(newGroupRef, {
    category,
    option,
    collaboratorBrand: collaboratorName || "",
    collaboratorId: collaboratorId || "",
    members: [memberObject],
    memberUIDs: [cleanPhone],
    membersCount: 1,
    requiredSize: required,
    status: "waiting",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    createdBy: cleanPhone,
    totalPaid: 0,
    revenue: 0,
    expiresAt,
  });

  return { status: "created", membersCount: 1, groupId: newGroupRef.id };
}

/* -----------------------------------------
   HELPER: Get subcategory name from slug
------------------------------------------ */
function getSubcategoryName(categorySlug: string, optionSlug: string): string {
  const cat = categoryData[categorySlug];
  if (!cat) return "";
  const sub = cat.subcategories.find((s) => s.slug === optionSlug);
  return sub?.name || "";
}

/* -----------------------------------------
   CREATE GROUP CONTENT
------------------------------------------ */
function CreateGroupContent() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [category, setCategory] = useState("");
  const [option, setOption] = useState("");
  const [brand, setBrand] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [requiredSize, setRequiredSize] = useState(2);
  const [budget, setBudget] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  const [userProfile, setUserProfile] = useState<any>(null);

  /* -------- MOUNT -------- */
  useEffect(() => {
    setMounted(true);
    const savedPhone = localStorage.getItem("phone");
    const guest = localStorage.getItem("guest") === "true";
    setPhone(savedPhone);
    setIsGuest(guest);
  }, []);

  /* -------- LOGIN CHECK -------- */
  useEffect(() => {
    if (!mounted) return;
    if (isGuest || !phone) {
      toast.error("Please login to continue.");
      router.push("/login");
    }
  }, [mounted, isGuest, phone, router]);

  /* -------- LOAD USER PROFILE -------- */
  useEffect(() => {
    if (!phone) return;
    const fetchUser = async () => {
      try {
        const userRef = doc(db, "users", phone);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const d = snap.data() as any;
          setUserProfile(d);
          setState(d.state || "");
          setDistrict(d.district || "");
          setCity(d.city || "");
        }
      } catch (error) {
        console.error("User fetch error:", error);
      }
    };
    fetchUser();
  }, [phone]);

  /* -------- CATEGORY OPTIONS -------- */
  const categoryOptions = Object.entries(masterCategories).map(([slug, entry]) => ({
    slug,
    name: entry.name,
    icon: entry.icon,
    subcategories: entry.subcategories,
  }));

  const selectedCategory = categoryOptions.find((c) => c.slug === category);
  const optionSlug = option ? option.toLowerCase().replace(/\s+/g, "-") : "";
  const defaultSize = optionSlug ? getRequiredSize(optionSlug) : 2;

  /* -------- CREATE GROUP -------- */
  const handleCreate = async () => {
    if (!mounted) return;
    if (!phone) {
      toast.error("Please login first");
      return;
    }
    if (!auth.currentUser) {
      toast.error("User not logged in");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }
    if (!option) {
      toast.error("Please select a subcategory");
      return;
    }
    if (!state || !district || !city) {
      toast.error("Please select State, District, and City");
      return;
    }
    if (requiredSize < 2) {
      toast.error("Group size must be at least 2");
      return;
    }
    if (requiredSize > 20) {
      toast.error("Group size cannot exceed 20");
      return;
    }

    try {
      setLoading(true);
      const result = await createOrJoinGroup(
        category,
        optionSlug,
        phone,
        brand || undefined,
        brand || undefined
      );

      if (phone) {
        try {
          const userRef = doc(db, "users", phone);
          await updateDoc(userRef, {
            category: category.replace("-", " "),
            option: optionSlug,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          console.warn("Could not update user category:", err);
        }
      }

      await addDoc(collection(db, "selections"), {
        uid: phone,
        groupId: result.groupId,
        phone,
        maskedPhone: maskPhone(phone),
        userName: userProfile?.name || "Anonymous",
        category,
        option: optionSlug,
        collaboratorId: brand || "",
        collaboratorName: brand || "",
        paid: false,
        status: result.status,
        createdAt: serverTimestamp(),
      });

      toast.success(`Group created! Status: ${result.status}`);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("CREATE GROUP ERROR:", error);
      toast.error(error?.message || error?.code || "Failed to create group.");
    } finally {
      setLoading(false);
    }
  };

  /* -------- LOADING -------- */
  if (!mounted) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6 bg-black text-[#F5F5F5]">
      <Seo
        title="Create a Group"
        description="Create a PartnerSync group to split costs with compatible people nearby. Choose a category, set your location, and start saving together."
        canonicalPath="/create-group"
      />
      <div className="max-w-2xl mx-auto">
        {/* HEADING */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl mb-2 text-[#FFD166] leading-tight">
            Create a Group
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Start a new partner request. You'll be added as the first member automatically.
          </p>
        </motion.div>

        <div className="card-premium p-6 sm:p-8 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Category *</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setOption("");
                setBrand("");
              }}
              className="input w-full"
            >
              <option value="" className="bg-black">Select Category</option>
              {categoryOptions.map((c) => (
                <option key={c.slug} value={c.slug} className="bg-black">
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategory */}
          {selectedCategory && (
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Subcategory *</label>
              <select
                value={option}
                onChange={(e) => {
                  setOption(e.target.value);
                  const slug = e.target.value.toLowerCase().replace(/\s+/g, "-");
                  setRequiredSize(getRequiredSize(slug));
                }}
                className="input w-full"
              >
                <option value="" className="bg-black">Select Subcategory</option>
                {selectedCategory.subcategories.map((sub) => (
                  <option key={sub} value={sub} className="bg-black">{sub}</option>
                ))}
              </select>
            </div>
          )}

          {/* Brand / Product */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Brand / Product (optional)</label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. PVR, Gold's Gym, Netflix..."
              className="input w-full"
              maxLength={100}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">State *</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">District *</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">City *</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="input w-full"
              />
            </div>
          </div>

          {/* Required size */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Required Number of People: <span className="text-[#D4AF37] font-semibold">{requiredSize}</span>
            </label>
            <input
              type="range"
              min={2}
              max={20}
              value={requiredSize}
              onChange={(e) => setRequiredSize(parseInt(e.target.value))}
              className="w-full accent-[#D4AF37]"
            />
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>2</span>
              <span>20</span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">
              You'll be member 1. Need {Math.max(0, requiredSize - 1)} more.
            </p>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Budget / Price per person (optional)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 250"
              min={0}
              className="input w-full"
            />
          </div>

          {/* Date/Time */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Date / Time (optional)</label>
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              className="input w-full"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you looking for?"
              rows={3}
              className="input w-full resize-none"
              maxLength={500}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details for potential partners"
              rows={2}
              className="input w-full resize-none"
              maxLength={300}
            />
          </div>

          {/* Summary */}
          <div className="bg-black/40 border border-[#D4AF37]/20 rounded-xl p-4 text-sm">
            <p className="text-gray-300 mb-1">
              <span className="text-[#D4AF37] font-semibold">{selectedCategory?.name || "Category"}</span>
              {option && <span> → {option}</span>}
            </p>
            <p className="text-gray-400 text-xs">
              {city || "City"}, {state || "State"} · Need {Math.max(0, requiredSize - 1)} more ·{" "}
              {budget ? `₹${budget}/person` : "Budget not set"}
            </p>
          </div>

          {/* Submit */}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="btn-primary w-full text-center disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Group"}
          </button>

          <p className="text-[10px] text-gray-600 text-center">
            You'll be added as the first member. Your identity stays masked until a match is confirmed.
          </p>
        </div>

        {/* BACK LINK */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push("/categories")}
            className="text-sm text-gray-400 hover:text-[#D4AF37] transition-colors cursor-pointer"
          >
            ← Back to Categories
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CreateGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading...
        </div>
      }
    >
      <CreateGroupContent />
    </Suspense>
  );
}