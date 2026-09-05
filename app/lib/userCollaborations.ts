"use client";

// User Collaboration Service - handles all user-generated business approval workflow
// Firestore: userCollaborations/{documentId}
// Marketplace (scope-based): marketplace/{categorySlug}/businesses/{businessId}

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
  // Submissions go through the server route (/api/submit-gym) so duplicates
  // are prevented and the pending record is created with admin privileges
  // (userCollaborations is admin-read-only in firestore.rules).
  const { getAuth } = await import("firebase/auth");
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error("Please login first.");
  }
  const idToken = await currentUser.getIdToken();
  const res = await fetch("/api/submit-gym", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result?.error || `Submission failed (${res.status})`);
  }
  return result?.id || "";
}

/* ----------------------------------------
   Approve a user collaboration
   Creates a marketplace document at: marketplace/{categorySlug}/businesses/{businessId}
   This path MUST match what subscribeToBusinessesByScope() queries.
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

  // Create the business in the SCOPE-BASED marketplace path:
  // marketplace/{categorySlug}/businesses/{businessId}
  // This matches exactly what MarketplaceGrid's subscribeToBusinessesByScope() queries.
  const businessesRef = collection(
    db,
    "marketplace",
    categorySlug,
    "businesses"
  );

  // Build a document that fully conforms to MarketplaceBusiness interface
  // This ensures scope-based filtering works correctly (city scope + location match)
  const businessDoc = {
    businessName: data.businessName,
    category: data.category,
    categorySlug: categorySlug,
    subcategory: data.subCategory || "",
    description: "",
    image: data.image || "",
    defaultImage: getDefaultImage(categorySlug),
    verified: true,
    featured: false,
    visible: true,
    scope: "city",
    country: "India",
    state: data.state || "",
    district: data.district || "",
    city: data.city || "",
    waitingUsers: 0,
    createdBy: data.createdBy,
    approvedBy: approvedByPhone,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    source: "user",
  };

  // Step 1: Create marketplace document
  const businessDocRef = await addDoc(businessesRef, businessDoc);

  // Step 2: Update original collaboration record to approved
  // If this fails, the marketplace doc still exists (which is fine - just orphaned)
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
  }, (err: any) => {
    console.error("User collaborations listener error:", err);
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
  }, (err: any) => {
    console.error("Collaborations by status listener error:", err);
  });

  return unsub;
}