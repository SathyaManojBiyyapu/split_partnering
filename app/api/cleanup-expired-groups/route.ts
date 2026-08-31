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
 * SERVER-SIDE automatic group expiration.
 *
 * Business rule: Groups that remain inactive/unpaid for 24 hours
 * become "expired" (status = "expired").
 *
 * This runs via Vercel Cron (see vercel.json) and uses the Admin SDK,
 * so it is NOT dependent on any frontend timer.
 *
 * Safety:
 * - Protected: requires Authorization: Bearer <CRON_SECRET>.
 * - Only marks groups as "expired" — does NOT hard-delete (preserves audit/payment records).
 * - Only touches groups where NO member has paid (paid: true).
 * - Only touches groups with status "waiting" or "ready" (never "completed").
 * - Uses server-side timestamps for createdAt comparison.
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
    // A match/group remains valid for 1 MONTH (30 days) from creation.
    const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

    const groupsRef = adminDb.collection("groups");
    const snapshot = await groupsRef
      .where("status", "in", ["waiting", "ready"])
      .get();

    let expiredCount = 0;
    let skippedActive = 0;

    const batch = adminDb.batch();

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

      // Only expire groups older than 1 month (30 days)
      if (ageMs < EXPIRY_MS) {
        skippedActive++;
        return;
      }

      // Check if ANY member has paid — if so, never expire
      const members = Array.isArray(data?.members) ? data.members : [];
      const hasPaidMember = members.some((m: any) => m?.paid === true);
      if (hasPaidMember) {
        skippedActive++;
        return;
      }

      // Mark as expired (safe, non-destructive)
      batch.update(doc.ref, {
        status: "expired",
        expiresAt: adminTimestamp(),
        expiredAt: adminTimestamp(),
        lastActivityAt: adminTimestamp(),
      });
      expiredCount++;
    });

    if (expiredCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      expiredCount,
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