import { doc, getDoc } from "firebase/firestore";
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
  data: Record<string, any>;
}

/**
 * Find an EXISTING member's users document without assuming its ID format.
 *
 * The database already contains member profiles; this resolver tries every
 * plausible own-phone identifier (raw stored value, normalized 10-digit,
 * +91-prefixed, Firebase Auth UID) and returns the first document that
 * actually exists. Every candidate is the logged-in user's OWN document, so
 * each read is permitted by firestore.rules (isOwnDoc / uid match).
 *
 * Returns null when no profile exists yet (genuinely new member) — it NEVER
 * creates, overwrites, or throws on missing docs / permission errors.
 */
export async function resolveExistingUserDoc(
  rawPhone: string | null | undefined
): Promise<ResolvedUserDoc | null> {
  const candidates: string[] = [];
  const raw = (rawPhone || "").trim();
  const norm = normalizePhone(raw);

  if (raw) candidates.push(raw);
  if (norm && !candidates.includes(norm)) candidates.push(norm);
  const withCC = norm ? "+91" + norm : "";
  if (withCC && !candidates.includes(withCC)) candidates.push(withCC);
  const uid = auth.currentUser?.uid;
  if (uid && !candidates.includes(uid)) candidates.push(uid);

  for (const candidateId of candidates) {
    try {
      const snap = await getDoc(doc(db, "users", candidateId));
      if (snap.exists()) {
        console.log("[userLookup] existing member found at users/" + candidateId);
        return { docId: candidateId, data: snap.data() as Record<string, any> };
      }
    } catch (err: any) {
      // A denied candidate is simply not the right own-doc form — try the next.
      console.warn(
        `[userLookup] users/${candidateId} lookup skipped (${err?.code || "error"})`
      );
    }
  }

  console.log("[userLookup] no existing member document found (new member)");
  return null;
}