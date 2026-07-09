"use client";

// Marketplace Manager Service — handles ALL marketplace business CRUD operations
// Supports: create, read, update, delete, hide/show, feature/unfeature, bulk operations
// Firestore: marketplace/{categorySlug}/businesses/{businessId}
// The businesses collection contains scope field: "national" | "state" | "district" | "city"

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
  DocumentData,
  arrayUnion,
  arrayRemove,
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

// Structure: marketplace/{categorySlug}/businesses/{businessId}
function getBusinessesCollection(categorySlug?: string): CollectionReference {
  if (categorySlug) {
    return collection(db, "marketplace", categorySlug, "businesses");
  }
  return collection(db, "marketplace");
}

export function getBusinessDocRef(categorySlug: string, businessId: string): DocumentReference {
  return doc(db, "marketplace", categorySlug, "businesses", businessId);
}

/* ----------------------------------------
   CRUD Operations (Admin Marketplace Manager)
---------------------------------------- */

// Create a new marketplace business
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
  // Validate required fields based on scope
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

// Update a marketplace business
export async function updateMarketplaceBusiness(
  categorySlug: string,
  businessId: string,
  data: Partial<MarketplaceBusiness>
): Promise<void> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  
  // Validate scope requirements if scope is being changed
  if (data.scope === "state" && !data.state && !(await getDoc(businessRef)).data()?.state) {
    throw new Error("State is required for State scope");
  }

  await updateDoc(businessRef, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// Delete a marketplace business
export async function deleteMarketplaceBusiness(
  categorySlug: string,
  businessId: string
): Promise<void> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  await deleteDoc(businessRef);
}

// Bulk delete marketplace businesses
export async function bulkDeleteMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[]
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    const ref = getBusinessDocRef(categorySlug, businessId);
    batch.delete(ref);
  });
  await batch.commit();
}

// Toggle visible (hide/show)
export async function toggleVisibleMarketplaceBusiness(
  categorySlug: string,
  businessId: string,
  visible: boolean
): Promise<void> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  await updateDoc(businessRef, {
    visible,
    updatedAt: serverTimestamp(),
  });
}

// Toggle featured
export async function toggleFeaturedMarketplaceBusiness(
  categorySlug: string,
  businessId: string,
  featured: boolean
): Promise<void> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  await updateDoc(businessRef, {
    featured,
    updatedAt: serverTimestamp(),
  });
}

