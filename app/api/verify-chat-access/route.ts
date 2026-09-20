import { NextResponse } from "next/server";
import admin, { adminDb, adminCredentialsConfigured } from "@/firebase/admin";
import {
  chatUnlocked,
  activeMemberPhones,
  isPaidForPairing,
} from "@/app/lib/groupMatching";
import { ensureChatIdentityForGroup } from "@/app/lib/chatIdentity";
import {
  resolveCallerIdentity,
  identityMatchesKey,
} from "@/app/lib/serverIdentity";

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
/**
 * Find the caller's CURRENT active pairing (stale-link recovery).
 * Only groups where the VERIFIED caller is a genuine member qualify.
 * Preference order: chat-unlocked pairings first, then most recently active.
 * Returns null when the caller has no other pairing (→ original error kept).
 */
async function findActivePairingForCaller(
  caller: Awaited<ReturnType<typeof resolveCallerIdentity>>,
  requestedGroupId: string
): Promise<{ groupId: string } | null> {
  if (!caller?.phone) return null;
  try {
    const snap = await adminDb
      .collection("groups")
      .where("memberUIDs", "array-contains", caller.phone)
      .limit(20)
      .get();
    const candidates = snap.docs
      .filter((d) => d.id !== requestedGroupId)
      .map((d) => ({ id: d.id, g: d.data() }))
      .filter(({ g }) => {
        const members = Array.isArray(g?.members) ? g.members : [];
        const uids = Array.isArray(g?.memberUIDs) ? g.memberUIDs : [];
        return (
          members.some(
            (m: any) =>
              identityMatchesKey(caller, m?.phone) ||
              identityMatchesKey(caller, m?.uid)
          ) || uids.some((id: any) => identityMatchesKey(caller, id))
        );
      });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const ua = chatUnlocked(a.g) ? 1 : 0;
      const ub = chatUnlocked(b.g) ? 1 : 0;
      if (ua !== ub) return ub - ua; // unlocked pairing wins
      const ta = a.g?.updatedAt?.toMillis?.() || 0;
      const tb = b.g?.updatedAt?.toMillis?.() || 0;
      return tb - ta; // most recently active wins
    });
    return { groupId: candidates[0].id };
  } catch (err: any) {
    console.error(
      "[verify-chat-access] stale-link recovery lookup failed:",
      err?.message || err
    );
    return null;
  }
}

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

    const body = await req.json().catch(() => ({}));
    const { groupId, phone: claimedPhone } = body;

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

    let caller: Awaited<ReturnType<typeof resolveCallerIdentity>>;
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      // Resolves the canonical phone for phone-OTP users from the token claim,
      // and for Google-login users from their own users doc / corroborated
      // session phone (see serverIdentity.ts — the "paid but not a member"
      // 403 root cause). Token problems → 401; infra failures → 500 below.
      caller = await resolveCallerIdentity(decoded, claimedPhone);
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
      // STALE-LINK RECOVERY: the URL's groupId no longer exists (a rematch
      // moved this caller into a NEW pairing, the old group was emptied, or
      // the browser tab/bookmark is outdated). Instead of a dead-end error,
      // send the caller to their CURRENT active pairing — same chat page,
      // same UX, correct URL. Only ever redirects to a group the VERIFIED
      // caller is genuinely a member of.
      const redirect = await findActivePairingForCaller(caller, groupId);
      if (redirect) {
        return NextResponse.json({
          success: false,
          code: "STALE_GROUP_REDIRECT",
          redirectGroupId: redirect.groupId,
          error: "Your pairing has moved to a new group chat.",
        });
      }
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    const group = groupSnap.data();
    const members = group?.members || [];
    const memberUIDs = group?.memberUIDs || [];
    const isMember =
      members.some(
        (m: any) =>
          identityMatchesKey(caller, m?.phone) ||
          identityMatchesKey(caller, m?.uid)
      ) || memberUIDs.some((id: any) => identityMatchesKey(caller, id));

    if (!isMember) {
      // Same stale-link recovery when the group exists but THIS caller was
      // replaced/moved out (e.g. their payment triggered a FIFO rematch into
      // a new pairing) — never leak another member's chat: the redirect target
      // is re-authorized against the caller's verified identity below.
      const redirect = await findActivePairingForCaller(caller, groupId);
      if (redirect) {
        return NextResponse.json({
          success: false,
          code: "STALE_GROUP_REDIRECT",
          redirectGroupId: redirect.groupId,
          error: "Your pairing has moved to a new group chat.",
        });
      }
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
      // Distinguish "you haven't paid" from "waiting for the partner" so the
      // UI can show the correct state — a member who HAS paid must never see
      // a "Complete Payment" button (double-payment trap).
      const phones = activeMemberPhones(group);
      const callerKey =
        phones.find((p) => identityMatchesKey(caller, p)) ||
        (Array.isArray(group?.memberUIDs) ? group.memberUIDs : [])
          .map((id: any) => String(id || "").trim())
          .find((id: string) => identityMatchesKey(caller, id)) ||
        caller.phone ||
        "";
      const callerPaid = callerKey ? isPaidForPairing(group, callerKey) : false;
      const othersAllPaid = callerKey
        ? phones.filter((p) => p !== callerKey).every((p) => isPaidForPairing(group, p))
        : false;

      return NextResponse.json(
        {
          error:
            callerPaid && !othersAllPaid
              ? "Your payment was verified successfully. Waiting for your partner's payment — the chat unlocks automatically once everyone in this pairing has paid."
              : "Chat is locked. Your match must be complete (2/2) AND both members must have paid.",
          code: "CHAT_LOCKED",
          callerPaid,
          othersAllPaid,
          chatUnlocked: false,
        },
        { status: 403 }
      );
    }

    // 3. Guarantee the chat doc exists AND its memberUIDs pass the Firestore
    //    rules for BOTH members. The rules authorize the messages listener
    //    against the CHAT doc (hasAny([request.auth.uid, myPhone()])), not the
    //    group doc — a stale chat doc here is exactly what produces
    //    "server says unlocked, listener gets permission-denied". Self-heal is
    //    idempotent and union-only (never removes identities, never weakens rules).
    const memberPhones = activeMemberPhones(group);
    let chatId: string;
    try {
      const result = await ensureChatIdentityForGroup(groupId, members);
      if (!result) throw new Error("chat identity resolution returned null");
      chatId = result.chatId;
      if (result.healed || result.created) {
        console.log(
          `[verify-chat-access] chat doc ${result.created ? "created" : "healed"} for group=${groupId} ` +
            `(members=${memberPhones.length})`
        );
      }
    } catch (healErr: any) {
      // Fall back to the pre-existing lookup so access isn't blocked by a
      // transient heal failure — but surface it in logs.
      console.error(
        `[verify-chat-access] chat identity heal failed for group=${groupId}:`,
        healErr?.message || healErr
      );
      const fallback = await adminDb
        .collection("chats")
        .where("groupId", "==", groupId)
        .limit(1)
        .get();
      if (fallback.empty) {
        return NextResponse.json(
          { error: "Chat not available yet" },
          { status: 404 }
        );
      }
      chatId = fallback.docs[0].id;
    }

    // Return the chat ID + member info (masked, no phone numbers/UIDs).
    // Masked from the GROUP's active member phones — one identity per member,
    // deduped, and never exposing Firebase UIDs or raw document data.
    const seen = new Set<string>();
    const maskedMembers = memberPhones
      .map((p: string) => `PS-${p.replace(/\D/g, "").slice(-5)}`)
      .filter((m: string) => (seen.has(m) ? false : (seen.add(m), true)))
      .map((userId: string) => ({ userId }));

    return NextResponse.json({
      success: true,
      chatId,
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