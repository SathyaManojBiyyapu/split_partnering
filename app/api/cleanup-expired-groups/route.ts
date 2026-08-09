export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { adminDb, adminTimestamp } from "@/firebase/admin";

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
 * - Only marks groups as "expired" — does NOT hard-delete (preserves audit/payment records).
 * - Only touches groups where NO member has paid (paid: true).
 * - Only touches groups with status "waiting" or "ready" (never "completed").
 * - Uses server-side timestamps for createdAt comparison.
 */
export async function GET() {
  try {
    const now = Date.now();
    const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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

      // Only expire groups older than 24 hours
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