// Bulk update visible
export async function bulkSetVisibleMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[],
  visible: boolean
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    const ref = getBusinessDocRef(categorySlug, businessId);
    batch.update(ref, { visible, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

// Bulk update featured
export async function bulkSetFeaturedMarketplaceBusinesses(
  items: { categorySlug: string; businessId: string }[],
  featured: boolean
): Promise<void> {
  const batch = writeBatch(db);
  items.forEach(({ categorySlug, businessId }) => {
    const ref = getBusinessDocRef(categorySlug, businessId);
    batch.update(ref, { featured, updatedAt: serverTimestamp() });
  });
  await batch.commit();
}

// Duplicate a marketplace business
export async function duplicateMarketplaceBusiness(
  categorySlug: string,
  businessId: string
): Promise<string> {
  const businessRef = getBusinessDocRef(categorySlug, businessId);
  const snap = await getDoc(businessRef);
  
  if (!snap.exists()) {
    throw new Error("Business not found");
  }

  const data = snap.data() as MarketplaceBusiness;
  const businessesRef = getBusinessesCollection(categorySlug);
  
  const newDoc = {
    ...data,
    businessName: `${data.businessName} (Copy)`,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(businessesRef, newDoc);
  return docRef.id;
}

/* ----------------------------------------
   Query All Marketplace Businesses (Admin)
---------------------------------------- */

export function subscribeToAllMarketplaceBusinesses(
  callback: (businesses: MarketplaceBusiness[]) => void
) {
  // Query all categories' businesses
  // Firestore doesn't support cross-collection group queries easily with subcollections,
  // so we query each category separately and combine
  
  const categorySlugs = [
    "gym", "fashion", "movies", "local-travel", "books", "events", "coupons", "villas", "lenskart"
  ];

  const allBusinesses: MarketplaceBusiness[] = [];
  const unsubFunctions: (() => void)[] = [];
  let loadedCategories = 0;

  categorySlugs.forEach((slug) => {
    const businessesRef = getBusinessesCollection(slug);
    const q = query(businessesRef, orderBy("createdAt", "desc"));
    
    const unsub = onSnapshot(q, (snapshot) => {
      // Clear previous entries for this category
      const filtered = allBusinesses.filter(b => b.categorySlug !== slug);
      
      snapshot.forEach((d) => {
        const data = d.data() as MarketplaceBusiness;
        filtered.push({
          id: d.id,
          ...data,
        } as MarketplaceBusiness);
      });

      // Replace the array
      allBusinesses.length = 0;
      allBusinesses.push(...filtered);
      
      loadedCategories++;
      callback([...allBusinesses]);
    });

    unsubFunctions.push(unsub);
  });

  return () => {
    unsubFunctions.forEach((fn) => fn());
  };
}

/* ----------------------------------------
   Get Marketplace Stats
---------------------------------------- */

export function getMarketplaceStats(
  businesses: MarketplaceBusiness[]
): MarketplaceStats {
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
---------------------------------------- */

// Get businesses that match a user's location considering scope
// Returns: national + state + district + city businesses combined
export async function getBusinessesByScope(
  categorySlug: string,
  subcategory: string,
  userState: string,
  userDistrict: string,
  userCity: string
): Promise<MarketplaceBusiness[]> {
  try {
    const businessesRef = getBusinessesCollection(categorySlug);
    const snap = await getDocs(businessesRef);
    
    const results: MarketplaceBusiness[] = [];
    
    snap.forEach((d) => {
      const data = d.data() as MarketplaceBusiness;
      
      // Filter by visible + verified
      if (!data.visible && data.visible !== undefined) return;
      
      // Filter by subcategory if specified
      if (subcategory && data.subcategory !== subcategory) return;
      
      // Apply scope filtering
      let scopeMatch = false;
      
      switch (data.scope) {
        case "national":
          scopeMatch = true;
          break;
        case "state":
          scopeMatch = data.state === userState;
          break;
        case "district":
          scopeMatch = data.state === userState && data.district === userDistrict;
          break;
        case "city":
          scopeMatch = data.state === userState && data.district === userDistrict && data.city === userCity;
          break;
        default:
          // Legacy: city-level fallback
          scopeMatch = data.city === userCity;
          break;
      }
      
      if (scopeMatch) {
        results.push({ id: d.id, ...data } as MarketplaceBusiness);
      }
    });
    
    // Sort by scope priority: city > district > state > national
    const priority: Record<string, number> = { city: 0, district: 1, state: 2, national: 3 };
    results.sort((a, b) => (priority[a.scope] ?? 99) - (priority[b.scope] ?? 99));
    
    return results;
  } catch (error) {
    console.error("Error fetching businesses by scope:", error);
    return [];
  }
}

// Real-time listener for scope-based queries
export function subscribeToBusinessesByScope(
  categorySlug: string,
  subcategory: string,
  userState: string,
  userDistrict: string,
  userCity: string,
  callback: (businesses: MarketplaceBusiness[]) => void
) {
  const businessesRef = getBusinessesCollection(categorySlug);
  const q = query(businessesRef, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snapshot) => {
    const results: MarketplaceBusiness[] = [];
    
    snapshot.forEach((d) => {
      const data = d.data() as MarketplaceBusiness;
      
      // Filter by visible
      if (!data.visible && data.visible !== undefined) return;
      
      // Filter by subcategory if specified
      if (subcategory && data.subcategory !== subcategory) return;
      
      // Apply scope filtering
      let scopeMatch = false;
      
      switch (data.scope) {
        case "national":
          scopeMatch = true;
          break;
        case "state":
          scopeMatch = data.state === userState;
          break;
        case "district":
          scopeMatch = data.state === userState && data.district === userDistrict;
          break;
        case "city":
          scopeMatch = data.state === userState && data.district === userDistrict && data.city === userCity;
          break;
        default:
          scopeMatch = data.city === userCity;
          break;
      }
      
      if (scopeMatch) {
        results.push({ id: d.id, ...data } as MarketplaceBusiness);
      }
    });
    
    // Sort by scope priority
    const priority: Record<string, number> = { city: 0, district: 1, state: 2, national: 3 };
    results.sort((a, b) => (priority[a.scope] ?? 99) - (priority[b.scope] ?? 99));
    
    callback(results);
  });

  return unsub;
}

/* ----------------------------------------
   Update Approval Flow to use new structure
---------------------------------------- */

// Convert old approval to new scope-based marketplace entry
export function convertToScopeMarketplace(business: Partial<MarketplaceBusiness>): MarketplaceBusiness {
  const scope: ScopeType = business.scope || "city";
  
  return {
    businessName: business.businessName || "",
    category: business.category || "",
    categorySlug: business.categorySlug || "",
    subcategory: business.subcategory || "",
    description: business.description || "",
    image: business.image || "",
    defaultImage: getDefaultImage(business.categorySlug || ""),
    verified: true,
    featured: false,
    visible: true,
    scope,
    country: business.country || "India",
    state: business.state || "",
    district: business.district || "",
    city: business.city || "",
    waitingUsers: 0,
    createdBy: business.createdBy || "",
    approvedBy: business.approvedBy || "",
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
    source: business.source || "user",
  };
}