import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import admin, { adminDb, adminCredentialsConfigured } from "@/firebase/admin";
import { isMember, memberList, resolveRequired } from "@/app/lib/groupMatching";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * SERVER-SIDE SOFT "REMOVE MATCH" (My Matches retention).
 *
 * WHY a server route (not client-side):
 *  - firestore.rules grants `groups` updates to ADMINS ONLY, so the client
 *    cannot edit a group doc directly (it gets permission-denied). This is
 *    the same reason /api/join-group is a server route.
 *  - The group doc must NEVER be physically deleted: it is the source of
 *    truth for the OTHER members' My Matches history.
 *
 * Flow:
 *   1. Verify the caller (Firebase ID token) and resolve the phone number.
 *   2. Inside a transaction: re-verify membership, remove the caller from
 *      members/memberUIDs, decrement membersCount, recompute status, and
 *      record `deletedByUsers` + `deletedByUserAt.<phone>` (auditable,
 *      intentional removal only — never an automatic cleanup).
 *
 * Returns { success: true } or an error status.
 */
export async function POST(req: Request) {
  try {
    // Fail fast with an actionable error when the server has no admin
    // credentials (e.g. FIREBASE_SERVICE_ACCOUNT_KEY missing on Vercel) —
    // otherwise every adminDb call throws and surfaces as an opaque 500.
    if (!adminCredentialsConfigured) {
      console.error(
        "REMOVE-MATCH ERROR: Firebase admin credentials are not configured. " +
          "Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line service-account JSON) " +
          "in the deployment environment."
      );
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing. Match removal is temporarily unavailable." },
        { status: 503 }
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // fall through to validation below
    }

    const groupId = String(payload?.groupId || "").trim();
    if (!groupId) {
      return NextResponse.json({ error: "groupId is required" }, { status: 400 });
    }

    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* --- Resolve the logged-in user's authoritative phone from the token --- */
    let phone = "";
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded.phone_number) {
        phone = decoded.phone_number.replace(/^\+91/, "").trim();
      }
      if (!phone && decoded.uid) {
        // Google-login members may have no phone_number claim — fall back to
        // their users doc (keyed by uid) to resolve the canonical phone.
        const byUid = await adminDb.collection("users").doc(decoded.uid).get();
        if (byUid.exists) {
          phone = String((byUid.data() as any)?.phone || "").trim();
        }
      }
    } catch (error: any) {
      // Only genuine token problems → 401; infra/credential failures must
      // surface with their real cause (see the 500 handler below).
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }
    if (!phone) {
      return NextResponse.json(
        { error: "Phone number could not be resolved" },
        { status: 400 }
      );
    }

    const result = await adminDb.runTransaction(async (tx) => {
      const ref = adminDb.collection("groups").doc(groupId);
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { ok: false as const, status: 404, error: "Group not found" };
      }
      const data = snap.data() as any;

      // Only a genuine member may remove themselves.
      if (!isMember(data, phone)) {
        return {
          ok: false as const,
          status: 403,
          error: "You are not a member of this group",
        };
      }

      const members = memberList(data);
      const removeEntry = members.find((m: any) =>
        typeof m === "string"
          ? m.trim() === phone
          : m?.phone === phone || m?.uid === phone
      );
      const oldCount = Number(data.membersCount) || members.length;
      const newCount = Math.max(0, oldCount - 1);
      const required = resolveRequired(data, data.option);

      tx.update(ref, {
        members:
          removeEntry !== undefined
            ? FieldValue.arrayRemove(removeEntry)
            : members.filter(
                (m: any) =>
                  (typeof m === "string" ? m.trim() !== phone : m?.phone !== phone) &&
                  m?.uid !== phone
              ),
        memberUIDs: FieldValue.arrayRemove(phone),
        membersCount: newCount,
        // Soft-delete audit trail — the doc itself is never deleted.
        deletedByUsers: FieldValue.arrayUnion(phone),
        [`deletedByUserAt.${phone}`]: FieldValue.serverTimestamp(),
        status: newCount >= required ? "ready" : "waiting",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { ok: true as const, status: 200 };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REMOVE-MATCH ERROR:", err);
    return NextResponse.json({ error: "Failed to remove match" }, { status: 500 });
  }
}
