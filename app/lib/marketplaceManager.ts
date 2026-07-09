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
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  setDoc,
  onSnapshot,
  increment,
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
   Scope Filter
---------------------------------------- */

function filterBusinessesByScope(
  data: MarketplaceBusiness[],
  subcategory: string,
  userState: string,
  userDistrict: string,
  userCity: string
): MarketplaceBusiness[] {
  const results: MarketplaceBusiness[] = [];

  for (const b of data) {
    if (!b.visible && b.visible !== undefined) continue;
    if (subcategory && b.subcategory !== subcategory) continue;

    let scopeMatch = false;
    switch (b.scope) {
      case "national": scopeMatch = true; break;
      case "state": scopeMatch = b.state === userState; break;
      case "district": scopeMatch = b.state === userState && b.district === userDistrict; break;
      case "city": scopeMatch = b.state === userState && b.district === userDistrict && b.city === userCity; break;
      default: scopeMatch = b.city === userCity; break;
    }

    if (scopeMatch) results.push(b);
  }

  const priority: Record<string, number> = { city: 0, district: 1, state: 2, national: 3 };
  results.sort((a, b) => (priority[a.scope] ?? 99) - (priority[b.scope] ?? 99));

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
   FIX: Uses getDocs + onSnapshot separately
   If onSnapshot fails (permission/index), getDocs fallback fires callback
   This prevents infinite loading
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
  let fallbackUsed = false;

  // Step 1: Always do a getDocs first (reliable, no index needed, checks permissions immediately)
  getDocs(businessesRef)
    .then((snap) => {
      const allBusinesses: MarketplaceBusiness[] = [];
      snap.forEach((d) => {
        allBusinesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
      });
      const filtered = filterBusinessesByScope(allBusinesses, subcategory, userState, userDistrict, userCity);
      callback(filtered);
    })
    .catch((err: any) => {
      console.error(`getDocs failed for ${categorySlug}:`, err.message);
      callback([], err.message || "Failed to load businesses");
      return;
    });

  // Step 2: Try onSnapshot for realtime updates (may fail if no index or permission)
  try {
    const q = query(businessesRef, orderBy("createdAt", "desc"));
    unsubscribe = onSnapshot(q,
      (snapshot) => {
        if (fallbackUsed) return; // Already got data from getDocs
        const allBusinesses: MarketplaceBusiness[] = [];
        snapshot.forEach((d) => {
          allBusinesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
        });
        const filtered = filterBusinessesByScope(allBusinesses, subcategory, userState, userDistrict, userCity);
        callback(filtered);
        fallbackUsed = true; // Mark as used so getDocs doesn't overwrite
      },
      (error) => {
        // onSnapshot failed (permission or index) - getDocs already handled the data load
        console.warn(`onSnapshot failed for ${categorySlug}, getDocs was used instead:`, error.message);
        fallbackUsed = true;
      }
    );
  } catch (err) {
    console.warn(`Could not set up onSnapshot for ${categorySlug}:`, err);
  }

  return () => {
    if (typeof unsubscribe === "function") unsubscribe();
  };
}