import { NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import admin, { adminDb, adminTimestamp } from "@/firebase/admin";
import {
  memberList,
  memberCount,
  resolveRequired,
  getPairingId,
  chatUnlocked,
  activeMemberPhones,
} from "@/app/lib/groupMatching";

const ACTIVATION_PRICE = 29;

function getRazorpaySecret(): string {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not set");
  }
  return secret;
}

/* Guarantees the chats doc exists once a pair is fully paid — mirrors
 * /api/join-group's ensureChat. Older groups (created before ensureChat was
 * added) or lost chat docs would otherwise make /api/verify-chat-access
 * return "Chat not available yet" (404) even though the pairing is fully
 * paid. */
async function ensureChatDoc(groupId: string, group: any) {
  const existing = await adminDb
    .collection("chats")
    .where("groupId", "==", groupId)
    .limit(1)
    .get();
  if (!existing.empty) return;
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
): { valid: boolean; expected: string } {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return { valid: expected === signature, expected };
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

    const { valid, expected } = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      secret
    );

    if (!valid) {
      // The HMAC comparison failed. The HMAC itself is canonical
      // (sha256 over "order_id|payment_id"), so the only real-world cause is
      // an ENVIRONMENT mismatch: RAZORPAY_KEY_SECRET does not belong to the
      // key that signed this payment (rotated/stale secret, or the
      // NEXT_PUBLIC checkout key and RAZORPAY_KEY_SECRET are from different
      // Razorpay accounts). The signature and digest below are NOT secrets
      // (the signature is already public in the browser/console); the secret
      // value is never logged here.
      const fmt = (s: string) =>
        (s?.length ?? 0) >= 16 ? `${s.slice(0, 8)}...${s.slice(-8)}` : `len=${(s ?? "").length}`;
      const keyId =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "";
      const keyMode = keyId.startsWith("rzp_test_")
        ? "TEST"
        : keyId.startsWith("rzp_live_")
          ? "LIVE"
          : "unset";
      console.error(
        `[verify-razorpay-payment] SIGNATURE MISMATCH order=${razorpay_order_id} ` +
          `payment=${razorpay_payment_id} received=${fmt(razorpay_signature)} ` +
          `expected=${fmt(expected)}. RAZORPAY_KEY_SECRET does not match the key ` +
          `that signed this payment (keyMode=${keyMode}). Verify the Vercel env ` +
          `vars NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET ` +
          `are the CURRENT key pair from the Razorpay dashboard.`
      );
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

    // ============================================================
    // Resolve the caller's ENTITLEMENT KEY — the exact string the group
    // doc uses for this member (members[].phone/uid and memberUIDs[] are
    // all keyed by the clean phone; activeMemberPhones()/memberPayment()
    // look payments up with those keys).
    //
    // NEVER fall back to the Firebase Auth UID here: it is a random string
    // that matches NO member key, so memberPayments["<auth-uid>"] would be
    // an orphan entry that chatUnlocked() never reads — the payment would
    // be recorded but chat would stay locked forever.
    // ============================================================
    const phoneIdentity = decoded?.phone_number
      ? String(decoded.phone_number).trim().replace(/^\+91/, "")
      : "";
    const storedKeyMatch = (Array.isArray(group?.memberUIDs) ? group.memberUIDs : [])
      .map((id: any) => String(id || "").trim())
      .find((id: string) => identities.includes(id));

    let callerKey = "";
    if (typeof callerMember === "string") {
      // Legacy string-member groups: the member IS the phone key.
      callerKey = callerMember;
    } else if (callerMember) {
      callerKey = String(callerMember?.phone || callerMember?.uid || "").trim();
    }
    callerKey = callerKey || storedKeyMatch || phoneIdentity || "";

    console.log(
      `[verify-razorpay-payment] payment=${razorpay_payment_id} group=${groupId} ` +
        `pairingId=${pairingId} callerKey=${callerKey} identities=${identities.join(",")}`
    );

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
    // chatUnlocked() reads ONLY memberPayments (never members[].paid),
    // so the memberPayments entry is the actual chat-unlock entitlement.
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
    } else {
      console.error(
        `[verify-razorpay-payment] Could not resolve callerKey for identities=${identities.join(",")} — ` +
          `payment ${razorpay_payment_id} recorded in /payments but the group entitlement was NOT updated. ` +
          `Check the group's members/memberUIDs keying for group=${groupId}.`
      );
    }

    // Re-read the group AFTER the entitlement write so the response reflects
    // the committed state (no client-side race: the frontend redirects based
    // on THIS server-computed value, not on a possibly-stale snapshot).
    const afterSnap = await groupRef.get();
    const groupAfter = afterSnap.exists ? afterSnap.data() : group;
    const unlockedNow = chatUnlocked(groupAfter);

    // A fully-paid pair must always have a chat doc (older groups may lack
    // one — otherwise /api/verify-chat-access would 404 "Chat not available
    // yet" even with both payments verified).
    if (unlockedNow) {
      await ensureChatDoc(groupId, groupAfter);
    }

    console.log(
      `[verify-razorpay-payment] payment=${razorpay_payment_id} verified. ` +
        `chatUnlocked=${unlockedNow} for group=${groupId} pairingId=${pairingId}`
    );

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      // Server-computed unlock state AFTER the entitlement write — the
      // frontend uses this to decide between "go to chat" and
      // "waiting for partner's payment" (prevents premature redirects).
      chatUnlocked: unlockedNow,
      callerKey,
    });
  } catch (error) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}