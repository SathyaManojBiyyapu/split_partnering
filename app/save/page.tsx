"use client";

import {
  Suspense,
  useState,
  useEffect,
} from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  useSearchParams,
  useRouter,
} from "next/navigation";

import {
  db,
  auth,
} from "@/firebase/config";

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

import { partneringInfo } from "@/app/data/partneringInfo";
import { getExpiryDate } from "@/app/data/matchExpiry";
import { categoryData, slugToCategoryName } from "@/app/data/subcategories";
import MarketplaceGrid from "@/app/components/marketplace/MarketplaceGrid";
import toast from "react-hot-toast";

/* -----------------------------------------
   GROUP SIZE
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
   NORMALIZE CITY
------------------------------------------ */

const normalize = (value: string | null | undefined): string =>
  value?.trim().toLowerCase() || "";

/* -----------------------------------------
   CREATE OR JOIN GROUP
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
    expiresAt: getExpiryDate(category),
  });

  return { status: "created", membersCount: 1, groupId: newGroupRef.id };
}

/* -----------------------------------------
   COLLABORATOR BRANDS COMPONENT
------------------------------------------ */

function CollaboratorBrandSelector({
  categorySlug,
  optionSlug,
  selectedBrand,
  onSelect,
}: {
  categorySlug: string;
  optionSlug: string;
  selectedBrand: string | null;
  onSelect: (id: string, name: string) => void;
}) {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCity, setUserCity] = useState<string>("");
  const [userDistrict, setUserDistrict] = useState<string>("");
  const [userState, setUserState] = useState<string>("");

  const categoryName = slugToCategoryName[categorySlug] || "";
  const subcategoryName = getSubcategoryName(categorySlug, optionSlug);

  const getVerificationBadge = (level: string | number | undefined) => {
    if (!level || level === 1) return { badge: "✓ Verified", color: "text-green-400 bg-green-500/10" };
    if (level === 2) return { badge: "✓✓ Trusted Partner", color: "text-blue-400 bg-blue-500/10" };
    if (level === 3) return { badge: "👑 Premium Partner", color: "text-purple-400 bg-purple-500/10" };
    return { badge: "✓ Verified", color: "text-green-400 bg-green-500/10" };
  };

  const getLocationBadge = (brand: any): { label: string; color: string } => {
    if (brand.city && normalize(brand.city) === normalize(userCity)) return { label: "Same City", color: "🟢" };
    if (brand.district && normalize(brand.district) === normalize(userDistrict)) return { label: "Same District", color: "🟡" };
    if (brand.state && normalize(brand.state) === normalize(userState)) return { label: "Same State", color: "🔵" };
    return { label: "", color: "" };
  };

  useEffect(() => {
    const phone = localStorage.getItem("phone");
    if (!phone) return;
    const fetchUser = async () => {
      try {
        const snap = await getDoc(doc(db, "users", phone));
        if (snap.exists()) {
          const d = snap.data();
          setUserCity(d.city || "");
          setUserDistrict(d.district || "");
          setUserState(d.state || "");
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (!categoryName || !subcategoryName) {
      setLoading(false);
      return;
    }

    const fetchBrands = async () => {
      try {
        const q = query(
          collection(db, "collaborators"),
          where("category", "==", categoryName),
          where("subcategory", "==", subcategoryName),
          where("status", "in", ["approved", "featured"])
        );
        const snap = await getDocs(q);
        const items: any[] = [];
        snap.forEach((d) => {
          const data = d.data();
          items.push({ id: d.id, ...data });
          if (data.viewCount === undefined) {
            updateDoc(doc(db, "collaborators", d.id), { viewCount: 1 });
          } else {
            updateDoc(doc(db, "collaborators", d.id), { viewCount: (data.viewCount || 0) + 1 });
          }
        });

        items.sort((a, b) => {
          const getPriority = (item: any) => {
            if (item.city && normalize(item.city) === normalize(userCity)) return 0;
            if (item.district && normalize(item.district) === normalize(userDistrict)) return 1;
            if (item.state && normalize(item.state) === normalize(userState)) return 2;
            return 3;
          };
          const aP = getPriority(a);
          const bP = getPriority(b);
          if (aP !== bP) return aP - bP;
          if (a.status === "featured" && b.status !== "featured") return -1;
          if (a.status !== "featured" && b.status === "featured") return 1;
          return 0;
        });

        setBrands(items);
      } catch (err) {
        console.error("Error fetching collaborators:", err);
      }
      setLoading(false);
    };

    fetchBrands();
  }, [categoryName, subcategoryName, userCity, userDistrict, userState]);

  if (loading) {
    return (
      <div className="mb-6">
        <div className="animate-pulse text-gray-500 text-xs">Loading partner brands...</div>
      </div>
    );
  }

  const getTitle = () => {
    if (userCity) return `Recommended in ${userCity}`;
    return "Recommended Near You";
  };

  const currentCityBrands = brands.filter((b) => normalize(b.city) === normalize(userCity));
  const otherCityBrands = brands.filter((b) => normalize(b.city) !== normalize(userCity));
  const noCityBrands = brands.filter((b) => !b.city || normalize(b.city) === "");

  const renderBrandCard = (brand: any, isFeatured: boolean) => {
    const isSelected = selectedBrand === brand.id;
    const locBadge = getLocationBadge(brand);
    const vBadge = getVerificationBadge(brand.verificationLevel);
    const logoUrl = brand.logoUrl || null;
    return (
      <button
        key={brand.id}
        onClick={() => {
          onSelect(brand.id, brand.option || brand.businessName || brand.id);
          const currentSelects = (brand.selectCount || 0) + 1;
          updateDoc(doc(db, "collaborators", brand.id), { selectCount: currentSelects, updatedAt: new Date() });
        }}
        className={`text-left p-3 rounded-xl border transition-all ${
          isSelected
            ? "border-[#FFD166] bg-[#FFD166]/10"
            : isFeatured
            ? "border-purple-500/40 bg-purple-900/10 hover:border-purple-500/70"
            : "border-gray-700 bg-[#0c0c0c] hover:border-[#FFD166]/50"
        } ${isFeatured ? "relative overflow-hidden" : ""}`}
      >
        {isFeatured && (
          <div className="absolute top-0 right-0">
            <div className="bg-purple-600 text-white text-[7px] font-bold px-2 py-0.5 rounded-bl-lg">
              ⭐ FEATURED
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-gray-700">
              <img src={logoUrl} alt={brand.option || brand.businessName} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#E6C97A]/10 border border-[#D4AF37]/20 flex items-center justify-center text-sm flex-shrink-0">
              🏪
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm">{brand.option || brand.businessName}</p>
            {isFeatured && <p className="text-[9px] text-purple-400 font-medium">⭐ Featured Partner</p>}
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${vBadge.color}`}>{vBadge.badge}</span>
              {locBadge.label && (
                <span className="text-[8px] text-gray-400 font-medium px-1.5 py-0.5 rounded-full bg-gray-800">
                  {locBadge.color} {locBadge.label}
                </span>
              )}
            </div>
            {brand.city && <p className="text-[10px] text-gray-500 mt-0.5">📍 {brand.city}</p>}
          </div>
          {isSelected && (
            <div className="w-5 h-5 rounded-full bg-[#FFD166] flex items-center justify-center flex-shrink-0">
              <span className="text-black text-[10px] font-bold">✓</span>
            </div>
          )}
        </div>
        {brand.description && <p className="text-[10px] text-gray-500 mt-2 line-clamp-1">{brand.description}</p>}
      </button>
    );
  };

  const renderBrandSection = (brandList: any[], title: string, showTitle: boolean) => {
    const featured = brandList.filter(b => b.status === "featured");
    const regular = brandList.filter(b => b.status !== "featured");
    if (brandList.length === 0) return null;
    return (
      <div className="mb-4">
        {showTitle && <h3 className="text-sm font-semibold text-[#FFD166] mb-3">{title}</h3>}
        <div className="space-y-3">
          {featured.length > 0 && (
            <div>
              <p className="text-[10px] text-purple-400 font-medium mb-2">⭐ Featured Partners</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{featured.map(brand => renderBrandCard(brand, true))}</div>
            </div>
          )}
          {regular.length > 0 && (
            <div>
              {featured.length > 0 && <p className="text-[10px] text-gray-500 font-medium mb-2">More Partner Brands</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{regular.map(brand => renderBrandCard(brand, false))}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const hasCurrentCity = currentCityBrands.length > 0;
  const hasOtherCity = otherCityBrands.length > 0 || noCityBrands.length > 0;

  return (
    <div className="mb-6">
      {hasCurrentCity && renderBrandSection(currentCityBrands, getTitle(), true)}
      {hasOtherCity && (
        <div>
          <h3 className="text-sm font-semibold text-[#FFD166] mb-3">Recommended in Other Cities</h3>
          <div className="space-y-3">
            {otherCityBrands.length > 0 && renderBrandSection(otherCityBrands, "", false)}
            {noCityBrands.length > 0 && renderBrandSection(noCityBrands, "", false)}
          </div>
        </div>
      )}
      {!hasCurrentCity && !hasOtherCity && (
        <div className="border border-dashed border-gray-700 rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs">No verified partner brands available yet.</p>
          <p className="text-gray-600 text-[10px] mt-1">You can still proceed with matching without selecting a brand.</p>
        </div>
      )}
    </div>
  );
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
   SAVE CONTENT
------------------------------------------ */

function SaveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const category = searchParams.get("category") || "";
  const option = searchParams.get("option") || "";

  const [mounted, setMounted] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingGroup, setExistingGroup] = useState<any>(null);
  const [duplicateCategory, setDuplicateCategory] = useState(false);
  const [duplicateGroupId, setDuplicateGroupId] = useState<string | null>(null);
  const [activeSubcategories, setActiveSubcategories] = useState<string[]>([]);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);
  const [selectedCollaboratorName, setSelectedCollaboratorName] = useState<string | null>(null);

  const info = partneringInfo[category];
  const subcategoryName = getSubcategoryName(category, option);

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

  /* -------- LOAD USER -------- */
  useEffect(() => {
    if (!phone) return;
    const fetchUser = async () => {
      try {
        const userRef = doc(db, "users", phone);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const d = snap.data() as any;
          setUserName(d.name || null);
        }
      } catch (error) {
        console.error("User fetch error:", error);
      }
    };
    fetchUser();
  }, [phone]);

  /* -------- FETCH ACTIVE SUBCATEGORIES -------- */
  useEffect(() => {
    if (!phone || !category) return;
    const fetchActiveSubcategories = async () => {
      try {
        const q = query(collection(db, "groups"), where("category", "==", category));
        const snap = await getDocs(q);
        const activeOptions: string[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const members = Array.isArray(data.members) ? data.members : [];
          const isMember = members.some((m: any) => {
            if (typeof m === "string") return m.trim() === phone;
            return m?.phone?.trim() === phone;
          });
          if (isMember && data.option && !activeOptions.includes(data.option)) {
            activeOptions.push(data.option);
          }
        });
        setActiveSubcategories(activeOptions);
      } catch (err) {
        console.error("Error fetching active subcategories:", err);
      }
    };
    fetchActiveSubcategories();
  }, [phone, category]);

  /* -------- CHECK EXISTING -------- */
  useEffect(() => {
    if (!phone || !category || !option) return;

    const checkExisting = async () => {
      try {
        const qCatGroups = query(collection(db, "groups"), where("category", "==", category));
        const catSnap = await getDocs(qCatGroups);
        let foundDup = false;
        let dupId: string | null = null;

        for (const catDoc of catSnap.docs) {
          const catData = catDoc.data();
          const catMembers = catData.members || [];
          const isIn = catMembers.some((m: any) => m?.phone === phone);
          if (isIn) {
            foundDup = true;
            dupId = catDoc.id;
            break;
          }
        }
        setDuplicateCategory(foundDup);
        setDuplicateGroupId(dupId);

        const qGroups = query(
          collection(db, "groups"),
          where("category", "==", category),
          where("option", "==", option)
        );
        const snap = await getDocs(qGroups);
        for (const d of snap.docs) {
          const data = d.data();
          const exists = (data.members || []).some((m: any) => m?.phone === phone);
          if (exists) {
            setExistingGroup({ id: d.id, ...data });
            break;
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    checkExisting();
  }, [phone, category, option]);

  /* -------- SAVE -------- */
  const savePartner = async () => {
    if (!mounted) return;
    if (!phone) {
      toast.error("Please login first");
      return;
    }
    if (!auth.currentUser) {
      toast.error("User not logged in");
      return;
    }

    try {
      setLoading(true);
      const result = await createOrJoinGroup(
        category,
        option,
        phone,
        selectedCollaboratorId || undefined,
        selectedCollaboratorName || undefined
      );

      if (phone) {
        try {
          const userRef = doc(db, "users", phone);
          await updateDoc(userRef, {
            category: category.replace("-", " "),
            option: option,
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
        userName: userName || "Anonymous",
        category,
        option,
        collaboratorId: selectedCollaboratorId || "",
        collaboratorName: selectedCollaboratorName || "",
        paid: false,
        status: result.status,
        createdAt: serverTimestamp(),
      });

      toast.success(`Partner saved! Status: ${result.status}`);
      router.push("/dashboard");
    } catch (error: any) {
      console.error("SAVE ERROR:", error);
      toast.error(error?.message || error?.code || "Saving failed.");
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

  /* ==================== UI ==================== */
  return (
    <div className="min-h-screen pt-28 pb-16 px-4 sm:px-6 bg-black text-[#F5F5F5]">
      <div className="max-w-5xl mx-auto">

        {/* HEADING */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-heading text-2xl sm:text-3xl md:text-4xl mb-2 text-[#FFD166] leading-tight">
            Find Your Partner
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mb-6">
            Browse businesses and select one to start matching with partners.
          </p>
        </motion.div>

        {/* STATUS MESSAGES */}
        {existingGroup && (
          <div className="mb-4 border border-emerald-500/30 bg-emerald-500/10 rounded-xl p-4">
            <p className="text-emerald-400 font-bold text-base flex items-center gap-2">✅ Partner Already Saved</p>
            <p className="text-gray-300 text-xs mt-1">You have already saved a partner match for this option. Head to your dashboard to view or manage your match.</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => router.push("/dashboard")} className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition">View My Dashboard →</button>
              <button onClick={() => router.push("/categories")} className="px-4 py-2 rounded-lg text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition">Browse Other Categories</button>
            </div>
          </div>
        )}

        {duplicateCategory && !existingGroup && activeSubcategories.length > 0 && (
          <div className="mb-4 border border-yellow-500/30 bg-yellow-500/10 rounded-xl p-4">
            <p className="text-yellow-400 font-bold text-sm flex items-center gap-2">✅ Already Active in {category.replace("-", " ")}</p>
            <p className="text-gray-300 text-xs mt-1">You already have active requests in:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activeSubcategories.map((sub) => (
                <span key={sub} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#FFD166]">• {sub}</span>
              ))}
            </div>
            <p className="text-gray-500 text-[10px] mt-2">Joining one of these again will update the existing request instead of creating a new one.</p>
          </div>
        )}

        {/* GENERIC MARKETPLACE GRID - works for ALL categories */}
        <div className="mb-8">
          <MarketplaceGrid
            categorySlug={category}
            subcategory={subcategoryName}
            buttonLabel="Make Partner →"
            buttonHrefBuilder={(business: { businessName: string; id: string }) =>
              `/dashboard?category=${category}&option=${option}&business=${business.businessName}&businessId=${business.id}`
            }
            showAddButton={true}
            addButtonType="business"
            emptyMessage={`No ${subcategoryName || "businesses"} found in your city yet.`}
          />
        </div>

        {/* HOW IT WORKS INFO */}
        {info && (
          <div className="mb-8 border border-white/10 p-5 sm:p-6 rounded-xl bg-white/[0.02]">
            <h2 className="text-base font-semibold text-[#D4AF37] mb-2">{info.title}</h2>
            {info.topLine && <p className="text-gray-400 text-sm mb-4">{info.topLine}</p>}
            <ul className="space-y-3 text-sm">
              {info.sections.map((sec: any, i: number) => (
                <li key={i}>
                  <span className="font-medium text-[#D4AF37]">{sec.title}</span>
                  <div className="text-gray-400">{sec.text}</div>
                  {sec.example && <div className="text-gray-500 text-xs mt-1">{sec.example}</div>}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-gray-500 mt-4 italic">SplitPartnering is a partnering service. We do not buy or sell products.</p>
          </div>
        )}

        {/* COLLABORATOR BRAND SELECTION */}
        <div className="mb-8">
          <CollaboratorBrandSelector
            categorySlug={category}
            optionSlug={option}
            selectedBrand={selectedCollaboratorId}
            onSelect={(id, name) => {
              setSelectedCollaboratorId(selectedCollaboratorId === id ? null : id);
              setSelectedCollaboratorName(selectedCollaboratorId === id ? null : name);
            }}
          />
        </div>

        {selectedCollaboratorName && (
          <div className="mb-6 border border-green-500/30 bg-green-500/10 rounded-xl p-4">
            <p className="text-green-400 font-bold text-sm">✅ Selected Brand: {selectedCollaboratorName}</p>
            <p className="text-gray-300 text-xs mt-1">Your match will be associated with this partner brand.</p>
          </div>
        )}

        {/* BOTTOM CTAs */}
        <div className="flex items-center justify-center gap-4 mt-8 pt-6 border-t border-white/5">
          <button
            onClick={savePartner}
            disabled={loading}
            className="px-8 py-3.5 rounded-xl font-semibold text-sm bg-[#D4AF37] text-black hover:bg-[#E6C97A] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Saving..." : existingGroup ? "Partner Already Saved ✓" : "Make Partner"}
          </button>
        </div>

        {/* BACK LINK */}
        <div className="mt-6 text-center">
          <button onClick={() => router.push("/categories")} className="text-sm text-gray-400 hover:text-[#D4AF37] transition-colors">
            ← Back to Categories
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SavePage() {
  return (
    <Suspense fallback={<p className="text-gray-400 p-10">Loading...</p>}>
      <SaveContent />
    </Suspense>
  );
}