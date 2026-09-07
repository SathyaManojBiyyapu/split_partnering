import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import admin, { adminDb, adminTimestamp, adminCredentialsConfigured } from "@/firebase/admin";
import {
  isMember,
  memberList,
  resolveRequired,
  memberCount,
  isOpen,
  matchesLocation,
  matchesGroupKey,
  activeMemberPhones,
  pickOldestRefillable,
} from "@/app/lib/groupMatching";

export const runtime = "nodejs";
export const maxDuration = 30;

/* Generate a fresh match/session id — any membership change invalidates all
 * prior payment state so an old pair's payment can never unlock a new pair. */
function newPairingId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return `p_${c.randomUUID()}`;
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/* Sync the chat doc membership with the CURRENT group members (live for both). */
async function syncChatMembers(groupId: string, memberUIDs: string[], members: any[]) {
  try {
    const chatSnap = await adminDb.collection("chats").where("groupId", "==", groupId).limit(1).get();
    if (chatSnap.empty) return;
    await chatSnap.docs[0].ref.update({
      members: members || [],
      memberUIDs: memberUIDs || [],
      updatedAt: adminTimestamp(),
    });
  } catch {
    /* chat sync is best-effort */
  }
}

/**
 * FIFO refill: when a group has exactly ONE open slot and is still open,
 * move the lone member of the OLDEST compatible waiting group (same full
 * matching key) into the slot. The source group becomes "empty" (retained for
 * history), the target becomes 2/2 "ready", and BOTH members' payments reset
 * for the new pairing. The move is re-validated inside a transaction, so two
 * concurrent removals can never overfill — capacity NEVER exceeds required.
 */
