// Server-side executor for FIFO re-matching after payment verification.
// Called from /api/verify-razorpay-payment and /api/razorpay-webhook AFTER the
// member's payment entitlement has been confirmed server-side (never from the
// frontend). Pure decision logic lives in app/lib/rematching.ts.
//
// Idempotency: on a duplicate callback/verification the payer is no longer an
// active paid member of their (old) group — buildRematchPlan returns null and
// the transaction is skipped, so no duplicate pairing can ever be created.

import { adminDb, adminTimestamp } from "@/firebase/admin";
import {
  activeMemberPhones,
  chatUnlocked,
  resolveRequired,
} from "@/app/lib/groupMatching";
import { buildRematchPlan } from "@/app/lib/rematching";
import { buildMemberIdentitySet } from "@/app/lib/chatIdentity";

export type RematchResult = {
  rematched: boolean;
  newGroupId?: string;
  newPairingId?: string;
  reason?: string;
};

export async function maybeRematchAfterPayment(
  groupId: string,
  payerKey: string
): Promise<RematchResult> {
  try {
    if (!groupId || !payerKey) return { rematched: false, reason: "missing-ids" };

    const groupsRef = adminDb.collection("groups");
    const myRef = groupsRef.doc(groupId);
    const mySnap = await myRef.get();
    if (!mySnap.exists) return { rematched: false, reason: "group-missing" };
    const myGroup = mySnap.data();

    // Only 2-member pairings re-match; complete pairings are never touched.
    const required = resolveRequired(myGroup, String(myGroup?.option || ""));
    if (required !== 2) return { rematched: false, reason: "not-a-pairing" };
    if (chatUnlocked(myGroup)) return { rematched: false, reason: "already-complete" };

    // Candidate pool: same category + option (identical query shape to
    // /api/join-group — index-safe, no composite index required).
    const candSnap = await groupsRef
      .where("category", "==", myGroup?.category)
      .where("option", "==", myGroup?.option)
      .limit(100)
      .get();

    const plan = buildRematchPlan(
      myGroup,
      payerKey,
      candSnap.docs.map((d) => ({ id: d.id, data: () => d.data() })),
      adminTimestamp(),
      groupId
    );
    if (!plan) return { rematched: false, reason: "no-eligible-paid-candidate" };

    const candRef = groupsRef.doc(plan.swap.groupId);
    const newRef = groupsRef.doc();

    await adminDb.runTransaction(async (tx) => {
      // Re-read BOTH groups inside the transaction — membership may have
      // changed between the pre-check and now (race safety).
      const [myNow, candNow] = await Promise.all([tx.get(myRef), tx.get(candRef)]);
      if (!myNow.exists || !candNow.exists) throw new Error("rematch-race-group-missing");

      const freshPlan = buildRematchPlan(
        myNow.data(),
        payerKey,
        [
          { id: myNow.id, data: () => myNow.data() },
          { id: candNow.id, data: () => candNow.data() },
        ],
        adminTimestamp(),
        myNow.id
      );
      if (!freshPlan || freshPlan.swap.groupId !== candNow.id) {
        throw new Error("rematch-race-no-plan");
      }

      tx.update(myRef, { ...freshPlan.myUpdates, updatedAt: adminTimestamp() });
      tx.update(candRef, { ...freshPlan.partnerUpdates, updatedAt: adminTimestamp() });
      tx.set(newRef, {
        ...freshPlan.newGroupData,
        createdBy: payerKey,
        createdAt: adminTimestamp(),
        updatedAt: adminTimestamp(),
        lastActivityAt: adminTimestamp(),
      });
    });

    // Guarantee the chat doc exists for the new fully-paid pairing so
    // /api/verify-chat-access cannot 404 for either member (idempotent).
    await ensureChatForGroup(newRef.id, plan.newMemberKeys, plan.newGroupData.members);

    console.log(
      `[rematch] group=${groupId} payer=${payerKey} → new pairing ${newRef.id} ` +
        `(pairingId=${plan.newPairingId}) with ${plan.swap.memberKey} from ${plan.swap.groupId}`
    );

    return { rematched: true, newGroupId: newRef.id, newPairingId: plan.newPairingId };
  } catch (error: any) {
    // Rematching is an ENHANCEMENT — a failure here must never fail the
    // payment verification itself (the entitlement is already committed).
    console.error(`[rematch] failed for group=${groupId} payer=${payerKey}:`, error?.message || error);
    return { rematched: false, reason: "error" };
  }
}

/** Idempotent chat-doc creation for a fully-paid rematch pairing.
 *  memberUIDs is written as the FULL rule-accepted identity set (all phone
 *  forms + real Firebase Auth UIDs) so both members pass the Firestore
 *  rules on the very first open — no permission-denied on fresh pairings. */
async function ensureChatForGroup(groupId: string, memberKeys: string[], members: any[]) {
  try {
    const desired = await buildMemberIdentitySet(
      memberKeys.map((k) => ({ phone: k }))
    );
    const existing = await adminDb
      .collection("chats")
      .where("groupId", "==", groupId)
      .limit(1)
      .get();
    if (!existing.empty) {
      // Union-only heal (never removes identities).
      const current = Array.isArray(existing.docs[0].data()?.memberUIDs)
        ? existing.docs[0].data().memberUIDs.map((u: any) => String(u).trim())
        : [];
      const missing = desired.filter((id) => !current.includes(id));
      if (missing.length > 0) {
        await existing.docs[0].ref.update({
          members: members || [],
          memberUIDs: [...current, ...missing],
          updatedAt: adminTimestamp(),
        });
      }
      return;
    }
    await adminDb.collection("chats").add({
      groupId,
      createdAt: adminTimestamp(),
      members: members || [],
      memberUIDs: desired,
      lastMessage: "",
      lastMessageAt: adminTimestamp(),
      unreadCounts: {},
      isActive: true,
    });
  } catch (e: any) {
    console.error(`[rematch] chat-doc creation failed for ${groupId}:`, e?.message || e);
  }
}

/** Convenience for webhook/verify call-sites: only rematch while the pair is
 * still incomplete (never after the second payment completes the pairing). */
export function shouldAttemptRematch(group: any): boolean {
  if (!group) return false;
  if (resolveRequired(group, String(group?.option || "")) !== 2) return false;
  return !chatUnlocked(group);
}

/** Active member keys of a group (re-exported for call-sites). */
export { activeMemberPhones };
