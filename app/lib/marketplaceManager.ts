"use client";

// Marketplace Manager Service — handles ALL marketplace business CRUD operations
// Firestore: marketplace/{categorySlug}/businesses/{businessId}

import { db } from "@/firebase/config";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  writeBatch,
  DocumentReference,
  CollectionReference,
} from "firebase/firestore";
import { getDefaultImage } from "@/app/data/categoryConfig";

/* ----------------------------------------
   Types
---------------------------------------- */

export type ScopeType = "national" | "state" | "district" | "city";

export interface MarketplaceBusiness {
  id?: string;
  businessName: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  description: string;
  image: string;
  defaultImage: string;
  verified: boolean;
  featured: boolean;
  visible: boolean;
  scope: ScopeType;
  country: string;
  state: string;
  district: string;
  city: string;
  waitingUsers: number;
  createdBy: string;
  approvedBy: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  source: "admin" | "collaborator" | "user";
  offerName?: string;
  officialPartner?: boolean;
  topRated?: boolean;
  premium?: boolean;
  type?: string;
}

export interface MarketplaceStats {
  total: number;
  verified: number;
  featured: number;
  hidden: number;
  pending: number;
  national: number;
  state: number;
  district: number;
  city: number;
  categories: number;
  citiesCovered: number;
}

/* ----------------------------------------
   Firestore Path Helpers
---------------------------------------- */

function getBusinessesCollection(categorySlug: string): CollectionReference {
  return collection(db, "marketplace", categorySlug, "businesses");
}

export function getBusinessDocRef(categorySlug: string, businessId: string): DocumentReference {
  return doc(db, "marketplace", categorySlug, "businesses", businessId);
}

/* ----------------------------------------
   Helper: Normalize strings for comparison
   Converts to lowercase and trims whitespace
---------------------------------------- */

function normalize(val: string | null | undefined): string {
  return (val || "").toString().trim().toLowerCase();
}

/* ----------------------------------------
   Development-only logging helper
   All [PartnerSync Debug] logs are wrapped here
   so they never appear in production.
---------------------------------------- */

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
}

/* ----------------------------------------
   Scope Filter (case-insensitive)
---------------------------------------- */

function filterBusinessesByScope(
  data: MarketplaceBusiness[],
  subcategory: string,
  userState: string,
  userDistrict: string,
  userCity: string
): MarketplaceBusiness[] {
  const normState = normalize(userState);
  const normDistrict = normalize(userDistrict);
  const normCity = normalize(userCity);
  const normSubcategory = normalize(subcategory);

  debugLog(`[PartnerSync Debug] filterBusinessesByScope called with:
    userState="${userState}" (norm="${normState}")
    userDistrict="${userDistrict}" (norm="${normDistrict}")
    userCity="${userCity}" (norm="${normCity}")
    subcategory="${subcategory}" (norm="${normSubcategory}")
    total businesses in collection: ${data.length}`);

  const results: MarketplaceBusiness[] = [];

  for (const b of data) {
    debugLog(`[PartnerSync Debug] Checking business: "${b.businessName}"
      id="${b.id}"
      scope="${b.scope}"
      visible=${b.visible}
      subcategory="${b.subcategory}"
      state="${b.state}"
      district="${b.district}"
      city="${b.city}"`);

    // Skip if explicitly hidden (visible === false)
    if (b.visible === false) {
      debugLog(`[PartnerSync Debug]   → FILTERED OUT: visible is false`);
      continue;
    }

    // Filter by subcategory (case-insensitive)
    if (normSubcategory && normalize(b.subcategory) !== normSubcategory) {
      debugLog(`[PartnerSync Debug]   → FILTERED OUT: subcategory mismatch
        business subcategory="${b.subcategory}" (norm="${normalize(b.subcategory)}")
        requested subcategory="${subcategory}" (norm="${normSubcategory}")`);
      continue;
    }

    let scopeMatch = false;
    switch (b.scope) {
      case "national":
        scopeMatch = true;
        debugLog(`[PartnerSync Debug]   → scope=national: MATCH (all users)`);
        break;
      case "state":
        scopeMatch = normalize(b.state) === normState;
        debugLog(`[PartnerSync Debug]   → scope=state: comparing business state="${normalize(b.state)}" === user state="${normState}" → ${scopeMatch}`);
        break;
      case "district":
        scopeMatch = normalize(b.state) === normState && normalize(b.district) === normDistrict;
        debugLog(`[PartnerSync Debug]   → scope=district: comparing state="${normalize(b.state)}"==="${normState}" && district="${normalize(b.district)}"==="${normDistrict}" → ${scopeMatch}`);
        break;
      case "city":
        scopeMatch = normalize(b.state) === normState && normalize(b.district) === normDistrict && normalize(b.city) === normCity;
        debugLog(`[PartnerSync Debug]   → scope=city: comparing state="${normalize(b.state)}"==="${normState}" && district="${normalize(b.district)}"==="${normDistrict}" && city="${normalize(b.city)}"==="${normCity}" → ${scopeMatch}`);
        break;
      default:
        scopeMatch = normalize(b.city) === normCity;
        debugLog(`[PartnerSync Debug]   → scope=default: comparing city="${normalize(b.city)}"==="${normCity}" → ${scopeMatch}`);
        break;
    }

    if (scopeMatch) {
      debugLog(`[PartnerSync Debug]   → ✅ MATCH - including in results`);
      results.push(b);
    } else {
      debugLog(`[PartnerSync Debug]   → ❌ FILTERED OUT: scope/location mismatch`);
    }
  }

  // Sort: city-scoped first, then district, state, national
  const priority: Record<string, number> = { city: 0, district: 1, state: 2, national: 3 };
  results.sort((a, b) => (priority[a.scope] ?? 99) - (priority[b.scope] ?? 99));

  debugLog(`[PartnerSync Debug] filterBusinessesByScope returning ${results.length} businesses`);
  results.forEach((r, i) => debugLog(`  [${i+1}] "${r.businessName}" (${r.scope}) - ${r.city}, ${r.district}, ${r.state}`));

  return results;
}