async function refillOpenSlot(targetGroupId: string) {
  const groupsRef = adminDb.collection("groups");

  for (let attempt = 0; attempt < 3; attempt++) {
    const targetDoc = await groupsRef.doc(targetGroupId).get();
    if (!targetDoc.exists) return;
    const target = targetDoc.data() as any;
    if (!isOpen(target)) return;
    const tCount = memberCount(target);
    const required = resolveRequired(target, target.option);
    if (tCount !== required - 1) return; // no longer exactly one free slot

    const snap = await groupsRef
      .where("category", "==", String(target.category || ""))
      .where("option", "==", String(target.option || ""))
      .limit(100)
      .get();
    const best = pickOldestRefillable(
      snap.docs as any,
      {
        state: String(target.state || ""),
        district: String(target.district || ""),
        city: String(target.city || ""),
        option: String(target.option || ""),
        collaboratorId: String(target.collaboratorId || ""),
      },
      targetGroupId
    );
    if (!best) return; // no compatible lone user waiting yet

    try {
      const outcome = await adminDb.runTransaction(async (tx) => {
        const tRef = groupsRef.doc(targetGroupId);
        const sRef: admin.firestore.DocumentReference = (best as any).ref || groupsRef.doc((best as any).id);
        const tSnap = await tx.get(tRef);
        const sSnap = await tx.get(sRef);
        if (!tSnap.exists || !sSnap.exists) return { retry: true as const };
        const tData = tSnap.data() as any;
        const sData = sSnap.data() as any;
        if (!isOpen(tData) || !isOpen(sData)) return { retry: true as const };
        const req = resolveRequired(tData, tData.option);
        const tMembersNow = memberList(tData);
        if (memberCount(tData) !== req - 1) return { retry: true as const };
        const sMembers = memberList(sData);
        if (sMembers.length !== 1) return { retry: true as const };
        if (!matchesLocation(sData, String(tData.state || ""), String(tData.district || ""), String(tData.city || ""))) return { retry: true as const };
        if (!matchesGroupKey(sData, String(tData.collaboratorId || ""))) return { retry: true as const };

        const moved = sMembers[0];
        const movedPhone = typeof moved === "string" ? moved : moved?.phone || moved?.uid || "";
        const targetPhones = tMembersNow
          .map((m: any) => (typeof m === "string" ? m : m?.phone || m?.uid || ""))
          .filter((p: string) => p);
        if (!movedPhone || targetPhones.includes(movedPhone)) return { retry: true as const };

        const nextPairingId = newPairingId();
        const resetTargetMembers = tMembersNow.map((m: any) =>
          typeof m === "string" ? m : { ...m, paid: false }
        );
        const allPhones = [...targetPhones, movedPhone];
        const memberPayments: Record<string, any> = {};
        for (const p of allPhones) {
          memberPayments[p] = { paid: false, pairingId: nextPairingId };
        }

        tx.update(sRef, {
          members: [],
          memberUIDs: [],
          membersCount: 0,
          status: "empty",
          pairingId: nextPairingId,
          memberPayments: {},
          refilledOutTo: targetGroupId,
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.update(tRef, {
          members: [...resetTargetMembers, typeof moved === "string" ? moved : { ...moved, paid: false }],
          memberUIDs: [...targetPhones, movedPhone],
          membersCount: req,
          status: "ready",
          pairingId: nextPairingId,
          memberPayments,
          readyAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastActivityAt: FieldValue.serverTimestamp(),
        });
        return { retry: false as const, movedPhone };
      });

      if (!outcome.retry) {
        const finalTarget = await groupsRef.doc(targetGroupId).get();
        if (finalTarget.exists) {
          const d = finalTarget.data() as any;
          await syncChatMembers(targetGroupId, d?.memberUIDs || [], d?.members || []);
        }
      }
    } catch {
      /* transient conflict → loop; a retry may still find a user */
    }
  }
}

/**
 * SERVER-SIDE SOFT "REMOVE MATCH" (My Matches retention) + FIFO REFILL.
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
 *      stamp a NEW pairingId with every remaining member's payment reset to
 *      pending (a membership change = a new pairing).
 *      - Remaining members = 0 → the group is marked "empty" (never matched).
 *      - Remaining members = required - 1 → group stays "waiting" (open slot).
 *   3. If the removal leaves exactly one open slot, FIFO-REFILL it from the
 *      OLDEST compatible open waiting group that has exactly one lone member
 *      (same State + District + City + Category + Subgroup + Gym). The lone
 *      member is moved into the vacated slot, their old group is marked
 *      "empty", and both members' payments reset for the new pairing.
 *      The move is transactional and re-validated at commit → no 3/2.
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
      const oldCount = Number(data.membersCount) || members.length;
      const newCount = Math.max(0, oldCount - 1);
      const required = resolveRequired(data, data.option);
      // Any membership change = a NEW pairing: fresh pairingId and every
      // remaining member's payment resets to pending (old payment state can
      // never unlock the replacement pairing).
      const nextPairingId = newPairingId();
      const remaining = members.filter((m: any) =>
        typeof m === "string"
          ? m.trim() !== phone
          : m?.phone !== phone && m?.uid !== phone && (m?.phone || m?.uid) !== phone
      );
      const remainingPhones = remaining
        .map((m: any) => (typeof m === "string" ? m : m?.phone || m?.uid || ""))
        .filter((p: string) => p && p.trim() !== "");
      const resetMembers = remaining.map((m: any) =>
        typeof m === "string" ? m : { ...m, paid: false }
      );
      const memberPayments: Record<string, any> = {};
      for (const p of remainingPhones) {
        memberPayments[p] = { paid: false, pairingId: nextPairingId };
      }

      if (newCount <= 0) {
        // Nobody left → mark the group empty so it is never matched again.
        // The doc is still retained (history/audit).
        tx.update(ref, {
          members: [],
          memberUIDs: [],
          membersCount: 0,
          status: "empty",
          pairingId: nextPairingId,
          memberPayments: {},
          deletedByUsers: FieldValue.arrayUnion(phone),
          [`deletedByUserAt.${phone}`]: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        tx.update(ref, {
          members: resetMembers,
          memberUIDs: remainingPhones,
          membersCount: newCount,
          // Soft-delete audit trail — the doc itself is never deleted.
          deletedByUsers: FieldValue.arrayUnion(phone),
          [`deletedByUserAt.${phone}`]: FieldValue.serverTimestamp(),
          status: newCount >= required ? "ready" : "waiting",
          pairingId: nextPairingId,
          memberPayments,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return { ok: true as const, status: 200, newCount, required };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    // Drop the leaving member from the chat doc so their client-side chat
    // read access ends immediately (rules key on chat memberUIDs).
    try {
      const gDoc = await adminDb.collection("groups").doc(groupId).get();
      if (gDoc.exists) {
        const d = gDoc.data() as any;
        await syncChatMembers(groupId, d?.memberUIDs || [], d?.members || []);
      }
    } catch {
      /* best-effort */
    }

    // The removal opens exactly one slot → try to FIFO-refill it from the
    // OLDEST compatible waiting lone user (same matching key). If none exists,
    // the group remains 1/x and the next /api/join-group call fills it.
    if (result.newCount === result.required - 1) {
      await refillOpenSlot(groupId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("REMOVE-MATCH ERROR:", err);
    return NextResponse.json({ error: "Failed to remove match" }, { status: 500 });
  }
}
