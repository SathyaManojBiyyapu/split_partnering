import { NextResponse } from "next/server";
import admin, { adminDb, adminCredentialsConfigured } from "@/firebase/admin";
import { chatUnlocked } from "@/app/lib/groupMatching";

/**
 * SERVER-SIDE chat access verification.
 * Chat is unlocked ONLY when:
 * 1. The caller is AUTHENTICATED (Firebase ID token) and is a member of the group
 * 2. The group is COMPLETE (e.g. 2/2 active members)
 * 3. EVERY active member has PAID for the CURRENT pairing (pairingId matches —
 *    a replaced partner resets payments, so old payment state never unlocks)
 *
 * The caller's identity is resolved from their verified ID token — NEVER from
 * a client-supplied uid (which could be spoofed to access another member's
 * chat). The frontend alone can never unlock chat — this endpoint is the
 * source of truth.
 */
export async function POST(req: Request) {
  try {
    // Fail fast with an actionable error when the server has no admin
    // credentials (e.g. FIREBASE_SERVICE_ACCOUNT_KEY missing on Vercel) —
    // otherwise every adminDb call throws and surfaces as an opaque 500.
    if (!adminCredentialsConfigured) {
      console.error(
        "VERIFY-CHAT-ACCESS ERROR: Firebase admin credentials are not " +
          "configured. Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line " +
          "service-account JSON) in the deployment environment."
      );
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing. Chat verification is temporarily unavailable." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { groupId } = body;

    if (!groupId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    /* --- Authenticate the caller via their Firebase ID token --- */
    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let identities: string[] = [];
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      identities = [decoded.uid || ""];
      if (decoded.phone_number) {
        const raw = decoded.phone_number.trim();
        // Cover every historical identity format: +91-prefixed, 10-digit, raw
        identities.push(raw, raw.replace(/^\+91/, ""));
      }
      identities = [...new Set(identities.filter(Boolean))];
    } catch (error: any) {
      // Only genuine token problems → 401; infra/credential failures must
      // surface with their real cause (see the 500 handler below).
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }

    // 1. Check group exists and the AUTHENTICATED caller is a member
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
    const isMember =
      members.some((m: any) => identities.includes(m?.phone) || identities.includes(m?.uid)) ||
      identities.some((id) => memberUIDs.includes(id));

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // 2. Chat unlocks ONLY when the group is COMPLETE and EVERY active member
    //    paid for the CURRENT pairing (both/observed members — never just the
    //    caller). A replaced partner creates a new pairingId, so the old
    //    member's payment can never unlock the new pairing.
    if (!chatUnlocked(group)) {
      return NextResponse.json(
        {
          error:
            "Chat is locked. Your match must be complete (2/2) AND both members must have paid.",
          code: "CHAT_LOCKED",
        },
        { status: 403 }
      );
    }

    // 3. Check chat exists for this group
    const chatsRef = adminDb.collection("chats");
    const chatSnap = await chatsRef
      .where("groupId", "==", groupId)
      .limit(1)
      .get();

    if (chatSnap.empty) {
      return NextResponse.json(
        { error: "Chat not available yet" },
        { status: 404 }
      );
    }

    // Return the chat ID + member info (masked, no phone numbers)
    const chatDoc = chatSnap.docs[0];
    const chatData = chatDoc.data();

    const memberPhones = Array.isArray(chatData?.memberUIDs) ? chatData.memberUIDs : [];
    const maskedMembers = memberPhones.map((p: string) => ({
      userId: `PS-${p.replace(/\D/g, "").slice(-5)}`,
    }));

    return NextResponse.json({
      success: true,
      chatId: chatDoc.id,
      groupId,
      category: group?.category || "",
      option: group?.option || "",
      collaboratorBrand: group?.collaboratorBrand || "",
      members: maskedMembers,
    });
  } catch (error) {
    console.error("Chat access verification error:", error);
    return NextResponse.json(
      { error: "Chat access verification failed" },
      { status: 500 }
    );
  }
}