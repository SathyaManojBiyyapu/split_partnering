"use client";

// User Collaboration Service - handles all user-generated business approval workflow
// Firestore: userCollaborations/{documentId}

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
  increment,
  onSnapshot,
} from "firebase/firestore";
import { getDefaultImage } from "@/app/data/categoryConfig";

/* ----------------------------------------
   Types
---------------------------------------- */

export interface UserCollaboration {
  id?: string;
  businessName: string;
  category: string;
  subCategory: string;
  state: string;
  district: string;
  city: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdByPhone: string;
  submittedAt: Timestamp | Date;
  status: "pending" | "approved" | "rejected";
  verified: boolean;
  image: string | null;
  source: string;
  approvedBy?: string;
  approvedAt?: Timestamp | Date;
  rejectedAt?: Timestamp | Date;
  rejectionReason?: string;
}

/* ----------------------------------------
   Submit a new user collaboration (pending)
---------------------------------------- */

export async function submitUserCollaboration(data: {
  businessName: string;
  category: string;
  categorySlug: string;
  subCategory: string;
  state: string;
  district: string;
  city: string;
  createdBy: string;
  createdByName: string;
  createdByEmail: string;
  createdByPhone: string;
}) {
  const collabRef = collection(db, "userCollaborations");
  const docRef = await addDoc(collabRef, {
    businessName: data.businessName,
    category: data.category,
    categorySlug: data.categorySlug,
    subCategory: data.subCategory,
    state: data.state,
    district: data.district,
    city: data.city,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdByEmail: data.createdByEmail,
    createdByPhone: data.createdByPhone,
    submittedAt: serverTimestamp(),
    status: "pending",
    verified: false,
    image: null,
    source: "user",
  });
  return docRef.id;
}

/* ----------------------------------------
   Approve a user collaboration
---------------------------------------- */

export async function approveUserCollaboration(
  collaborationId: string,
  approvedByPhone: string
) {
  const collabRef = doc(db, "userCollaborations", collaborationId);
  const collabSnap = await getDoc(collabRef);

  if (!collabSnap.exists()) {
    throw new Error("User collaboration not found");
  }

  const data = collabSnap.data() as UserCollaboration & { categorySlug?: string };
  const categorySlug = data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-") || "unknown";

  // Create the business in marketplace with proper path:
  // marketplace/{categorySlug}/states/{state}/districts/{district}/cities/{city}/businesses
  const businessesRef = collection(
    db,
    "marketplace",
    categorySlug,
    "states",
    data.state?.trim(),
    "districts",
    data.district?.trim(),
    "cities",
    data.city?.trim(),
    "businesses"
  );

  const businessDoc = {
    businessName: data.businessName,
    category: data.category,
    categorySlug: categorySlug,
    subcategory: data.subCategory || "",
    state: data.state,
    district: data.district,
    city: data.city,
    verified: true,
    waitingUsers: 0,
    image: data.image || "",
    defaultImage: getDefaultImage(categorySlug),
    featured: false,
    officialPartner: false,
    topRated: false,
    premium: false,
    type: "business",
    createdBy: data.createdBy,
    createdAt: serverTimestamp(),
    approvedBy: approvedByPhone,
    approvedAt: serverTimestamp(),
  };

  const businessDocRef = await addDoc(businessesRef, businessDoc);

  // Update original collaboration record
  await updateDoc(collabRef, {
    status: "approved",
    verified: true,
    approvedBy: approvedByPhone,
    approvedAt: serverTimestamp(),
    businessId: businessDocRef.id,
  });

  return { businessId: businessDocRef.id, business: businessDoc };
}

/* ----------------------------------------
   Reject a user collaboration
---------------------------------------- */

export async function rejectUserCollaboration(
  collaborationId: string,
  reason?: string
) {
  const collabRef = doc(db, "userCollaborations", collaborationId);
  await updateDoc(collabRef, {
    status: "rejected",
    rejectedAt: serverTimestamp(),
    rejectionReason: reason || "",
  });
}

/* ----------------------------------------
   Get all user collaborations
---------------------------------------- */

export async function getUserCollaborations(): Promise<UserCollaboration[]> {
  try {
    const collabRef = collection(db, "userCollaborations");
    const q = query(collabRef, orderBy("submittedAt", "desc"));
    const snap = await getDocs(q);

    const collaborations: UserCollaboration[] = [];
    snap.forEach((d) => {
      collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
    });
    return collaborations;
  } catch (error) {
    console.error("Error fetching user collaborations:", error);
    return [];
  }
}

/* ----------------------------------------
   Real-time listener for user collaborations
---------------------------------------- */

export function subscribeToUserCollaborations(
  callback: (collaborations: UserCollaboration[]) => void
) {
  const collabRef = collection(db, "userCollaborations");
  const q = query(collabRef, orderBy("submittedAt", "desc"));

  const unsub = onSnapshot(q, (snapshot: any) => {
    const collaborations: UserCollaboration[] = [];
    snapshot.forEach((d: any) => {
      collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
    });
    callback(collaborations);
  });

  return unsub;
}

/* ----------------------------------------
   Get collaborations by status
---------------------------------------- */

export function subscribeToCollaborationsByStatus(
  status: string,
  callback: (collaborations: UserCollaboration[]) => void
) {
  const collabRef = collection(db, "userCollaborations");
  const q =
    status === "all"
      ? query(collabRef, orderBy("submittedAt", "desc"))
      : query(collabRef, where("status", "==", status), orderBy("submittedAt", "desc"));

  const unsub = onSnapshot(q, (snapshot: any) => {
    const collaborations: UserCollaboration[] = [];
    snapshot.forEach((d: any) => {
      collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
    });
    callback(collaborations);
  });

  return unsub;
}