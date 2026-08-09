export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Razorpay from "razorpay";

/* =========================
   FIXED ACTIVATION PRICE
========================== */
const ACTIVATION_PRICE = 29;

/* =========================
   GET RAZORPAY INSTANCE
========================== */

function getRazorpay(): Razorpay {
  const keyId =
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID;

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay keys");
  }

  // Block production startup with test keys
  if (
    process.env.NODE_ENV === "production" &&
    keyId.startsWith("rzp_test_")
  ) {
    throw new Error(
      "PRODUCTION BLOCKED: You are using Razorpay TEST keys (rzp_test_*) in production. " +
      "Replace with LIVE keys from https://dashboard.razorpay.com/app/keys"
    );
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/* =========================
   CREATE ORDER API
   NOTE: The amount is HARDCODED server-side.
   Client-supplied amounts are IGNORED to prevent payment bypass.
========================== */

export async function POST(req: Request) {
  try {
    const razorpay = getRazorpay();

    const body = await req.json();
    const { groupId, uid } = body;

    if (!groupId || !uid) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Verify the user is actually a member of this group before creating an order
    const { adminDb } = await import("@/firebase/admin");
    const groupRef = adminDb.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    const group = groupSnap.data();
    const members = group?.members || [];
    const memberUIDs = group?.memberUIDs || [];
    const isMember = members.some((m: any) => m?.phone === uid || m?.uid === uid) || memberUIDs.includes(uid);

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    /* =========================
       CREATE ORDER — fixed ₹29
    ========================= */

    const order = await razorpay.orders.create({
      amount: ACTIVATION_PRICE * 100,
      currency: "INR",
      receipt: `grp_${Date.now()}`,
      notes: {
        uid: uid || "",
        groupId: groupId || "",
        platform: "partnersync",
        amount: String(ACTIVATION_PRICE),
      },
    });

    return NextResponse.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error: any) {
    console.error("Razorpay order creation error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Razorpay order creation failed" },
      { status: 500 }
    );
  }
}