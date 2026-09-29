export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import admin, { adminCredentialsConfigured } from "@/firebase/admin";
import {
  isMember as isGroupMember,
  isOpen,
  matchesGroupKey,
  matchesLocation,
  isPaidForPairing,
  chatUnlocked,
} from "@/app/lib/groupMatching";
import { isGroupExpired } from "@/app/data/matchExpiry";

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
    const {
      groupId,
      mode,
      category,
      option,
      collaboratorId,
      collaboratorName,
      requiredSize,
      budget,
      dateTime,
      description,
      notes,
    } = body || {};

    /* PAYMENT-FIRST MARKETPLACE ENTRY (Requirement 2):
       mode="entry" — the caller is paying to ENTER the paid matching/waiting
       queue for (location + category + option + gym). There is no groupId yet:
       the queue group is resolved/created server-side AFTER payment
       verification, so a payment can never fabricate a membership. */
    const isEntryMode = String(mode || "") === "entry" || (!groupId && !!category && !!option);

    if (!groupId && !isEntryMode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Identity is derived from the VERIFIED Firebase ID token — never trust a
    // client-supplied uid (prevents one user paying for/acting as another).
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

    // Admin SDK handle — shared by the entry-mode checks and the legacy
    // group-membership verification below.
    const { adminDb } = await import("@/firebase/admin");

    /* =========================
       ENTRY MODE — validate the marketplace queue entry BEFORE taking money:
       1. the profile location (State/District/City) must be complete — it is
          the authoritative marketplace/matching location;
       2. duplicate-payment guard — a caller who ALREADY has a live PAID
          waiting/matched entry for the same key must not pay twice.
       The actual queue entry happens in /api/verify-razorpay-payment (and
       idempotently in the webhook) AFTER the payment is verified.
    ========================== */
    if (isEntryMode) {
      const entryCategory = String(category || "").trim();
      const entryOption = String(option || "").trim();
      if (!entryCategory || !entryOption) {
        return NextResponse.json({ error: "Missing category or partnership type" }, { status: 400 });
      }

      // Resolve the caller's profile (canonical phone forms, same ladder as
      // save-profile) — the users doc is the single source of truth for location.
      let profile: any = null;
      const phoneForms = [phone, uid].filter(Boolean);
      for (const form of phoneForms) {
        const snap = await adminDb.collection("users").doc(form).get().catch(() => null);
        if (snap?.exists) { profile = snap.data(); break; }
      }
      if (!profile && phone) {
        const q = await adminDb.collection("users").where("phone", "==", phone).limit(1).get();
        if (!q.empty) profile = q.docs[0].data();
      }
      const state = String(profile?.state || "").trim();
      const district = String(profile?.district || "").trim();
      const city = String(profile?.city || "").trim();
      if (!state || !district || !city) {
        return NextResponse.json(
          { error: "Complete your profile location (State, District, City) before paying." },
          { status: 400 }
        );
      }

      // Duplicate-payment guard: any LIVE open group with the same full key
      // (location + category + option + gym) where this caller is ALREADY PAID.
      const collabKey = String(collaboratorId || "").trim();
      const mineSnap = await adminDb
        .collection("groups")
        .where("memberUIDs", "array-contains", phone || uid)
        .limit(50)
        .get();
      const sameKeyEntry = mineSnap.docs
        .map((d) => ({ id: d.id, g: d.data() }))
        .filter(({ g }) => isOpen(g) && !isGroupExpired(g?.createdAt))
        .filter(({ g }) => matchesLocation(g, state, district, city))
        .filter(({ g }) => matchesGroupKey(g, collabKey))
        .find(({ g }) => isPaidForPairing(g, phone || uid));

      if (sameKeyEntry) {
        const matched = chatUnlocked(sameKeyEntry.g);
        return NextResponse.json(
          {
            error: matched
              ? "This partnership is already matched and chat is unlocked — check My Matches."
              : "You have already paid and are in the waiting queue for this partnership.",
            code: "ALREADY_IN_QUEUE",
            groupId: sameKeyEntry.id,
            matched,
          },
          { status: 409 }
        );
      }

      const order = await razorpay.orders.create({
        amount: ACTIVATION_PRICE * 100,
        currency: "INR",
        receipt: `entry_${Date.now()}`,
        notes: {
          uid: phone || uid || "",
          mode: "entry",
          category: entryCategory,
          option: entryOption,
          collaboratorId: collabKey,
          collaboratorName: String(collaboratorName || ""),
          ...(requiredSize ? { requiredSize: String(requiredSize) } : {}),
          ...(budget ? { budget: String(budget) } : {}),
          ...(dateTime ? { dateTime: String(dateTime) } : {}),
          ...(description ? { description: String(description) } : {}),
          ...(notes ? { notes: String(notes) } : {}),
          platform: "partnersync",
          amount: String(ACTIVATION_PRICE),
        },
      });

      return NextResponse.json({
        success: true,
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        mode: "entry",
      });
    }

    // Verify the user is actually a member of this group before creating an order
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

    /* =========================
       CREATE ORDER — fixed ₹29
    ========================= */

    const order = await razorpay.orders.create({
      amount: ACTIVATION_PRICE * 100,
      currency: "INR",
      receipt: `grp_${Date.now()}`,
      notes: {
        uid: phone || uid || "",
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