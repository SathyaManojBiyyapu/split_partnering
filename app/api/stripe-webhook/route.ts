import { NextResponse } from "next/server";
import Stripe from "stripe";
import { adminDb, adminTimestamp } from "@/firebase/admin";

const ACTIVATION_PRICE = 29;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("xxxx")) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key);
}

/* =========================
   MARK GROUP MEMBER PAID
========================== */

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
========================== */

async function finalizePayment(
  groupId: string,
  userId: string,
  stripeSessionId: string
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
      stripeSessionId,
      paidAt: adminTimestamp(),
    });
  }
}

/**
 * Verifies Stripe webhook signatures and finalizes payments server-side.
 */
export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe signature" },
        { status: 400 }
      );
    }

    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret || endpointSecret.includes("xxxx")) {
      return NextResponse.json(
        { error: "STRIPE_WEBHOOK_SECRET is not configured" },
        { status: 500 }
      );
    }

    const rawBody = await req.text();

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      endpointSecret
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const groupId = session.metadata?.groupId;

      if (!uid || !groupId) {
        console.warn(
          "Stripe checkout completed missing uid/groupId in metadata:",
          session.id
        );
        return NextResponse.json({ received: true, skipped: true });
      }

      // Verify the amount was correct
      const totalAmount = session.amount_total || 0;
      if (totalAmount !== ACTIVATION_PRICE * 100) {
        console.warn(
          `Stripe checkout amount mismatch: expected ${ACTIVATION_PRICE * 100}, got ${totalAmount} for session ${session.id}`
        );
        return NextResponse.json({ received: true, skipped: true });
      }

      console.log(
        "Stripe checkout completed:",
        session.id,
        uid,
        groupId
      );

      await finalizePayment(groupId, uid, session.id);
      await markMemberPaid(groupId, uid);

      console.log(
        `Stripe payment ${session.id} finalized and member marked paid`
      );
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Webhook error";
    console.error("Stripe webhook error:", message);

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}