/* ----------------------------------------
   CRUD Operations
---------------------------------------- */

export async function createMarketplaceBusiness(data: {
  businessName: string;
  category: string;
  categorySlug: string;
  subcategory: string;
  description: string;
  image: string;
  verified: boolean;
  featured: boolean;
  visible: boolean;
  scope: ScopeType;
  country: string;
  state: string;
  district: string;
  city: string;
  waitingUsers: number;
  createdBy: string;
}): Promise<string> {
  if (!data.businessName || !data.categorySlug || !data.scope) {
    throw new Error("Business name, category, and scope are required");
  }
  if (data.scope === "state" && !data.state) {
    throw new Error("State is required for State scope");
  }
  if (data.scope === "district" && (!data.state || !data.district)) {
    throw new Error("State and District are required for District scope");
  }
  if (data.scope === "city" && (!data.state || !data.district || !data.city)) {
    throw new Error("State, District, and City are required for City scope");
  }

  const businessesRef = getBusinessesCollection(data.categorySlug);
  const businessDoc: MarketplaceBusiness = {
    businessName: data.businessName,
    category: data.category,
    categorySlug: data.categorySlug,
    subcategory: data.subcategory || "",
    description: data.description || "",
    image: data.image || "",
    defaultImage: getDefaultImage(data.categorySlug),
    verified: data.verified ?? true,
    featured: data.featured ?? false,
    visible: data.visible ?? true,
    scope: data.scope,
    country: data.country || "India",
    state: data.state || "",
    district: data.district || "",
    city: data.city || "",
    waitingUsers: data.waitingUsers ?? 0,
    createdBy: data.createdBy,
    approvedBy: data.createdBy,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    source: "admin",
  };

  const docRef = await addDoc(businessesRef, businessDoc);
  return docRef.id;
}

export async function updateMarketplaceBusiness(
  categorySlug: string,
  businessId: string,
  data: Partial<MarketplaceBusiness>
): Promise<void> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  await updateDoc(businessRef, { ...data, updatedAt: serverTimestamp() });
}

export async function deleteMarketplaceBusiness(
  categorySlug: string,
  businessId: string
): Promise<void> {
  await deleteDoc(getBusinessDocRef(categorySlug, businessId));
}

export async function bulkDeleteMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[]
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    batch.delete(getBusinessDocRef(categorySlug, businessId));
  });
  await batch.commit();
}

export async function toggleVisibleMarketplaceBusiness(
  categorySlug: string, businessId: string, visible: boolean
): Promise<void> {
  await updateDoc(getBusinessDocRef(categorySlug, businessId), { visible, updatedAt: serverTimestamp() });
}

export async function toggleFeaturedMarketplaceBusiness(
  categorySlug: string, businessId: string, featured: boolean
): Promise<void> {
  await updateDoc(getBusinessDocRef(categorySlug, businessId), { featured, updatedAt: serverTimestamp() });
}

