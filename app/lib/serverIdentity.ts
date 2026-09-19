// Server-side caller identity resolution shared by every token-authorizing
// API route (verify-chat-access, verify-razorpay-payment).
//
// ROOT CAUSE THIS FIXES (the "fully paid but Chat Locked — not a member" bug):
// Group documents key members by their CANONICAL 10-DIGIT PHONE
// (members[].phone, members[].uid, memberUIDs — see /api/join-group). The API
// routes authorize the caller ONLY from their VERIFIED Firebase ID token:
//   identities = [auth.uid, phone_number, phone_number-without-+91]
// That works for phone-OTP logins (the token carries phone_number), but
// GOOGLE-LOGIN users have NO phone_number claim — their only verified
// identity is the random Google auth.uid, which matches nothing in the
// phone-keyed group doc → 403 "You are not a member of this group" even
// though they joined and paid (join/payment flows key on the session phone).
//
// Resolution strategy, in order of trust:
//   1. Token phone_number claim (phone-OTP users) — fully verified.
//   2. The caller's own users doc looked up BY THE VERIFIED auth.uid
//      (remove-match precedent) — the doc's phone field is trusted because
//      only that account can own the doc.
//   3. A client-claimed phone (localStorage session phone), accepted ONLY for
//      tokens WITHOUT a phone_number claim and ONLY when a users document
//      actually exists for it (doc keyed by that phone, or the phone field on
//      any doc, or the uid field pointing back at the verified uid).
//      This mirrors the trust level the rest of the app already uses (join,
//      payment and chat rules key off the session phone), while still being
//      stricter than those flows: an arbitrary claimed phone that does not
//      correspond to a real member profile is rejected.
import { adminDb } from "@/firebase/admin";

/**
 * Every identity form derivable from the VERIFIED ID token alone.
 * Never includes client-supplied values.
 */
export function tokenIdentities(decoded: any): string[] {
  const ids: string[] = [decoded?.uid || ""];
  const raw =
    typeof decoded?.phone_number === "string" ? decoded.phone_number.trim() : "";
  if (raw) {
    ids.push(raw, raw.replace(/^\+91/, ""));
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length === 12 && digits.startsWith("91")) ids.push(digits.slice(2));
    if (digits.length === 11 && digits.startsWith("0")) ids.push(digits.slice(1));
  }
  return [...new Set(ids.filter(Boolean))];
}

const isCanonicalPhone = (v: string) => /^[0-9]{10}$/.test(v);

export interface ResolvedCaller {
  /** Verified token identities (uid + every phone form). */
  identities: string[];
  /** The caller's canonical 10-digit phone, resolved server-side. */
  phone: string;
  /** Verified Firebase Auth UID. */
  uid: string;
  /** How the phone was resolved. */
  phoneSource: "token" | "users-doc" | "claimed" | "none";
}

/**
 * Resolve the caller's canonical phone for group-keyed lookups.
 * @param decoded       the VERIFIED ID-token payload
 * @param claimedPhone  optional client-supplied phone (localStorage session);
 *                      only honored when the token has NO phone_number claim
 */
export async function resolveCallerIdentity(
  decoded: any,
  claimedPhone?: string | null
): Promise<ResolvedCaller> {
  const uid = String(decoded?.uid || "");
  const identities = tokenIdentities(decoded);

  // 1. Verified phone claim (phone-OTP users).
  const fromToken = identities.find((id) => isCanonicalPhone(id));
  if (fromToken) {
    return { identities, phone: fromToken, uid, phoneSource: "token" };
  }

  // 2. The caller's own users doc keyed by the verified auth.uid.
  if (uid) {
    try {
      const byUid = await adminDb.collection("users").doc(uid).get();
      if (byUid.exists) {
        const p = String((byUid.data() as any)?.phone || "").trim();
        if (isCanonicalPhone(p)) {
          return { identities, phone: p, uid, phoneSource: "users-doc" };
        }
      }
    } catch {
      /* fall through */
    }
  }

  // 3. Corroborated client claim — ONLY for tokens without a phone claim
  //    (Google logins). The claim must name a REAL member profile.
  const canonicalClaim = normalizeClaimedPhone(claimedPhone);
  if (!decoded?.phone_number && isCanonicalPhone(canonicalClaim)) {
    const exists = await usersDocExistsForPhone(canonicalClaim, uid);
    if (exists) {
      return {
        identities: [...identities, canonicalClaim, "+91" + canonicalClaim],
        phone: canonicalClaim,
        uid,
        phoneSource: "claimed",
      };
    }
  }

  return { identities, phone: "", uid, phoneSource: "none" };
}

function normalizeClaimedPhone(raw: string | null | undefined): string {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/**
 * Does a users document for this phone genuinely exist? Checks the canonical
 * doc key first, then the indexed phone field, then a uid back-reference.
 */
async function usersDocExistsForPhone(
  phone: string,
  uid: string
): Promise<boolean> {
  try {
    const direct = await adminDb.collection("users").doc(phone).get();
    if (direct.exists) return true;
  } catch {
    /* keep trying */
  }
  try {
    const byPhone = await adminDb
      .collection("users")
      .where("phone", "==", phone)
      .limit(1)
      .get();
    if (!byPhone.empty) return true;
    if (uid) {
      const byUid = await adminDb
        .collection("users")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (!byUid.empty) return true;
    }
  } catch {
    /* unresolved */
  }
  return false;
}

/**
 * A caller "counts as" the given stored key when their verified identities
 * match it directly, OR (Google-login case) when their resolved phone equals
 * the stored key. Phone-keyed group docs store the bare 10-digit form, but
 * tolerate the other historical forms too.
 */
export function identityMatchesKey(
  resolved: ResolvedCaller,
  key: string | null | undefined
): boolean {
  const k = String(key || "").trim();
  if (!k) return false;
  if (resolved.identities.includes(k)) return true;
  if (resolved.phone && resolved.phone === k) return true;
  const kDigits = k.replace(/[^0-9]/g, "");
  if (
    resolved.phone &&
    kDigits.length >= 10 &&
    kDigits.slice(-10) === resolved.phone
  ) {
    return true;
  }
  return false;
}

