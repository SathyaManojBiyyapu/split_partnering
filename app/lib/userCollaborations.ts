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

  // Idempotent approval: if this collaboration was already approved, return the
  // previously created marketplace business instead of creating a duplicate.
  if (
    data.status === "approved" &&
    (data as any).businessId
  ) {
    const existingRef = doc(
      db,
      "marketplace",
      data.categorySlug || data.category?.toLowerCase().replace(/\s+/g, "-") || "unknown",
      "businesses",
      (data as any).businessId
    );
    const existingSnap = await getDoc(existingRef);
    if (existingSnap.exists()) {
      return {
        businessId: existingSnap.id,
        business: existingSnap.data() as any,
        alreadyApproved: true,
      };
    }
  }

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

/**
 * Robust fetch of ALL user collaborations that surfaces errors instead of
 * silently returning [].
 *
 * Firestore `getDocs` is the reliable primary source (no composite index
 * required); results are sorted client-side. `onSnapshot` is used as a
 * real-time supplement but never hides an initial read failure.
 */
export function fetchUserCollaborationsWithError(): Promise<{
  data: UserCollaboration[];
  error: string | null;
}> {
  const collabRef = collection(db, "userCollaborations");
  return getDocs(collabRef)
    .then((snap) => {
      const collaborations: UserCollaboration[] = [];
      snap.forEach((d) => {
        collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
      });
      collaborations.sort((a, b) => {
        const at = (a.submittedAt as any)?.seconds || 0;
        const bt = (b.submittedAt as any)?.seconds || 0;
        return bt - at;
      });
      return { data: collaborations, error: null };
    })
    .catch((err: any) => ({
      data: [],
      error: err?.message || "Failed to load user collaborations",
    }));
}

/**
 * Real-time listener with the same getDocs-first + onSnapshot-fallback pattern
 * used by the marketplace (subscribeToBusinessesByScope). The error callback is
 * invoked on any initial read failure so the admin UI can surface it instead of
 * silently showing "no records".
 */
export function subscribeToUserCollaborationsWithError(
  callback: (collaborations: UserCollaboration[], error?: string | null) => void
): () => void {
  const collabRef = collection(db, "userCollaborations");
  let hasInitialData = false;
  let isUnmounted = false;
  let unsubscribe: (() => void) | null = null;

  getDocs(collabRef)
    .then((snap) => {
      if (isUnmounted) return;
      const collaborations: UserCollaboration[] = [];
      snap.forEach((d) => {
        collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
      });
      collaborations.sort((a, b) => {
        const at = (a.submittedAt as any)?.seconds || 0;
        const bt = (b.submittedAt as any)?.seconds || 0;
        return bt - at;
      });
      callback(collaborations, null);
      hasInitialData = true;
    })
    .catch((err: any) => {
      if (isUnmounted) return;
      console.error("getDocs failed for userCollaborations:", err?.message);
      callback([], err?.message || "Failed to load user collaborations");
    });

  try {
    unsubscribe = onSnapshot(
      collabRef,
      (snapshot) => {
        if (isUnmounted) return;
        const collaborations: UserCollaboration[] = [];
        snapshot.forEach((d) => {
          collaborations.push({ id: d.id, ...(d.data() as any) } as UserCollaboration);
        });
        collaborations.sort((a, b) => {
          const at = (a.submittedAt as any)?.seconds || 0;
          const bt = (b.submittedAt as any)?.seconds || 0;
          return bt - at;
        });
        if (!hasInitialData) {
          callback(collaborations, null);
          hasInitialData = true;
        }
      },
      (error) => {
        if (!hasInitialData) {
          console.warn("onSnapshot failed for userCollaborations:", error?.message);
          hasInitialData = true;
        }
      }
    );
  } catch (err) {
    console.warn("Could not set up onSnapshot for userCollaborations:", err);
  }

  return () => {
    isUnmounted = true;
    if (typeof unsubscribe === "function") unsubscribe();
  };
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