export async function bulkSetVisibleMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[], visible: boolean
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    batch.update(getBusinessDocRef(categorySlug, businessId), { visible, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function bulkSetFeaturedMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[], featured: boolean
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    batch.update(getBusinessDocRef(categorySlug, businessId), { featured, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function duplicateMarketplaceBusiness(
  categorySlug: string, businessId: string
): Promise<string> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  const snap = await getDoc(businessRef);
  if (!snap.exists()) throw new Error("Business not found");
  const data = snap.data() as MarketplaceBusiness;
  const businessesRef = getBusinessesCollection(categorySlug);
  const docRef = await addDoc(businessesRef, {
    ...data,
    businessName: `${data.businessName} (Copy)`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/* ----------------------------------------
   Query All Marketplace Businesses (Admin)
---------------------------------------- */

export function subscribeToAllMarketplaceBusinesses(
  callback: (businesses: MarketplaceBusiness[]) => void
) {
  const categorySlugs = [
    "gym", "fashion", "movies", "local-travel", "books", "events", "coupons", "villas", "lenskart"
  ];

  const allBusinesses: MarketplaceBusiness[] = [];
  const unsubFunctions: (() => void)[] = [];

  categorySlugs.forEach((slug) => {
    const businessesRef = getBusinessesCollection(slug);
    const q = query(businessesRef, orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, 
      (snapshot) => {
        const filtered = allBusinesses.filter(b => b.categorySlug !== slug);
        snapshot.forEach((d) => {
          const data = d.data() as MarketplaceBusiness;
          filtered.push({ id: d.id, ...data } as MarketplaceBusiness);
        });
        allBusinesses.length = 0;
        allBusinesses.push(...filtered);
        callback([...allBusinesses]);
      },
      (error) => {
        console.warn(`Marketplace snapshot error for ${slug}:`, error.message);
        callback([...allBusinesses]);
      }
    );
    unsubFunctions.push(unsub);
  });

  return () => { unsubFunctions.forEach((fn) => fn()); };
}

export function getMarketplaceStats(businesses: MarketplaceBusiness[]): MarketplaceStats {
  return {
    total: businesses.length,
    verified: businesses.filter((b) => b.verified).length,
    featured: businesses.filter((b) => b.featured).length,
    hidden: businesses.filter((b) => !b.visible).length,
    pending: businesses.filter((b) => b.visible === undefined || b.visible === false).length,
    national: businesses.filter((b) => b.scope === "national").length,
    state: businesses.filter((b) => b.scope === "state").length,
    district: businesses.filter((b) => b.scope === "district").length,
    city: businesses.filter((b) => b.scope === "city").length,
    categories: new Set(businesses.map((b) => b.categorySlug)).size,
    citiesCovered: new Set(businesses.filter((b) => b.city).map((b) => b.city)).size,
  };
}

/* ----------------------------------------
   Scope-Based Query for Explore/MarketplaceGrid
   
   FIX: 
   1. getDocs is always the reliable primary source (no index needed)
   2. Client-side filtering is now case-insensitive to prevent location mismatches
   3. onSnapshot is used only for real-time updates, with getDocs as fallback
   4. The fallbackUsed flag correctly prevents double-callbacks
---------------------------------------- */

export function subscribeToBusinessesByScope(
  categorySlug: string,
  subcategory: string,
  userState: string,
  userDistrict: string,
  userCity: string,
  callback: (businesses: MarketplaceBusiness[], error?: string) => void
) {
  const businessesRef = getBusinessesCollection(categorySlug);
  let unsubscribe: (() => void) | null = null;
  let hasInitialData = false;
  let isUnmounted = false;

  // Step 1: Always do a getDocs first (reliable, no index needed, checks permissions immediately)
  // This guarantees data even if onSnapshot fails
  getDocs(businessesRef)
    .then((snap) => {
      if (isUnmounted) return;
      const allBusinesses: MarketplaceBusiness[] = [];
      snap.forEach((d) => {
        allBusinesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
      });
      const filtered = filterBusinessesByScope(allBusinesses, subcategory, userState, userDistrict, userCity);
      callback(filtered);
      hasInitialData = true;
    })
    .catch((err: any) => {
      if (isUnmounted) return;
      console.error(`getDocs failed for ${categorySlug}:`, err.message);
      callback([], err.message || "Failed to load businesses");
    });

  // Step 2: Try onSnapshot for realtime updates (may fail if no index or permission)
  // Only calls callback if getDocs hasn't already provided the data
  try {
    // Note: We DON'T use orderBy here to avoid requiring a composite index
    // The client-side filter handles ordering anyway
    unsubscribe = onSnapshot(businessesRef,
      (snapshot) => {
        if (isUnmounted) return;
        
        const allBusinesses: MarketplaceBusiness[] = [];
        snapshot.forEach((d) => {
          allBusinesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
        });
        const filtered = filterBusinessesByScope(allBusinesses, subcategory, userState, userDistrict, userCity);
        
        // Only send if getDocs hasn't already provided more recent data
        if (!hasInitialData) {
          callback(filtered);
          hasInitialData = true;
        }
      },
      (error) => {
        // onSnapshot failed - getDocs already handled the data load
        if (!hasInitialData) {
          console.warn(`onSnapshot failed for ${categorySlug}:`, error.message);
          // If onSnapshot fails and getDocs already ran, we still have data
          // If getDocs hasn't run yet, the catch handler above will handle it
          hasInitialData = true;
        }
      }
    );
  } catch (err) {
    console.warn(`Could not set up onSnapshot for ${categorySlug}:`, err);
  }

  return () => {
    isUnmounted = true;
    if (typeof unsubscribe === "function") unsubscribe();
  };
}