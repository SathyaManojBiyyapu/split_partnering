// Pure FIFO re-matching logic: after a payment is verified, a PAID member
// stuck in a not-fully-paid pairing is paired with the earliest FIFO
// compatible PAID member of another incomplete pairing.
//
// This module is intentionally free of firebase/next imports so it can be
// unit-tested directly (scripts/verify-rematch.mjs).
//
// Business rule (matching criteria are UNCHANGED — same category, option,
// location, gym/collaborator; only PAID pairing completion is reordered):
//   1 + 2 match → 1 pays, 2 doesn't → 3 arrives & pays
//   → 1 + 3 become the ACTIVE PAID pairing (new pairingId/group)
//   → 2 stays available and later FIFO-matches with 4 (PENDING pairing).

import {
  activeMemberPhones,
  chatUnlocked,
  getPairingId,
  isPaidForPairing,
  matchesGroupKey,
  matchesLocation,
  memberList,
  norm,
  resolveRequired,
} from "./groupMatching.ts";

/** Firestore-Timestamp/Date/number → epoch ms (0 when unknown). */
export function tsToMs(ts: any): number {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  if (typeof ts?._seconds === "number") return ts._seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

/** True when this member key is an ACTIVE member paid for the CURRENT pairing. */
export function isActivelyPaid(group: any, key: string): boolean {
  return activeMemberPhones(group).includes(key) && isPaidForPairing(group, key);
}

/* ============================================================
   SERVER-DERIVED PARTNERSHIP STATUS (admin + dashboard source of truth)
   SUCCESS = fully matched AND every required member paid for the
             CURRENT pairing → chat unlocked
   PENDING = fully matched, not everyone paid
   WAITING = still looking for partners (1/2)
   ============================================================ */

export type PairingStatus = "SUCCESS" | "PENDING" | "WAITING";

export function derivePairingStatus(group: any): PairingStatus {
  const required = resolveRequired(group, String(group?.option || ""));
  const active = activeMemberPhones(group);
  if (active.length < required) return "WAITING";
  const allPaid = active.every((k) => isPaidForPairing(group, k));
  return allPaid ? "SUCCESS" : "PENDING";
}

export function memberPaidStatus(group: any, key: string): "PAID" | "PENDING" {
  return isPaidForPairing(group, key) ? "PAID" : "PENDING";
}

/** *****123 — never expose the full phone/identity key. */
export function maskPhoneKey(key: string): string {
  const digits = String(key).replace(/\D/g, "");
  return digits.length >= 4 ? `*****${digits.slice(-3)}` : `*****${String(key).slice(-2)}`;
}

/** Masked per-member paid/pending rows for the admin UI (server-derived, no PII). */
export function memberPaymentRows(group: any): Array<{ masked: string; status: "PAID" | "PENDING" }> {
  return activeMemberPhones(group).map((k) => ({
    masked: maskPhoneKey(k),
    status: memberPaidStatus(group, k),
  }));
}

/* ============================================================
   FIFO CANDIDATE SELECTION
   ============================================================ */

export type RematchCandidate<T extends { id: string }> = {
  doc: T;
  memberKey: string;
  paidAtMs: number;
};

/**
 * The earliest (FIFO) compatible group containing a PAID member whose pairing
 * is still incomplete. Ordered by the member's paidAt (when they became paid),
 * falling back to the group's createdAt — never frontend array order.
 *
 * Only 2-member pairings re-match (the ₹29 activation is a 1:1 pairing);
 * larger groups keep the existing behavior untouched.
 */
export function findRematchCandidate<T extends { id: string; data(): any }>(
  myGroup: any,
  myKey: string,
  docs: T[],
  excludeGroupId?: string
): RematchCandidate<T> | null {
  const required = resolveRequired(myGroup, String(myGroup?.option || ""));
  if (required !== 2) return null;
  if (!isActivelyPaid(myGroup, myKey)) return null;
  if (chatUnlocked(myGroup)) return null; // my pairing already complete — nothing to do

  let best: RematchCandidate<T> | null = null;
  let bestKey = Number.MAX_SAFE_INTEGER;

  for (const d of docs) {
    if (excludeGroupId && d.id === excludeGroupId) continue;
    const g = d.data();
    if (!g) continue;
    // ---- EXACT matching criteria (identical to the base flow) ----
    if (norm(g?.category) !== norm(myGroup?.category)) continue;
    if (norm(g?.option) !== norm(myGroup?.option)) continue;
    if (!matchesLocation(g, myGroup?.state || "", myGroup?.district || "", myGroup?.city || "")) continue;
    if (!matchesGroupKey(g, String(myGroup?.collaboratorId || ""))) continue;
    if (resolveRequired(g, String(g?.option || "")) !== 2) continue;
    if (chatUnlocked(g)) continue; // never break up a COMPLETE pairing
    if (g?.pairingId && getPairingId(g) === getPairingId(myGroup)) continue; // distinct pairings only

    // The candidate group must contain a PAID member whose pairing is incomplete.
    const candKeys = activeMemberPhones(g).filter((k) => isActivelyPaid(g, k));
    for (const k of candKeys) {
      const pay = g?.memberPayments?.[k] || {};
      // FIFO: when this member became paid; fallback to the group's age.
      const key = tsToMs(pay.paidAt) || tsToMs(g?.createdAt);
      // Deterministic tie-break: earlier paidAt, then lexicographically smaller doc id.
      if (key < bestKey || (key === bestKey && best && d.id < best.doc.id)) {
        bestKey = key;
        best = { doc: d, memberKey: k, paidAtMs: key };
      }
    }
  }
  return best;
}

/* ============================================================
   REMATCH PLAN — executed server-side inside a Firestore
   transaction by the caller (serverRematching.ts).
   ============================================================ */

/** Update payload shape for a rematch (all Firestore-native values). */
export type RematchPlan = {
  /** The compatible paid member we will pair with. */
  swap: { groupId: string; memberKey: string; paidAtMs: number };
  /** Updates for MY old group: I leave; the unpaid partner stays FIFO-available. */
  myUpdates: Record<string, any>;
  /** Updates for the PARTNER's old group: THEY leave; their unpaid partner stays. */
  partnerUpdates: Record<string, any>;
  /** Data for the NEW group doc (old shape + both paid members + fresh pairingId). */
  newGroupData: Record<string, any>;
  /** Keys of the two members of the new pairing ([mine, theirs]). */
  newMemberKeys: [string, string];
  /** Fresh pairingId stamped on the new group + both entitlements. */
  newPairingId: string;
};

/**
 * Build the full rematch plan for a just-paid member:
 *  - MY old group:    I leave; the unpaid partner remains (FIFO-matchable).
 *  - THEIR old group: they leave; their unpaid partner remains.
 *  - NEW group doc:   both paid members, FRESH pairingId (old entitlements can
 *                     never unlock the new pairing), SUCCESS state.
 * Pure function — the caller performs the Firestore transaction.
 */
export function buildRematchPlan(
  myGroup: any,
  myKey: string,
  docs: { id: string; data(): any }[],
  paidAt: any,
  myGroupId?: string
): RematchPlan | null {
  // NEVER consider my own group as the candidate pool (would pair me with myself).
  const cand = findRematchCandidate(myGroup, myKey, docs, myGroupId);
  if (!cand) return null;

  const candGroup = cand.doc.data();
  const myPayments = { ...(myGroup?.memberPayments || {}) };
  const theirPayments = { ...(candGroup?.memberPayments || {}) };

  // Entitlements MOVE to the new pairing (fresh pairingId stamped below).
  const myEntitlement = {
    ...(myPayments[myKey] || {}),
    paid: true,
    paidAt: myPayments[myKey]?.paidAt || paidAt,
  };
  delete myPayments[myKey];
  // NOTE: the unpaid partner REMAINS in my old group (they stay FIFO-matchable
  // for the next compatible user). Only the payer is released.

  const theirEntitlement = {
    ...(theirPayments[cand.memberKey] || {}),
    paid: true,
    paidAt:
      theirPayments[cand.memberKey]?.paidAt ||
      (cand.paidAtMs ? { seconds: Math.floor(cand.paidAtMs / 1000), nanoseconds: 0 } : paidAt),
  };
  delete theirPayments[cand.memberKey];

  const newPairingId = `pair_rematch_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const leaveOf = (group: any, key: string) =>
    memberList(group).filter((m: any) => {
      const p = typeof m === "string" ? m : m?.phone || m?.uid || "";
      return String(p).trim() !== key;
    });

  // A vacated group must RE-ENTER the FIFO matching pool: open status +
  // authoritative membersCount, so pickOldestOpen can refill it with the
  // next compatible user (e.g. User 4 joining User 2's vacated slot).
  const vacatedUpdates = (group: any, key: string) => {
    const remaining = leaveOf(group, key);
    const required = resolveRequired(group, String(group?.option || ""));
    const count = remaining.length;
    return {
      members: remaining,
      memberPayments: (() => {
        const pays = { ...(group?.memberPayments || {}) };
        delete pays[key];
        return pays;
      })(),
      membersCount: count,
      status: count === 0 ? "closed" : count >= required ? "ready" : "waiting",
    };
  };

  const myUpdates = vacatedUpdates(myGroup, myKey);
  const partnerUpdates = vacatedUpdates(candGroup, cand.memberKey);

  // NEW group: clone the shared shape from my old group (same category/option/
  // location/collaborator — matching criteria are identical), with both paid
  // members and a FRESH pairingId (old entitlements can never unlock it).
  const newMemberKeys: [string, string] = [myKey, cand.memberKey];
  const newGroupData: Record<string, any> = {
    category: myGroup?.category ?? candGroup?.category ?? "",
    option: myGroup?.option ?? candGroup?.option ?? "",
    state: myGroup?.state ?? candGroup?.state ?? "",
    district: myGroup?.district ?? candGroup?.district ?? "",
    city: myGroup?.city ?? candGroup?.city ?? "",
    collaboratorId: myGroup?.collaboratorId || candGroup?.collaboratorId || "",
    requiredSize: 2,
    membersCount: 2,
    status: "ready",
    createdAt: myGroup?.createdAt || undefined,
    // members[] entries carry NO location/contact fields (existing privacy rule).
    members: newMemberKeys.map((k) => ({ phone: k })),
    memberUIDs: newMemberKeys,
    memberPayments: {
      [myKey]: { ...myEntitlement, pairingId: newPairingId },
      [cand.memberKey]: { ...theirEntitlement, pairingId: newPairingId },
    },
    pairingId: newPairingId,
    rematch: {
      fromGroups: [String(myGroupId || ""), String(cand.doc.id || "")],
      at: paidAt || undefined,
    },
  };

  return {
    swap: { groupId: cand.doc.id, memberKey: cand.memberKey, paidAtMs: cand.paidAtMs },
    myUpdates,
    partnerUpdates,
    newGroupData,
    newMemberKeys,
    newPairingId,
  };
}
