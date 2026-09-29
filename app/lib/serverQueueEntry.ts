// Server-side PAYMENT-FIRST queue entry — the single source of truth shared by
// /api/verify-razorpay-payment and /api/razorpay-webhook.
//
// Business model (Requirement 2):
//   AVAILABLE      → eligible/compatible, visible in the marketplace, NOT paid
//   PAID/WAITING   → paid, queued: "1/2 members paid — waiting for partner"
//   MATCH CONFIRMED→ required members have paid → chat unlocked, both users
//                    leave the marketplace + waiting queue
//
// A payment NEVER auto-confirms a match: it only enters (or completes) the
// payer's position in the paid waiting queue. A match is confirmed ONLY when
// the required number of compatible members have paid (chatUnlocked rule).
//
// IDEMPOTENCY (duplicate payment / webhook replay safety):
//   - Already MATCHED for the same key → no-op (payment recorded, no re-entry).
//   - Already PAID/WAITING for the same key → no-op (the existing entry wins).
//   - Legacy unpaid membership for the same key → this payment ACTIVATES it
//     (the member is marked paid for the current pairing — never re-queued).

import { adminDb, adminTimestamp } from "@/firebase/admin";
import {
  activeMemberPhones,
  chatUnlocked,
  isMember,
  isOpen,
  isPaidForPairing,
  maskPhone,
  matchesGroupKey,
  matchesLocation,
  memberList,
  pickOldestPaidWaiting,
  resolveRequired,
} from "@/app/lib/groupMatching";
import { isGroupExpired } from "@/app/data/matchExpiry";
import { resolveCallerIdentity } from "@/app/lib/serverIdentity";
import { ensureChatIdentityForGroup } from "@/app/lib/chatIdentity";

export type QueueEntryResult = {
  ok: boolean;
  error?: string;
  status?: "waiting" | "ready";
  groupId?: string;
  pairingId?: string;
  membersCount?: number;
  requiredSize?: number;
  paidCount?: number;
  chatUnlocked?: boolean;
  alreadyEntry?: boolean;
  profileLocation?: { state: string; district: string; city: string };
};

function newPairingId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return `p_${c.randomUUID()}`;
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function newQueueGroupId(): string {
  const c = (globalThis as any).crypto;
  const rand = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `paidq_${Date.now()}_${rand}`;
}

/** Open (joinable) and not expired. Expired/stale docs never join the pool. */
function isLiveOpen(g: any): boolean {
  if (!isOpen(g)) return false;
  if (isGroupExpired(g?.createdAt)) return false;
  return true;
}

/** Create/ensure the chat doc for a CONFIRMED pairing (idempotent). */
async function ensureChatForConfirmed(groupId: string, members: any[]) {
  try {
    await ensureChatIdentityForGroup(groupId, members);
  } catch (e: any) {
    console.error(`[queue-entry] chat doc creation failed for ${groupId}:`, e?.message || e);
  }
}

/** Record the marketplace-entry selection (dashboard "latest selection" parity).
 *  paid:true — in the payment-first model a selection IS a paid entry. */
async function recordPaidSelection(data: {
  phone: string; groupId: string; category: string; option: string;
  userName: string; status: string; collaboratorId: string; collaboratorName: string;
}) {
  try {
    await adminDb.collection("selections").add({
      uid: data.phone,
      phone: data.phone,
      maskedPhone: maskPhone(data.phone),
      userName: data.userName || "Anonymous",
      category: data.category,
      option: data.option,
      collaboratorId: data.collaboratorId || "",
      collaboratorName: data.collaboratorName || "",
      paid: true,
      status: data.status || "paid-waiting",
      createdAt: adminTimestamp(),
    });
  } catch (e: any) {
    console.error("[queue-entry] selection record failed:", e?.message || e);
  }
}

/** Keep the user's category/option on their profile (legacy parity). */
async function updateUserCategory(phone: string, category: string, option: string) {
  try {
    await adminDb.collection("users").doc(phone).update({
      category: String(category || "").replace(/-/g, " "),
      option,
      updatedAt: adminTimestamp(),
    });
  } catch {
    /* best-effort */
  }
}
/**
 * Enter the PAID waiting queue for a verified payment.
 * Location ALWAYS comes from the caller's OWN users doc (the authoritative,
 * freshly-saved marketplace location) — never from the payment payload.
 */
