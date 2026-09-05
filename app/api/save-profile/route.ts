import { NextResponse } from "next/server";
import admin, { adminDb, adminTimestamp, adminCredentialsConfigured } from "@/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * SERVER-SIDE PROFILE SAVE.
 *
 * WHY a server route (not a client Firestore write):
 *  - The Firestore rules for users/{phone} only accept a narrow set of own-doc
 *    ID forms (myPhone(), token.phone_number, auth.uid, legacy 91XXXXXXXXXX).
 *    Real-world sessions fall outside that set — e.g. Google-login users whose
 *    token has NO phone_number claim, or legacy docs keyed under other ID
 *    formats — which surfaced as "Profile save failed: Permission denied".
 *  - This route verifies the caller's Firebase ID token and then writes the
 *    user's OWN profile with the Admin SDK. No rules are weakened: the caller
 *    must still present a valid, fresh ID token, and can only ever write to
 *    their own resolved document (never another user's).
 *
 * Guarantees:
 *  - Mandatory fields (name, gender, state, district, city) are required.
 *  - Existing saved values are NEVER overwritten with empty/default ones.
 *  - The write always targets the caller's own document (resolved across all
 *    legacy ID formats), so no duplicate user documents are created.
 */

// All plausible own-doc ID forms for the authenticated caller, in priority
// order. Every candidate is strictly derived from the VERIFIED token, so no
// attacker-controlled value ever decides which document is written.
function ownDocCandidates(decoded: any): string[] {
  const candidates: string[] = [];
  const rawPhone = typeof decoded?.phone_number === "string" ? decoded.phone_number : "";
  // Canonical 10-digit form for Indian numbers; digits-only otherwise.
  let canonical = rawPhone ? rawPhone.replace(/[^0-9]/g, "") : "";
  if (canonical.length === 12 && canonical.startsWith("91")) canonical = canonical.slice(2);
  if (canonical.length === 11 && canonical.startsWith("0")) canonical = canonical.slice(1);

  if (canonical) candidates.push(canonical);
  if (rawPhone && !candidates.includes(rawPhone)) candidates.push(rawPhone);
  const legacy = canonical && canonical.length === 10 ? `91${canonical}` : "";
  if (legacy && !candidates.includes(legacy)) candidates.push(legacy);
  if (decoded?.uid && !candidates.includes(decoded.uid)) candidates.push(decoded.uid);
  return candidates;
}

async function resolveOwnDoc(decoded: any) {
  const candidates = ownDocCandidates(decoded);
  for (const docId of candidates) {
    try {
      const snap = await adminDb.collection("users").doc(docId).get();
      if (snap.exists) return { docId, data: snap.data() || {} };
    } catch {
      /* try the next candidate */
    }
  }
  // Last resort: indexed equality query on the canonical phone field.
  const canonical = candidates[0];
  if (canonical) {
    try {
      const snap = await adminDb
        .collection("users")
        .where("phone", "==", canonical)
        .limit(1)
        .get();
      if (!snap.empty) {
        const d = snap.docs[0];
        return { docId: d.id, data: d.data() || {} };
      }
    } catch {
      /* fall through to create */
    }
  }
  return null;
}
export async function POST(req: Request) {
  try {
    if (!adminCredentialsConfigured) {
      console.error(
        "SAVE-PROFILE ERROR: Firebase admin credentials are not configured. " +
          "Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line service-account JSON) " +
          "in the deployment environment."
      );
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing." },
        { status: 503 }
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // fall through to validation below
    }

    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json(
          { error: "Invalid or expired session. Please re-login." },
          { status: 401 }
        );
      }
      throw error;
    }

    /* --- Mandatory profile fields (validated server-side) --- */
    const name = String(payload?.name ?? "").trim();
    const gender = String(payload?.gender ?? "").trim();
    const state = String(payload?.state ?? "").trim();
    const district = String(payload?.district ?? "").trim();
    const city = String(payload?.city ?? "").trim();

    const missing: string[] = [];
    if (!name) missing.push("name");
    if (!gender) missing.push("gender");
    if (!state) missing.push("state");
    if (!district) missing.push("district");
    if (!city) missing.push("city");
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing mandatory profile fields: ${missing.join(", ")}`, missing },
        { status: 400 }
      );
    }

    /* --- Resolve the caller's own document (never another user's) --- */
    const existing = await resolveOwnDoc(decoded);

    // New document key: canonical 10-digit phone when the token has one,
    // otherwise the Firebase UID (Google-login users without a phone claim).
    const candidates = ownDocCandidates(decoded);
    const docId = existing?.docId || candidates[0] || decoded.uid;
    if (!docId) {
      return NextResponse.json(
        { error: "Could not resolve your account identity" },
        { status: 400 }
      );
    }
    const existingData: Record<string, any> = existing?.data || {};

    // Never overwrite an existing saved value with an empty/default one.
    const pick = (value: string, key: string) =>
      value && value.trim() !== "" ? value : existingData[key] ?? "";

    const phoneField =
      existingData.phone && String(existingData.phone).trim() !== ""
        ? String(existingData.phone).trim()
        : docId;

    await adminDb.collection("users").doc(docId).set(
      {
        // Preserve the stored identity (existing field wins).
        phone: phoneField,
        // Name is preserved forever once saved (existing field wins).
        name:
          existingData.name && String(existingData.name).trim() !== ""
            ? String(existingData.name).trim()
            : name,
        city: pick(city, "city"),
        district: pick(district, "district"),
        state: pick(state, "state"),
        gender: pick(gender, "gender"),
        bio: pick(String(payload?.bio ?? ""), "bio"),
        interests: pick(String(payload?.interests ?? ""), "interests"),
        college: pick(String(payload?.college ?? ""), "college"),
        photoURL: String(payload?.photoURL ?? "").trim() || existingData.photoURL || "",
        verified: true,
        profileCompleted: true,
        updatedAt: adminTimestamp(),
        notificationPrefs:
          payload?.notificationPrefs ??
          existingData.notificationPrefs ?? {
            matchAlerts: true,
            paymentAlerts: true,
            chatAlerts: true,
          },
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, docId });
  } catch (error: any) {
    console.error("SAVE-PROFILE ERROR:", error?.code || "", error?.message || error);
    return NextResponse.json(
      { error: "Failed to save profile. Please try again." },
      { status: 500 }
    );
  }
}

