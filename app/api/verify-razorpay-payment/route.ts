import { NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb, adminTimestamp } from "@/firebase/admin";

function getRazorpaySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not set");
  }
  return secret;
}

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return expected === signature;
}

export async function POST(req: Request) {
  try {
    const secret = getRazorpaySecret();
    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      uid,
      groupId,
    } = body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !uid ||
      !groupId
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const valid = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret
    );

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 }
      );
    }

    // ============================================================
    // SERVER-SIDE: Update payment document from pending → paid
    // Admin SDK bypasses Firestore security rules.
    // ============================================================

    const paymentsRef = adminDb.collection("payments");
    const paySnap = await paymentsRef
      .where("uid", "==", uid)
      .where("groupId", "==", groupId)
      .where("status", "==", "pending")
      .get();

    for (const d of paySnap.docs) {
      await d.ref.update({
        status: "paid",
        verified: true,
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        paidAt: adminTimestamp(),
      });
    }

    // ============================================================
    // SERVER-SIDE: Mark member as paid in the group document
    // ============================================================

    const groupRef = adminDb.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (groupSnap.exists) {
      const group = groupSnap.data();
      const updatedMembers = (group?.members || []).map((m: any) => {
        if (typeof m === "string") return m;
        if (m.phone === uid || m.uid === uid) {
          return { ...m, paid: true };
        }
        return m;
      });
      await groupRef.update({ members: updatedMembers });
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
    });
  } catch (error) {
    console.error("Razorpay verification error:", error);

    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
