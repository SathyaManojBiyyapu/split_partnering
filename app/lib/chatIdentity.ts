// Server-side chat identity helper.
//
// ROOT CAUSE THIS FIXES:
// /api/verify-chat-access authorizes the caller against the GROUP document,
// but the Firestore rules authorize the messages listener against the CHAT
// document's memberUIDs (hasAny([request.auth.uid, myPhone()])). When the
// chat doc's memberUIDs is stale (e.g. created with only the first member,
// or in a key format the rules don't accept), the server returns success
// while the listener gets permission-denied.
//
// This module derives the COMPLETE set of rule-accepted identity forms for
// each member and provides an idempotent, union-only self-heal so the two
// authorization checks agree by construction. It never removes existing
// entries (backward compatible with old chat docs) and never weakens rules.

import admin, { adminDb, adminTimestamp } from "@/firebase/admin";
import { activeMemberPhones } from "./groupMatching";

/** Every identity form a member's phone key can legally take. */
export function phoneIdentityForms(phone: string): string[] {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  // last 10 digits covers every historical key form: "9876543210",
  // "+919876543210", "919876543210", "09876543210".
  const last10 = digits.slice(-10);
  const forms = new Set<string>();
  if (raw) forms.add(raw);
  if (digits.length >= 10) {
    forms.add(last10); // rules myPhone(): phone_number token minus "+91"
    forms.add("91" + last10); // legacy "91XXXXXXXXXX" doc keys
    forms.add("+91" + last10); // token phone_number form
  }
  return [...forms];
}

/** Resolve the member's REAL Firebase Auth UID server-side (never client input). */
export async function authUidForPhone(phone: string): Promise<string | null> {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length !== 10) return null;
  try {
    const user = await admin.auth().getUserByPhoneNumber(`+91${digits}`);
    return user?.uid || null;
  } catch {
    // User may not exist under this phone (legacy accounts) — phone forms
    // still authorize phone-auth users via the rules' myPhone() check.
    return null;
  }
}

/**
 * The full rule-accepted identity set for every active member of a group:
 * all phone forms + the real Firebase Auth UID for each member.
 * Firestore rules accept exactly [request.auth.uid, myPhone()] — this set
 * covers both for every legitimate member.
 */
export async function buildMemberIdentitySet(members: any[]): Promise<string[]> {
  const phones = activeMemberPhones({ members });
  const set = new Set<string>();
  for (const p of phones) {
    for (const f of phoneIdentityForms(p)) set.add(f);
  }
  const uids = await Promise.all(phones.map((p) => authUidForPhone(p)));
  for (const u of uids) {
    if (u) set.add(u);
  }
  return [...set];
}

export type ChatIdentityResult = {
  chatId: string;
  healed: boolean;
  created: boolean;
};

/**
 * Find the chat doc for a group (by groupId), create it if missing, and
 * union-heal its memberUIDs so BOTH members pass the Firestore rules.
 * Idempotent: writes only when identities are actually missing.
 */
export async function ensureChatIdentityForGroup(
  groupId: string,
  members: any[]
): Promise<ChatIdentityResult | null> {
  const chatsRef = adminDb.collection("chats");
  const snap = await chatsRef.where("groupId", "==", groupId).limit(1).get();
  const desired = await buildMemberIdentitySet(members);

  if (snap.empty) {
    // Chat doc missing → create it server-side (idempotent by groupId lookup).
    const created = await chatsRef.add({
      groupId,
      createdAt: adminTimestamp(),
      members: members || [],
      memberUIDs: desired,
      lastMessage: "",
      lastMessageAt: adminTimestamp(),
      unreadCounts: {},
      isActive: true,
    });
    return { chatId: created.id, healed: true, created: true };
  }

  const chatDoc = snap.docs[0];
  const existing = Array.isArray(chatDoc.data()?.memberUIDs)
    ? chatDoc.data().memberUIDs.map((u: any) => String(u).trim())
    : [];
  // UNION-ONLY: add missing identities, never remove existing ones.
  const missing = desired.filter((id) => !existing.includes(id));
  if (missing.length > 0) {
    await chatDoc.ref.update({
      memberUIDs: [...existing, ...missing],
      updatedAt: adminTimestamp(),
    });
    return { chatId: chatDoc.id, healed: true, created: false };
  }
  return { chatId: chatDoc.id, healed: false, created: false };
}
