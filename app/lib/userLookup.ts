import { doc, getDoc, getDocs, query, collection, where, limit } from "firebase/firestore";
import { db, auth } from "@/firebase/config";

/**
 * Normalize any Indian phone representation to a bare 10-digit number.
 * "9876543210" | "+919876543210" | "919876543210" | "0 98765 43210" → "9876543210"
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let p = String(raw).replace(/[^0-9]/g, "");
  if (p.length === 12 && p.startsWith("91")) p = p.slice(2);
  if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
  return p;
}

export interface ResolvedUserDoc {
  /** The ACTUAL Firestore document ID the existing member is stored under. */
  docId: string;
  /** The canonical 10-digit phone number — the identifier ALL matching data
   *  (groups/members/memberUIDs/payments) is keyed by. */phone: string;
  data: Record<string, any>;
}

/**
 * Session cache of resolved doc IDs, keyed by canonical phone, so repeated
 * resolution on the same page/session never re-runs the candidate scans.
 */
const docIdCache = new Map<string, string>();

/**
 * Resolve the CURRENT user's existing users document efficiently.
 *
 * Strategy (NOT a collection scan):
 *   1. Single getDoc(users/{10-digit}) — the canonical form used by every
 *      write path, so this finds ~100% of members in ONE Firestore read.
 *   2. Only on a miss, try the leftover own-identifier forms (raw input,
 *      +91-prefixed, Firebase Auth UID) — also single own-doc getDoc calls.
 *   3. Only if ALL of those miss, one INDEXED equality query
 *      (where("phone","==", canonical).limit(1)) to catch a doc keyed under
 *      an unexpected ID that still stores the canonical phone field.
 *
 * The resolved doc ID is cached for the session so later calls on the same
 * page (profile load, save, etc.) skip straight to a single fresh getDoc.
 *
 * Returns null when no profile exists (genuinely new member). NEVER creates,
 * overwrites, or throws.
 */
export async function resolveExistingUserDoc(
  rawPhone: string | null | undefined
): Promise<ResolvedUserDoc | null> {
  const raw = (rawPhone || auth.currentUser?.phoneNumber || "").trim();
  const phone = normalizePhone(raw);
  const uid = auth.currentUser?.uid;

  // Fast path: already resolved this session → single fresh read on that doc.
  const cachedId = docIdCache.get(phone);
  if (cachedId) {
    try {
      const snap = await getDoc(doc(db, "users", cachedId));
      if (snap.exists()) {
        return { docId: cachedId, phone, data: snap.data() as Record<string, any> };
      }
    } catch {
      /* doc no longer reachable — fall through to re-resolve */
    }
    docIdCache.delete(phone);
  }

  const candidates: string[] = [];
  if (phone) candidates.push(phone);
  if (raw && raw !== phone) candidates.push(raw);
  const withCC = phone ? "+91" + phone : "";
  if (withCC && !candidates.includes(withCC)) candidates.push(withCC);
  if (uid && !candidates.includes(uid)) candidates.push(uid);

  for (const candidateId of candidates) {
    try {
      const snap = await getDoc(doc(db, "users", candidateId));
      if (snap.exists()) {
        console.log("[userLookup] existing member found at users/" + candidateId);
        if (phone) docIdCache.set(phone, candidateId);
        return { docId: candidateId, phone, data: snap.data() as Record<string, any> };
      }
    } catch {
      // A denied/missing candidate is simply not the right own-doc form.
    }
  }

  // Last resort: one indexed equality query on the canonical phone field.
  if (phone) {
    try {
      const qSnap = await getDocs(
        query(collection(db, "users"), where("phone", "==", phone), limit(1))
      );
      if (!qSnap.empty) {
        const d = qSnap.docs[0];
        console.log("[userLookup] existing member found at users/" + d.id + " (phone-field query)");
        docIdCache.set(phone, d.id);
        return { docId: d.id, phone, data: d.data() as Record<string, any> };
      }
    } catch {
      /* query unavailable (rules/permissions) — treat as new member */
    }
  }

  console.log("[userLookup] no existing member document found (new member)");
  return null;
}

/**
 * The ACTUAL users document ID for the current user, for direct doc reads.
 * Falls back to the canonical phone when the resolver has never found a
 * differently-keyed doc. Use this everywhere the app reads users/{id}
 * (profile/dashboard/find-partners/save/create-group/details/trust-safety).
 */
export function getCurrentUserDocId(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("phoneDocId") || localStorage.getItem("phone") || "";
}