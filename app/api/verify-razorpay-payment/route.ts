import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import admin, { adminDb, adminTimestamp } from "@/firebase/admin";
import {
  memberList,
  memberCount,
  resolveRequired,
  getPairingId,
} from "@/app/lib/groupMatching";

const ACTIVATION_PRICE = 29;

function getRazorpaySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not set");
  }
  return secret;
}

function getRazorpay(): Razorpay {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay keys");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
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

/* Identity forms derived ONLY from the verified Firebase ID token. */
function tokenIdentities(decoded: any): string[] {
  const ids: string[] = [decoded?.uid || ""];
  if (decoded?.phone_number) {
    const raw = String(decoded.phone_number).trim();
    ids.push(raw, raw.replace(/^\+91/, ""));
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length === 12 && digits.startsWith("91")) ids.push(digits.slice(2));
  }
  return [...new Set(ids.filter(Boolean))];
}

export async function POST(req: Request) {
  try {
    const secret = getRazorpaySecret();
    const body = await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      groupId,
    } = body;

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
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
    // SERVER-SIDE: Verify the payment amount matches ₹29
    // This prevents paying a lower amount and unlocking chat.
    // ============================================================
    const razorpay = getRazorpay();
    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    if (!payment || payment.status !== "captured") {
      return NextResponse.json(
        { error: "Payment not captured" },
        { status: 400 }
      );
    }

    // Amount is in paise (₹29 = 2900 paise)
    if (payment.amount !== ACTIVATION_PRICE * 100) {
      return NextResponse.json(
        { error: "Payment amount mismatch" },
        { status: 400 }
      );
    }

    // ============================================================
    // Identity comes from the VERIFIED Firebase ID token — never from
    // a client-supplied body uid (prevents paying for another user).
    // ============================================================
    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded: any = null;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (error: any) {
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }

    const identities = tokenIdentities(decoded);

    // ============================================================
    // Load the group; the caller must be an active member and the
    // group must be FULL — payment only unlocks a complete pair,
    // never a 1/2 waiting group.
    // ============================================================
    const groupRef = adminDb.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();
    if (!groupSnap.exists) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const group = groupSnap.data() as any;
    const members = memberList(group);

    const callerMember = members.find((m: any) => {
      const p = typeof m === "string" ? m : m?.phone || m?.uid || "";
      return identities.includes(p);
    });
    const isPartOfGroup =
      !!callerMember ||
      identities.some((id) => (group?.memberUIDs || []).includes(id));

    if (!isPartOfGroup) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    const required = resolveRequired(group, group.option);
    if (memberCount(group) < required) {
      return NextResponse.json(
        { error: "Your match is not complete yet (1/2). You can pay once a partner joins." },
        { status: 409 }
      );
    }

    // The payment is bound to the CURRENT pairing. If a partner was replaced,
    // the pairingId changed and any old pay attempt cannot unlock the pair.
    const pairingId = getPairingId(group);
    const callerKey =
      (typeof callerMember === "object" && callerMember
        ? callerMember?.phone || callerMember?.uid
        : "") || identities[0];

    // ============================================================
    // Update the payment document(s): pending → paid (verified).
    // If the client's pending-doc write was rule-denied (e.g. Google
    // login without a phone claim), create one server-side so the
    // payment is still recorded.
    // ============================================================
    const paymentsRef = adminDb.collection("payments");
    const paySnap = await paymentsRef
      .where("groupId", "==", groupId)
      .where("status", "==", "pending")
      .get();
    let updatedAny = false;
    for (const d of paySnap.docs) {
      const ddata = d.data() as any;
      if (
        identities.includes(String(ddata?.uid || "")) ||
        identities.includes(String(ddata?.phone || ""))
      ) {
        await d.ref.update({
          status: "paid",
          verified: true,
          razorpayPaymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          pairingId,
          paidAt: adminTimestamp(),
        });
        updatedAny = true;
      }
    }
    if (!updatedAny) {
      await paymentsRef.add({
        uid: callerKey,
        phone: callerKey,
        groupId,
        category: group?.category || "",
        option: group?.option || "",
        amount: ACTIVATION_PRICE,
        status: "paid",
        verified: true,
        paymentMethod: "razorpay",
        razorpayPaymentId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        pairingId,
        paidAt: adminTimestamp(),
        createdAt: adminTimestamp(),
      });
    }

    // ============================================================
    // Mark THIS member as paid FOR THE CURRENT PAIRING on the shared
    // group doc — the live source of truth for both users' UIs.
    // ============================================================
    if (callerKey) {
      const updatedMembers = members.map((m: any) => {
        if (typeof m === "string") return m;
        const p = m?.phone || m?.uid || "";
        if (identities.includes(p)) return { ...m, paid: true };
        return m;
      });
      const memberPayments = {
        ...(group?.memberPayments || {}),
        [callerKey]: { paid: true, pairingId, paidAt: adminTimestamp() },
      };
      await groupRef.update({ members: updatedMembers, memberPayments });
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