export async function enterPaidQueue(args: {
  /** VERIFIED Firebase ID-token payload — REQUIRED for the inline verify
   *  path; omit it on the webhook path (webhookPhone is used instead). */
  decoded?: any;
  claimedPhone?: string | null;
  /** Webhook path: the payer's canonical phone, taken from Razorpay order
   *  notes that OUR OWN server wrote at order-creation time from a verified
   *  token — the same trust model the legacy webhook uses for notes.uid. */
  webhookPhone?: string | null;
  category: string;
  option: string;
  collaboratorId?: string;
  collaboratorName?: string;
  requiredSize?: number;
  budget?: string;
  dateTime?: string;
  description?: string;
  notes?: string;
}): Promise<QueueEntryResult> {
  try {
    const category = String(args.category || "").trim();
    const option = String(args.option || "").trim();
    if (!category || !option) {
      return { ok: false, error: "Missing category or partnership type" };
    }

    let caller: Awaited<ReturnType<typeof resolveCallerIdentity>> | null = null;
    let phone = "";
    if (args.webhookPhone) {
      // Webhook path — identity is the Razorpay-bound order note written by
      // this server from a VERIFIED token (never client input).
      const digits = String(args.webhookPhone).replace(/\D/g, "");
      phone =
        digits.length === 12 && digits.startsWith("91") ? digits.slice(2)
        : digits.length === 11 && digits.startsWith("0") ? digits.slice(1)
        : digits;
      if (!/^[0-9]{10}$/.test(phone)) {
        // Google-login payers have a Firebase UID (not a phone) in the order
        // notes — resolve their canonical phone from their OWN users doc
        // (same trust model: the users doc is only writable by that account).
        const claimedId = String(args.webhookPhone).trim();
        try {
          const byId = await adminDb.collection("users").doc(claimedId).get();
          const resolvedPhone = String(byId.data()?.phone || "").replace(/\D/g, "").slice(-10);
          if (byId.exists && /^[0-9]{10}$/.test(resolvedPhone)) {
            phone = resolvedPhone;
          } else {
            return { ok: false, error: "Could not resolve the payer account." };
          }
        } catch {
          return { ok: false, error: "Could not resolve the payer account." };
        }
      }
    } else {
      caller = await resolveCallerIdentity(args.decoded, args.claimedPhone || null);
      if (!caller.phone) {
        return { ok: false, error: "Could not resolve your account. Please log in again." };
      }
      phone = caller.phone;
    }

    // ---- Location: the user's saved profile is the single source of truth.
    let profile: any = null;
    try {
      const snap = await adminDb.collection("users").doc(phone).get();
      profile = snap.exists ? snap.data() : null;
    } catch {
      profile = null;
    }
    if (!profile) {
      // Fallback: indexed phone field (same resolution ladder as profile save).
      const q = await adminDb.collection("users").where("phone", "==", phone).limit(1).get();
      profile = q.empty ? null : q.docs[0].data();
    }
    const state = String(profile?.state || "").trim();
    const district = String(profile?.district || "").trim();
    const city = String(profile?.city || "").trim();
    if (!state || !district || !city) {
      return { ok: false, error: "Complete your profile location (State, District, City) before paying." };
    }
    const profileLocation = { state, district, city };

    const collaboratorId = String(args.collaboratorId || "").trim();
    const collaboratorName = String(args.collaboratorName || "").trim();

    // ---- DUPLICATE-ENTRY GUARD (idempotency across verify + webhook):
    // If the caller already belongs to a LIVE open group for this EXACT key
    // (same location + category + option + gym), this payment must NOT create
    // a second queue entry. It either activates their legacy unpaid membership
    // or is a no-op for an already-paid/matched membership.
    try {
      const mineSnap = await adminDb
        .collection("groups")
        .where("memberUIDs", "array-contains", phone)
        .limit(50)
        .get();
      const existing = mineSnap.docs
        .map((d) => ({ id: d.id, g: d.data() }))
        .filter(({ g }) => isLiveOpen(g))
        .filter(({ g }) => matchesLocation(g, state, district, city))
        .filter(({ g }) => matchesGroupKey(g, collaboratorId))
        .sort((a, b) => (a.g?.createdAt?.seconds || 0) - (b.g?.createdAt?.seconds || 0));

      if (existing.length > 0) {
        const { id: exId, g: exGroup } = existing[0];
        const required = resolveRequired(exGroup, option);
        if (isPaidForPairing(exGroup, phone)) {
          // Already paid for this pairing — duplicate payment is a no-op.
          const unlocked = chatUnlocked(exGroup);
          return {
            ok: true,
            alreadyEntry: true,
            status: unlocked ? "ready" : "waiting",
            groupId: exId,
            pairingId: String(exGroup?.pairingId || ""),
            membersCount: Number(exGroup?.membersCount) || memberList(exGroup).length,
            requiredSize: required,
            paidCount: activeMemberPhones(exGroup).filter((p) => isPaidForPairing(exGroup, p)).length,
            chatUnlocked: unlocked,
            profileLocation,
          };
        }
        // Legacy UNPAID membership for this key → this payment ACTIVATES it
        // (never create a second queue entry for the same key).
        const exRef = adminDb.collection("groups").doc(exId);
        const activated = await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(exRef);
          if (!snap.exists) return null;
          const g = snap.data() as any;
          if (!isLiveOpen(g) || !isMember(g, phone)) return null;
          const pairingId = String(g?.pairingId || "");
          if (!pairingId) return null;
          const phones = activeMemberPhones(g);
          const memberPayments = {
            ...(g?.memberPayments || {}),
            [phone]: { paid: true, pairingId, paidAt: adminTimestamp(), entryPaid: true },
          };
          const members = memberList(g).map((m: any) => {
            if (typeof m === "string") return m;
            const key = String(m?.phone || m?.uid || "");
            return key === phone ? { ...m, paid: true } : m;
          });
          const allPaid = phones.every((p) => (p === phone ? true : isPaidForPairing(g, p)));
          const full = phones.length >= required;
          const nextStatus: "waiting" | "ready" = full && allPaid ? "ready" : "waiting";
          tx.update(exRef, {
            members,
            memberPayments,
            status: nextStatus,
            ...(nextStatus === "ready" ? { readyAt: adminTimestamp() } : {}),
            updatedAt: adminTimestamp(),
            lastActivityAt: adminTimestamp(),
          });
          return {
            status: nextStatus,
            membersCount: phones.length,
            paidCount: phones.filter((p) => (p === phone ? true : isPaidForPairing(g, p))).length,
          };
        });
        if (activated) {
          const unlocked = activated.status === "ready";
          if (unlocked) {
            const after = await exRef.get();
            if (after.exists) await ensureChatForConfirmed(exId, memberList(after.data()));
          }
          await recordPaidSelection({
            phone, groupId: exId, category, option,
            userName: String(profile?.name || ""), status: unlocked ? "matched" : "paid-waiting",
            collaboratorId, collaboratorName,
          });
          return {
            ok: true,
            alreadyEntry: true,
            status: activated.status,
            groupId: exId,
            membersCount: activated.membersCount,
            requiredSize: required,
            paidCount: activated.paidCount,
            chatUnlocked: unlocked,
            profileLocation,
          };
        }
        // Activation race lost → fall through to the normal queue entry below.
      }
    } catch (e: any) {
      console.error("[queue-entry] duplicate guard failed (continuing):", e?.message || e);
    }

    // ---- FIFO PAID-QUEUE ENTRY (transactional, race-safe).
    // Candidate SEARCH runs OUTSIDE the transaction (same pattern as
    // /api/join-group + serverRematching — only single-document reads happen
    // inside the tx); the chosen target is fully re-validated against FRESH
    // data inside the transaction, so a concurrent join/fill can never
    // overfill a group. `retry` re-queries fresh candidates (max 3 attempts).
    const groupsRef = adminDb.collection("groups");
    for (let attempt = 0; attempt < 3; attempt++) {
      const candSnap = await groupsRef
        .where("category", "==", category)
        .where("option", "==", option)
        .limit(100)
        .get();
      const best = pickOldestPaidWaiting(
        candSnap.docs as any,
        { state, district, city, option, phone, collaboratorId }
      );

      const outcome = await adminDb.runTransaction(async (tx) => {
        // JOIN: the oldest compatible PAID waiting group (payments preserved —
        // the group's pairingId is KEPT so existing paid members keep their
        // entitlements; the new member pays for that same pairing).
        if (best) {
          const bestRef = (best as any).ref || groupsRef.doc((best as any).id);
          const fresh: any = await tx.get(bestRef as any);
          if (!fresh.exists) return { retry: true as const };
          const g = fresh.data() as any;
          if (!isLiveOpen(g) || isMember(g, phone)) return { retry: true as const };
          const pairingId = String(g?.pairingId || "");
          if (!pairingId) return { retry: true as const };
          const required = resolveRequired(g, option);
          const phones = activeMemberPhones(g);
          if (phones.length === 0 || phones.length >= required) return { retry: true as const };
          if (!phones.every((p) => isPaidForPairing(g, p))) return { retry: true as const };

          const nextPhones = [...phones, phone];
          const nextMembers = [...memberList(g), { phone }];
          const nextPayments = {
            ...(g?.memberPayments || {}),
            [phone]: { paid: true, pairingId, paidAt: adminTimestamp(), entryPaid: true },
          };
          const nextView = { ...g, memberPayments: nextPayments, pairingId };
          const nextPaidCount = nextPhones.filter((p) => isPaidForPairing(nextView, p)).length;
          const allPaid = nextPaidCount === nextPhones.length;
          const full = nextPhones.length >= required;
          const nextStatus: "waiting" | "ready" = full && allPaid ? "ready" : "waiting";
          tx.update(bestRef, {
            members: nextMembers,
            memberUIDs: nextPhones,
            membersCount: nextPhones.length,
            memberPayments: nextPayments,
            status: nextStatus,
            ...(nextStatus === "ready" ? { readyAt: adminTimestamp() } : {}),
            updatedAt: adminTimestamp(),
            lastActivityAt: adminTimestamp(),
          });
          return {
            retry: false as const,
            result: {
              groupId: (best as any).id,
              status: nextStatus,
              membersCount: nextPhones.length,
              requiredSize: required,
              paidCount: nextPaidCount,
              pairingId,
            },
          };
        }

        // CREATE: no compatible paid waiting group → a fresh solo PAID entry.
        // (The user is PAID + WAITING: "1/required members paid".)
        const pairingId = newPairingId();
        const required = resolveRequired({ requiredSize: args.requiredSize }, option);
        const newRef = groupsRef.doc(newQueueGroupId());
        tx.set(newRef, {
          category,
          option,
          state,
          district,
          city,
          collaboratorId,
          collaboratorBrand: collaboratorName,
          requiredSize: required,
          members: [{ phone }],
          memberUIDs: [phone],
          membersCount: 1,
          status: "waiting",
          pairingId,
          memberPayments: {
            [phone]: { paid: true, pairingId, paidAt: adminTimestamp(), entryPaid: true },
          },
          paidEntry: true,
          createdBy: phone,
          createdAt: adminTimestamp(),
          updatedAt: adminTimestamp(),
          lastActivityAt: adminTimestamp(),
          ...(args.budget ? { budget: String(args.budget) } : {}),
          ...(args.dateTime ? { dateTime: String(args.dateTime) } : {}),
          ...(args.description ? { description: String(args.description) } : {}),
          ...(args.notes ? { notes: String(args.notes) } : {}),
        });
        return {
          retry: false as const,
          result: {
            groupId: newRef.id,
            status: "waiting" as const,
            membersCount: 1,
            requiredSize: required,
            paidCount: 1,
            pairingId,
          },
        };
      });

      if ((outcome as any).retry) continue;
      const r = (outcome as any).result;
      const confirmed = r.status === "ready";
      if (confirmed) {
        const after = await groupsRef.doc(r.groupId).get();
        if (after.exists) await ensureChatForConfirmed(r.groupId, memberList(after.data()));
      }
      await recordPaidSelection({
        phone, groupId: r.groupId, category, option,
        userName: String(profile?.name || ""), status: confirmed ? "matched" : "paid-waiting",
        collaboratorId, collaboratorName,
      });
      await updateUserCategory(phone, category, option);
      return {
        ok: true,
        status: r.status,
        groupId: r.groupId,
        pairingId: r.pairingId,
        membersCount: r.membersCount,
        requiredSize: r.requiredSize,
        paidCount: r.paidCount,
        chatUnlocked: confirmed,
        profileLocation,
      };
    }

    return { ok: false, error: "Could not join the matching queue after multiple attempts, please try again." };
  } catch (error: any) {
    console.error("[queue-entry] enterPaidQueue failed:", error?.code || "", error?.message || error);
    return { ok: false, error: "Queue entry failed. Please try again." };
  }
}

