export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

import { adminDb, adminTimestamp } from "@/firebase/admin";

/* =========================
   VERIFY RAZORPAY WEBHOOK
   SIGNATURE
========================= */

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
   MARK GROUP MEMBER PAID
========================= */

async function markMemberPaid(
  groupId: string,
  userId: string
): Promise<void> {
  const groupRef = adminDb.collection("groups").doc(groupId);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) return;

  const group = groupSnap.data();
  const updatedMembers = (group?.members || []).map((m: any) => {
    if (typeof m === "string") return m;

    if (m.phone === userId || m.uid === userId) {
      return { ...m, paid: true };
    }

    return m;
  });

  await groupRef.update({ members: updatedMembers });
}

/* =========================
   UPDATE PAYMENT DOCUMENT
========================= */

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
========================= */

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