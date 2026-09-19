export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

import { adminDb, adminTimestamp } from "@/firebase/admin";
import {
  memberList,
  getPairingId,
  chatUnlocked,
  activeMemberPhones,
} from "@/app/lib/groupMatching";
import {
  maybeRematchAfterPayment,
  shouldAttemptRematch,
} from "@/app/lib/serverRematching";

const ACTIVATION_PRICE = 29;

/* =========================
   VERIFY RAZORPAY WEBHOOK
   SIGNATURE
========================== */

function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return expected === signature;
}

/* =========================
   ENSURE CHAT DOC
   A fully-paid pair must always have a chats doc — mirrors
   /api/join-group's ensureChat. Without it /api/verify-chat-access
   returns 404 "Chat not available yet" even when both members paid.
========================== */

async function ensureChatDoc(groupId: string, group: any) {
  const existing = await adminDb
    .collection("chats")
    .where("groupId", "==", groupId)
    .limit(1)
    .get();
  if (!existing.empty) {
    // Chat doc exists — sync memberUIDs with current group membership.
    // Without this, a chat doc created at 1/2 membership would retain stale
    // memberUIDs and deny the second user access via Firestore rules.
    const chatDoc = existing.docs[0];
    await chatDoc.ref.update({
      members: memberList(group),
      memberUIDs: activeMemberPhones(group),
      updatedAt: adminTimestamp(),
    });
    return;
  }
  await adminDb.collection("chats").add({
    groupId,
    createdAt: adminTimestamp(),
    members: memberList(group),
    memberUIDs: activeMemberPhones(group),
    lastMessage: "",
    lastMessageAt: adminTimestamp(),
    unreadCounts: {},
    isActive: true,
  });
}

/* =========================
   MARK GROUP MEMBER PAID
   Writes the ACTUAL chat-unlock entitlement: groups.memberPayments[key]
   = { paid: true, pairingId } for the CURRENT pairing.
   chatUnlocked() (used by /api/verify-chat-access) reads ONLY
   memberPayments — it ignores members[].paid — so a webhook that only
   set members[].paid would capture money while chat stayed locked
   forever. The key must be the group's OWN key for this member (same
   resolution as /api/verify-razorpay-payment).
========================== */

async function markMemberPaid(
  groupId: string,
  userId: string
): Promise<void> {
  const groupRef = adminDb.collection("groups").doc(groupId);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) return;

  const group = groupSnap.data();
  const pairingId = getPairingId(group);
  const members = memberList(group);

  // Resolve the group's canonical key for this payer (never the webhook
  // notes verbatim — they can drift from how members[] is keyed).
  const member = members.find((m: any) => {
    const p = typeof m === "string" ? m : m?.phone || m?.uid || "";
    return p === userId;
  });
  const key =
    (typeof member === "string"
      ? member
      : String(member?.phone || member?.uid || "")) || userId;

  // NEVER write a stray entitlement for someone who is not an ACTIVE member.
  // chatUnlocked() only counts the current members' keys, so an orphan entry
  // (stale notes.uid, a Google-login uid with no phone claim, or a partner who
  // has since left) would be dead state — and for a replaced partner it could
  // later LOOK like a valid payment on the new pairing. The payment is still
  // recorded in /payments by finalizePayment(); the group entitlement stays
  // untouched so it can never conflict with the pairing-scoped state.
  const isActiveMember =
    !!member ||
    (Array.isArray(group?.memberUIDs) ? group.memberUIDs : []).includes(userId);
  if (!isActiveMember) {
    console.warn(
      `[razorpay-webhook] payment.captured for NON-ACTIVE member group=${groupId} ` +
        `uid=${userId} — skipped entitlement (payment recorded in /payments).`
    );
    return;
  }

  const updatedMembers = members.map((m: any) => {
    if (typeof m === "string") return m;
    const p = m?.phone || m?.uid || "";
    if (p === userId) return { ...m, paid: true };
    return m;
  });

  const memberPayments = {
    ...(group?.memberPayments || {}),
    [key]: { paid: true, pairingId, paidAt: adminTimestamp() },
  };

  await groupRef.update({ members: updatedMembers, memberPayments });

  // If this was the last missing payment, the pair is now fully paid →
  // guarantee the chat doc exists so /api/verify-chat-access cannot 404.
  const afterSnap = await groupRef.get();
  const groupAfter = afterSnap.exists ? afterSnap.data() : group;
  if (chatUnlocked(groupAfter)) {
    await ensureChatDoc(groupId, groupAfter);
  } else if (shouldAttemptRematch(groupAfter)) {
    // FIFO re-matching: payer is paid but their pairing is still incomplete —
    // pair them with the earliest compatible PAID member (server-side only).
    await maybeRematchAfterPayment(groupId, key);
  }

  console.log(
    `[razorpay-webhook] entitlement updated: group=${groupId} key=${key} ` +
      `pairingId=${pairingId} chatUnlocked=${chatUnlocked(groupAfter)}`
  );
}

/* =========================
   UPDATE PAYMENT DOCUMENT
========================== */

async function finalizePayment(
  groupId: string,
  userId: string,
  razorpayPaymentId: string,
  razorpayOrderId: string
): Promise<void> {
  const paymentsRef = adminDb.collection("payments");
  const paySnap = await paymentsRef
    .where("uid", "==", userId)
    .where("groupId", "==", groupId)
    .where("status", "==", "pending")
    .get();

  for (const d of paySnap.docs) {
    await d.ref.update({
      status: "paid",
      verified: true,
      razorpayPaymentId,
      razorpayOrderId,
      paidAt: adminTimestamp(),
    });
  }
}

/* =========================
   WEBHOOK HANDLER
========================== */

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET is not set. " +
        "Go to Razorpay Dashboard > Settings > Webhooks, create a webhook for payment.captured, " +
        "copy the webhook secret, and add it to your .env.local and Vercel environment variables."
      );
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 400 }
      );
    }

    const event = JSON.parse(rawBody);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};

      const groupId = notes.groupId;
      const uid = notes.uid;

      if (!groupId || !uid) {
        console.warn(
          "Webhook payment.captured missing groupId/uid in notes:",
          payment.id
        );
        return NextResponse.json({ received: true, skipped: true });
      }

      // ============================================================
      // VERIFY AMOUNT — only finalize if the payment is exactly ₹29
      // ============================================================
      if (payment.amount !== ACTIVATION_PRICE * 100) {
        console.warn(
          `Webhook payment amount mismatch: expected ${ACTIVATION_PRICE * 100}, got ${payment.amount} for payment ${payment.id}`
        );
        return NextResponse.json({ received: true, skipped: true });
      }

      console.log(
        `Razorpay payment captured: ${payment.id}, groupId=${groupId}, uid=${uid}`
      );

      await finalizePayment(
        groupId,
        uid,
        payment.id,
        payment.order_id
      );

      await markMemberPaid(groupId, uid);

      console.log(
        `Payment ${payment.id} finalized and member marked paid`
      );
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Razorpay webhook error:", error?.message || error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}