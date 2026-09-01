export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminDb, adminTimestamp } from "@/firebase/admin";

/**
 * CRON AUTH: Vercel Cron automatically sends
 *   Authorization: Bearer <CRON_SECRET>
 * when the CRON_SECRET environment variable is set on the Vercel project.
 * Any request without the exact secret is rejected. The secret is never
 * logged and never included in any response body.
 */
function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // secure default: no secret configured → deny all

  const header = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b); // timing-safe comparison
}

/**
 * SERVER-SIDE automatic group expiration + deletion.
 *
 * Business rule: A match/group remains valid for 6 MONTHS (180 days) from
 * creation. Groups that are still unpaid after 180 days are DELETED so the
 * members are freed up and can create a new match.
 *
 * This runs via Vercel Cron (see vercel.json) and uses the Admin SDK,
 * so it is NOT dependent on any frontend timer.
 *
 * Safety:
 * - Protected: requires Authorization: Bearer <CRON_SECRET>.
 * - Only touches groups where NO member has paid (paid: true).
 * - Only touches groups with status "waiting" or "ready" (never "completed").
 * - Uses server-side timestamps for createdAt comparison.
 * - Associated `selections` docs are marked status="expired" (audit kept).
 */
export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = Date.now();
    // A match/group remains valid for 6 MONTHS (180 days) from creation.
    const EXPIRY_MS = 180 * 24 * 60 * 60 * 1000; // 180 days (6 months)

    const groupsRef = adminDb.collection("groups");
    const snapshot = await groupsRef
      .where("status", "in", ["waiting", "ready"])
      .get();

    let deletedCount = 0;
    let skippedActive = 0;

    type Pending = { groupRef: any; groupId: string };
    const toDelete: Pending[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data?.createdAt;

      // Skip if no valid server timestamp
      if (!createdAt || typeof createdAt.toMillis !== "function") {
        skippedActive++;
        return;
      }

      const createdMs = createdAt.toMillis();
      const ageMs = now - createdMs;

      // Only delete groups older than 6 months (180 days)
      if (ageMs < EXPIRY_MS) {
        skippedActive++;
        return;
      }

      // Check if ANY member has paid — if so, never expire/delete
      const members = Array.isArray(data?.members) ? data.members : [];
      const hasPaidMember = members.some((m: any) => m?.paid === true);
      if (hasPaidMember) {
        skippedActive++;
        return;
      }

      toDelete.push({ groupRef: doc.ref, groupId: doc.id });
    });

    // Firestore batches are capped at 500 operations — chunk to stay safe.
    const CHUNK = 400;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK);
      const batch = adminDb.batch();

      for (const { groupRef, groupId } of chunk) {
        // Mark any selections pointing at this group as expired (audit trail).
        const selSnap = await adminDb
          .collection("selections")
          .where("groupId", "==", groupId)
          .get();
        selSnap.forEach((selDoc) => {
          batch.update(selDoc.ref, {
            status: "expired",
            expiredAt: adminTimestamp(),
          });
        });
        // Hard-delete the group so members can create a new match.
        batch.delete(groupRef);
      }

      await batch.commit();
      deletedCount += chunk.length;
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      skippedActive,
      checked: snapshot.size,
    });
  } catch (error: any) {
    console.error("Group cleanup error:", error?.message || error);
    return NextResponse.json(
      { error: "Group cleanup failed" },
      { status: 500 }
    );
  }
}