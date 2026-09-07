import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin, { adminCredentialsConfigured } from "@/firebase/admin";

/* =========================
   FIXED ACTIVATION PRICE
========================== */
const ACTIVATION_PRICE = 29;

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (
    !key ||
    key.includes("xxxx") ||
    (process.env.NODE_ENV === "production" && key.startsWith("sk_test_"))
  ) {
    return null;
  }

  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    if (!stripe) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Add a real STRIPE_SECRET_KEY to .env.local and set NEXT_PUBLIC_STRIPE_ENABLED=true",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { groupId } = body;

    /* -----------------------------
       VALIDATION
    ----------------------------- */

    if (!groupId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Identity is derived from the VERIFIED Firebase ID token — never from a
    // client-supplied uid. The token-derived identity is what the webhook
    // credits for the payment.
    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!adminCredentialsConfigured) {
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing." },
        { status: 503 }
      );
    }

    let uid = "";
    let phone = "";
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      uid = decoded?.uid || "";
      if (decoded?.phone_number) {
        phone = String(decoded.phone_number).replace(/^\+91/, "").trim();
      }
    } catch (error: any) {
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }

    // Verify the user is actually a member of this group before creating a session
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
    const identities = [uid, phone, `+91${phone}`, `91${phone}`].filter(Boolean);
    const isMember =
      members.some((m: any) => identities.includes(m?.phone) || identities.includes(m?.uid)) ||
      identities.some((id) => memberUIDs.includes(id));

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    /* -----------------------------
       CREATE STRIPE SESSION — fixed ₹29
    ----------------------------- */

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: "Partner Sync Activation",
              description: "Unlock internal group coordination & chat",
            },
            unit_amount: ACTIVATION_PRICE * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?groupId=${groupId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/payment?groupId=${groupId}`,
      metadata: {
        uid: phone || uid || "",
        groupId,
        amount: String(ACTIVATION_PRICE),
      },
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Stripe Session Creation Error:", error);
    return NextResponse.json(
      { error: "Stripe session creation failed" },
      { status: 500 }
    );
  }
}