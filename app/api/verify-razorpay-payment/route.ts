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
import {
  maybeRematchAfterPayment,
  shouldAttemptRematch,
} from "@/app/lib/serverRematching";
import {
  resolveCallerIdentity,
  identityMatchesKey,
  tokenIdentities,
} from "@/app/lib/serverIdentity";

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
  if (!existing.empty) {
    // Chat doc exists — sync memberUIDs with current group membership.
    // This is critical: the chat doc may have been created when only one
    // member had joined (1/2), with memberUIDs containing only that member.
    // When the second user joins and both pay, memberUIDs must include both
    // members or Firestore rules will deny the second user's access.
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

/* Identity forms derived ONLY from the verified Firebase ID token. Kept as a
   thin alias of the shared serverIdentity helper (same behavior as before). */
function tokenIdentitiesLocal(decoded: any): string[] {
  return tokenIdentities(decoded);
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
    // BIND payment → order → group. The frontend supplies all three ids in
    // the body, so NONE are trusted alone: the fetched payment carries the
    // REAL order_id, and the order's notes carry the real groupId this order
    // was created for. This prevents replaying a valid (payment, signature)
    // against a DIFFERENT order or a different group the caller belongs to.
    // (This mirrors the trust model of the webhook path, which is bound by
    // Razorpay's own order notes.)
    // ============================================================
    if (!razorpay_order_id || payment.order_id !== razorpay_order_id) {
      return NextResponse.json(
        { error: "Payment/order mismatch" },
        { status: 400 }
      );
    }

    let order: any = null;
    try {
      order = await razorpay.orders.fetch(razorpay_order_id);
    } catch (error: any) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 400 }
      );
    }
    const orderGroup = String(order?.notes?.groupId || "").trim();
    if (!orderGroup || orderGroup !== groupId) {
      return NextResponse.json(
        { error: "Payment/group mismatch" },
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

    const identities = tokenIdentitiesLocal(decoded);
    // Resolve the caller's canonical phone server-side: token claim → own
    // users doc → corroborated session phone (Google-login users). Mirrors
    // verify-chat-access so both routes authorize the SAME member key.
    const caller = await resolveCallerIdentity(
      decoded,
      String(body?.uid || "")
    );

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
      return identityMatchesKey(caller, p);
    });
    const isPartOfGroup =
      !!callerMember ||
      (Array.isArray(group?.memberUIDs) ? group.memberUIDs : []).some((id: any) =>
        identityMatchesKey(caller, id)
      );

    if (!isPartOfGroup) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // NOTE: paying while WAITING (1/2) is allowed — a user may secure their
    // spot before a partner joins (this is what enables FIFO re-matching:
    // User 3 can pay before being paired). Chat is NEVER unlocked by a single
    // payment — chatUnlocked() still requires BOTH members paid for the
    // current pairing, enforced server-side in /api/verify-chat-access.
    const required = resolveRequired(group, group.option);
    if (memberCount(group) < required) {
      console.log(
        `[verify-razorpay-payment] caller is paying into a WAITING group (${memberCount(group)}/${required}) group=${groupId} — allowed; entitlement binds to the current pairing.`
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
    const phoneIdentity = caller.phone
      ? caller.phone
      : decoded?.phone_number
        ? String(decoded.phone_number).trim().replace(/^\+91/, "")
        : "";
    const storedKeyMatch = (Array.isArray(group?.memberUIDs) ? group.memberUIDs : [])
      .map((id: any) => String(id || "").trim())
      .find((id: string) => identityMatchesKey(caller, id));

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
        identities.includes(String(ddata?.phone || "")) ||
        (caller.phone &&
          (caller.phone === String(ddata?.phone || "") ||
            caller.phone === String(ddata?.uid || "")))
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
      // Idempotency guard: the pending match above only finds status=="pending"
      // docs, so a retried/duplicate callback (double POST, network retry, user
      // reload) would otherwise ADD a SECOND paid /payments doc for the SAME
      // razorpay payment id. Skip when this payment is already recorded.
      const dupSnap = await paymentsRef
        .where("razorpayPaymentId", "==", razorpay_payment_id)
        .limit(1)
        .get();
      if (dupSnap.empty) {
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
        if (identityMatchesKey(caller, p)) return { ...m, paid: true };
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

    // ============================================================
    // FIFO RE-MATCHING — triggered ONLY by server-verified payment.
    // If the payer is now paid but their pairing is STILL incomplete
    // (partner hasn't paid), pair them with the earliest FIFO compatible
    // PAID member of another incomplete pairing (e.g. 1↔3 instead of
    // 1↔2 waiting forever). Never runs for already-complete pairings;
    // idempotent on duplicate callbacks (see serverRematching.ts).
    // ============================================================
    let rematchResult: Awaited<ReturnType<typeof maybeRematchAfterPayment>> | null = null;
    if (callerKey && shouldAttemptRematch(groupAfter)) {
      rematchResult = await maybeRematchAfterPayment(groupId, callerKey);
    }

    // The response must reflect the payer's ACTIVE pairing state AFTER the
    // rematch — if they moved to a new group, its (not the old group's)
    // unlock state decides "go to chat" vs "waiting".
    let activeGroupId = groupId;
    let activeUnlocked = unlockedNow;
    if (rematchResult?.rematched && rematchResult.newGroupId) {
      activeGroupId = rematchResult.newGroupId;
      const newSnap = await adminDb.collection("groups").doc(activeGroupId).get();
      activeUnlocked = newSnap.exists ? chatUnlocked(newSnap.data()) : false;
    }

    console.log(
      `[verify-razorpay-payment] payment=${razorpay_payment_id} verified. ` +
        `chatUnlocked=${activeUnlocked} activeGroup=${activeGroupId} pairingId=${pairingId}` +
        (rematchResult?.rematched ? ` REMATCHED from ${groupId}` : "")
    );

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      // Server-computed unlock state AFTER the entitlement write (and after
      // any rematch) — the frontend uses this to decide between "go to chat"
      // and "waiting for partner's payment" (prevents premature redirects).
      chatUnlocked: activeUnlocked,
      callerKey,
      // When a rematch happened, the payer's ACTIVE pairing is now a NEW
      // group — the frontend must redirect there (never the old group).
      rematched: !!rematchResult?.rematched,
      activeGroupId,
    });
  } catch (error) {
    console.error("Razorpay verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}