// Marketplace service - handles all business CRUD operations
// Firestore structure: marketplace/{categorySlug}/{state}/{district}/{city}/{businessId}

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
  DocumentReference,
  CollectionReference,
  DocumentData,
  onSnapshot,
  increment,
} from "firebase/firestore";

/* ----------------------------------------
   Types
---------------------------------------- */

export interface PendingBusiness {
  id?: string;
  businessName: string;
  category: string;
  categorySlug: string;
  subcategory?: string;
  state: string;
  district: string;
  city: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  submittedAt: Timestamp | Date;
  status: "pending" | "approved" | "rejected";
  // Collaborator-specific fields
  offerName?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  image?: string;
  type: "business" | "collaborator";
}

export interface MarketplaceBusiness {
  id: string;
  businessName: string;
  category: string;
  categorySlug: string;
  subcategory?: string;
  state: string;
  district: string;
  city: string;
  verified: boolean;
  waitingUsers: number;
  image?: string;
  defaultImage: string;
  featured?: boolean;
  officialPartner?: boolean;
  topRated?: boolean;
  premium?: boolean;
  createdAt: Timestamp | Date;
  // Collaborator-specific
  offerName?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  collaboratorId?: string;
  type: "business" | "collaborator";
}

/* ----------------------------------------
   Firestore Path Helpers
---------------------------------------- */

// Get the correct Firestore collection path
// Structure: marketplace/{categorySlug}/states/{state}/districts/{district}/cities/{city}/businesses
function getBusinessesCollection(
  categorySlug: string,
  state: string,
  district: string,
  city: string
): CollectionReference {
  return collection(
    db,
    "marketplace",
    categorySlug,
    "states",
    state,
    "districts",
    district,
    "cities",
    city,
    "businesses"
  );
}

// Get all businesses for a category + city combination
export function getBusinessesRef(
  categorySlug: string,
  state: string,
  district: string,
  city: string
): CollectionReference {
  return getBusinessesCollection(categorySlug, state, district, city);
}

/* ----------------------------------------
   Submit a new business (pending)
---------------------------------------- */

export async function submitBusiness(data: {
  businessName: string;
  categorySlug: string;
  category: string;
  subcategory?: string;
  state: string;
  district: string;
  city: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  type: "business" | "collaborator";
  // Optional collaborator fields
  offerName?: string;
  phone?: string;
  email?: string;
  website?: string;
  description?: string;
  image?: string;
}) {
  const pendingRef = collection(db, "pendingBusinesses");
  const docRef = await addDoc(pendingRef, {
    ...data,
    submittedAt: serverTimestamp(),
    status: "pending",
  });
  return docRef.id;
}

/* ----------------------------------------
   Approve a pending business
---------------------------------------- */

export async function approveBusiness(pendingId: string) {
  const pendingRef = doc(db, "pendingBusinesses", pendingId);
  const pendingSnap = await getDoc(pendingRef);

  if (!pendingSnap.exists()) {
    throw new Error("Pending business not found");
  }

  const data = pendingSnap.data() as PendingBusiness;

  // Build the business document path
  const businessesRef = getBusinessesCollection(
    data.categorySlug,
    data.state,
    data.district,
    data.city
  );

  // Create the business document
  const businessDoc = {
    businessName: data.businessName,
    category: data.category,
    categorySlug: data.categorySlug,
    subcategory: data.subcategory || "",
    state: data.state,
    district: data.district,
    city: data.city,
    verified: true,
    waitingUsers: 0,
    image: data.image || "",
    defaultImage: getDefaultImageForCategory(data.categorySlug),
    featured: false,
    officialPartner: false,
    topRated: false,
    premium: false,
    type: data.type,
    // Collaborator fields
    offerName: data.offerName || "",
    phone: data.phone || "",
    email: data.email || "",
    website: data.website || "",
    description: data.description || "",
    collaboratorId: "",
    createdBy: data.userId,
    createdAt: serverTimestamp(),
  };

  const businessDocRef = await addDoc(businessesRef, businessDoc);

  // Update pending status
  await updateDoc(pendingRef, {
    status: "approved",
    approvedAt: serverTimestamp(),
    businessId: businessDocRef.id,
  });

  return { businessId: businessDocRef.id, business: businessDoc };
}

/* ----------------------------------------
   Reject a pending business
---------------------------------------- */

export async function rejectBusiness(pendingId: string) {
  const pendingRef = doc(db, "pendingBusinesses", pendingId);
  await updateDoc(pendingRef, {
    status: "rejected",
    rejectedAt: serverTimestamp(),
  });
}

/* ----------------------------------------
   Get businesses for a specific city + category
---------------------------------------- */

export async function getBusinessesForCity(
  categorySlug: string,
  state: string,
  district: string,
  city: string
): Promise<MarketplaceBusiness[]> {
  try {
    const businessesRef = getBusinessesCollection(categorySlug, state, district, city);
    const q = query(businessesRef, orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    const businesses: MarketplaceBusiness[] = [];
    snap.forEach((d) => {
      businesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
    });
    return businesses;
  } catch (error) {
    console.error("Error fetching businesses:", error);
    return [];
  }
}

/* ----------------------------------------
   Real-time listener for businesses
---------------------------------------- */

export function subscribeToBusinesses(
  categorySlug: string,
  state: string,
  district: string,
  city: string,
  callback: (businesses: MarketplaceBusiness[]) => void
) {
  const businessesRef = getBusinessesCollection(categorySlug, state, district, city);
  const q = query(businessesRef, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(q, (snapshot: any) => {
    const businesses: MarketplaceBusiness[] = [];
    snapshot.forEach((d: any) => {
      businesses.push({ id: d.id, ...(d.data() as any) } as MarketplaceBusiness);
    });
    callback(businesses);
  });

  return unsub;
}

/* ----------------------------------------
   Update waiting users count
---------------------------------------- */

export async function incrementWaitingUsers(
  categorySlug: string,
  state: string,
  district: string,
  city: string,
  businessId: string
) {
  const businessRef = doc(
    db,
    "marketplace",
    categorySlug,
    "states",
    state,
    "districts",
    district,
    "cities",
    city,
    "businesses",
    businessId
  );

  await updateDoc(businessRef, {
    waitingUsers: increment(1),
  });
}

/* ----------------------------------------
   Helpers
---------------------------------------- */


function getDefaultImageForCategory(categorySlug: string): string {
  const defaultImages: Record<string, string> = {
    gym: "/gym.webp",
    fashion: "/fashion.webp",
    movies: "/movies.webp",
    "local-travel": "/travel.webp",
    books: "/books.webp",
    events: "/events.webp",
    coupons: "/coupons.webp",
    villas: "/villas.webp",
    lenskart: "/lenskart.png",
  };
  return defaultImages[categorySlug] || "/placeholder.webp";
}