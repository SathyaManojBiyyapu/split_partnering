import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.includes("xxxx")) {
    return null;
  }
  return new Stripe(key);
}

/** Verifies Stripe Checkout session; Firestore updates run on the authenticated client. */
export async function POST(req: Request) {
  try {
    const stripe = getStripe();

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    const uid = session.metadata?.uid;
    const groupId = session.metadata?.groupId;

    if (!uid || !groupId) {
      return NextResponse.json(
        { error: "Missing payment metadata" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      uid,
      groupId,
      stripeSessionId: session.id,
    });
  } catch (error) {
    console.error("Stripe session verification error:", error);

    return NextResponse.json(
      { error: "Stripe session verification failed" },
      { status: 500 }
    );
  }
}
