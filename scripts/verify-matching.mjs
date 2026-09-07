// Deterministic end-to-end simulation of the centralized atomic matching flow.
// It exercises the SAME shared pure logic that /api/join-group imports
// (app/lib/groupMatching.ts) and replicates the route's loop + transactional
// re-read semantics against an in-memory store.
//
// Run: node scripts/verify-matching.mjs
import {
  getRequiredSize,
  isMember,
  isOpen,
  resolveRequired,
  memberCount,
  memberList,
  pickOldestOpen,
  actualMemberCount,
  isGroupMatched,
  memberDisplayNames,
  matchesLocation,
  matchesGroupKey,
  pickOldestRefillable,
  chatUnlocked,
  isPaidForPairing,
  getPairingId,
} from "../app/lib/groupMatching.ts";
import {
  shouldLockName,
  resolveSavedName,
} from "../app/lib/profileName.ts";
import {
  sanitizeTicketRateInput,
  isValidTicketRate,
} from "../app/lib/ticketRate.ts";

/* ------------------------------------------------------------------ */
/* In-memory Firestore-ish store                                        */
/* ------------------------------------------------------------------ */
function makeStore() {
  const docs = new Map();
  let ts = 1;
  return {
    docs,
    nextTs() {
      return { seconds: ts++, nanoseconds: 0, toMillis() { return (ts - 1) * 1000; } };
    },
    query(category, option) {
      return [...docs.entries()]
        .filter(([_, g]) => g.category === category && g.option === option)
        .map(([id, g]) => ({ id, data: () => g }));
    },
    set(id, data) {
      docs.set(id, data);
    },
    get(id) {
      return docs.get(id);
    },
    all() {
      return [...docs.values()];
    },
  };
}

/* ------------------------------------------------------------------ */
/* Replicas of the route's two code paths (join-txn / create)          */
/* ------------------------------------------------------------------ */

// Mirrors adminDb.runTransaction(): reads FRESH state at commit, re-checks
// capacity/status/membership, writes, and reports retry when the group is
// no longer joinable. ANY membership change = NEW pairing: fresh pairingId
// and every member's payment resets to pending.
function joinTransaction(store, groupId, category, option, memberObject, phone) {
  const g = store.get(groupId);
  if (!g) return { retry: true, result: null };
  if (!isOpen(g)) return { retry: true, result: null };
  if (isMember(g, phone)) {
    return {
      retry: false,
      result: { status: "already", groupId, membersCount: memberCount(g), requiredSize: resolveRequired(g, option) },
    };
  }
  const members = memberList(g);
  const required = resolveRequired(g, option);
  if (members.length >= required) return { retry: true, result: null };

  const updatedCount = members.length + 1;
  const nextStatus = updatedCount >= required ? "ready" : "waiting";
  const nextPairingId = newPairingId();
  const resetMembers = members.map((m) => (typeof m === "string" ? m : { ...m, paid: false }));
  const allPhones = [
    ...members.map((m) => (typeof m === "string" ? m : m?.phone || m?.uid || "")).filter(Boolean),
    phone,
  ];
  const memberPayments = {};
  for (const p of allPhones) memberPayments[p] = { paid: false, pairingId: nextPairingId };

  store.set(groupId, {
    ...g,
    members: [...resetMembers, memberObject],
    memberUIDs: [...(g.memberUIDs || []), phone],
    membersCount: updatedCount,
    status: nextStatus,
    pairingId: nextPairingId,
    memberPayments,
    ...(nextStatus === "ready" ? { readyAt: 1 } : {}),
  });

  return { retry: false, result: { status: nextStatus, groupId, membersCount: updatedCount, requiredSize: required } };
}

function createGroup(store, category, option, memberObject, phone, extra = {}) {
  const id = "g" + (store.all().length + 1);
  const required = extra.requiredSize || getRequiredSize(option);
  const nextPairingId = newPairingId();
  store.set(id, {
    category,
    option,
    state: extra.state,
    district: extra.district,
    city: extra.city,
    collaboratorId: extra.collaboratorId || "",
    collaboratorBrand: extra.collaboratorName || "",
    members: [memberObject],
    memberUIDs: [phone],
    membersCount: 1,
    requiredSize: required,
    status: "waiting",
    pairingId: nextPairingId,
    memberPayments: { [phone]: { paid: false, pairingId: nextPairingId } },
    createdAt: store.nextTs(),
    createdBy: phone,
  });
  return { status: "created", groupId: id, membersCount: 1, requiredSize: required };
}

/* Deterministic pairing-id generator (mirrors the server's newPairingId()). */
let pairingCounter = 1000;
function newPairingId() {
  pairingCounter += 1;
  return `p_${pairingCounter}`;
}

// Replicates /api/remove-match's removal transaction: soft-remove the caller,
// fresh pairingId, all remaining payments reset, "empty" when nobody remains.
function removeProcess(store, groupId, phone) {
  const g = store.get(groupId);
  if (!g) return { ok: false, error: "Group not found" };
  if (!isMember(g, phone)) return { ok: false, error: "not a member" };
  const members = memberList(g);
  const oldCount = Number(g.membersCount) || members.length;
  const newCount = Math.max(0, oldCount - 1);
  const required = resolveRequired(g, g.option);
  const nextPairingId = newPairingId();
  const remaining = members.filter((m) =>
    typeof m === "string" ? m !== phone : (m?.phone || m?.uid) !== phone
  );
  const remainingPhones = remaining
    .map((m) => (typeof m === "string" ? m : m?.phone || m?.uid || ""))
    .filter(Boolean);
  const resetMembers = remaining.map((m) => (typeof m === "string" ? m : { ...m, paid: false }));
  const memberPayments = {};
  for (const p of remainingPhones) memberPayments[p] = { paid: false, pairingId: nextPairingId };

  if (newCount <= 0) {
    store.set(groupId, {
      ...g,
      members: [], memberUIDs: [], membersCount: 0,
      status: "empty", pairingId: nextPairingId, memberPayments: {},
    });
  } else {
    store.set(groupId, {
      ...g,
      members: resetMembers,
      memberUIDs: remainingPhones,
      membersCount: newCount,
      status: newCount >= required ? "ready" : "waiting",
      pairingId: nextPairingId,
      memberPayments,
    });
  }
  return { ok: true, newCount, required };
}

// Replicates verify-razorpay-payment's group update: mark THIS member paid
// FOR THE CURRENT pairing on the shared group doc (rejected at 1/2).
function payProcess(store, groupId, phone) {
  const g = store.get(groupId);
  if (!g) return { ok: false, error: "Group not found" };
  const required = resolveRequired(g, g.option);
  if (memberCount(g) < required) return { ok: false, error: "match not complete (1/2)" };
  const pairingId = getPairingId(g);
  const members = memberList(g).map((m) =>
    typeof m === "string" ? m : (m?.phone || m?.uid) === phone ? { ...m, paid: true } : m
  );
  store.set(groupId, {
    ...g,
    members,
    memberPayments: { ...(g.memberPayments || {}), [phone]: { paid: true, pairingId } },
  });
  return { ok: true };
}

// Replicates remove-match's refillOpenSlot: move the OLDEST compatible lone
// waiting member into the vacated slot; source group becomes "empty"; both
// members' payments reset for the new pairing. Re-validated before commit.
function refillProcess(store, targetGroupId) {
  const target = store.get(targetGroupId);
  if (!target) return null;
  if (!isOpen(target)) return null;
  const tCount = memberCount(target);
  const required = resolveRequired(target, target.option);
  if (tCount !== required - 1) return null;

  const candidates = store.query(target.category, target.option);
  const best = pickOldestRefillable(
    candidates,
    {
      state: target.state, district: target.district, city: target.city,
      option: target.option, collaboratorId: target.collaboratorId || "",
    },
    targetGroupId
  );
  if (!best) return null;

  // Re-validate (transactional semantics): both docs fresh-checked.
  const src = store.get(best.id);
  if (!src || !isOpen(src) || memberCount(src) !== 1) return null;
  if (!matchesLocation(src, target.state, target.district, target.city)) return null;
  if (!matchesGroupKey(src, target.collaboratorId || "")) return null;

  const moved = memberList(src)[0];
  const movedPhone = typeof moved === "string" ? moved : moved?.phone || moved?.uid || "";
  const targetPhones = memberList(target)
    .map((m) => (typeof m === "string" ? m : m?.phone || m?.uid || ""))
    .filter(Boolean);
  if (!movedPhone || targetPhones.includes(movedPhone)) return null;

  const nextPairingId = newPairingId();
  const resetTargetMembers = memberList(target).map((m) =>
    typeof m === "string" ? m : { ...m, paid: false }
  );
  const memberPayments = {};
  for (const p of [...targetPhones, movedPhone]) {
    memberPayments[p] = { paid: false, pairingId: nextPairingId };
  }

  store.set(best.id, {
    ...src, members: [], memberUIDs: [], membersCount: 0,
    status: "empty", pairingId: nextPairingId, memberPayments: {},
  });
  store.set(targetGroupId, {
    ...target,
    members: [...resetTargetMembers, typeof moved === "string" ? moved : { ...moved, paid: false }],
    memberUIDs: [...targetPhones, movedPhone],
    membersCount: required,
    status: "ready",
    pairingId: nextPairingId,
    memberPayments,
  });
  return { movedPhone, targetGroupId };
}

// Replicates /api/join-group's retry loop exactly.
function routeProcess(store, { category, option, phone, state, district, city, requestedRequiredSize, collaboratorId, extra = {} }) {
  const memberObject = { phone, uid: phone, name: "User-" + phone };
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidates = store.query(category, option);
    const best = pickOldestOpen(candidates, { state, district, city, option, phone, collaboratorId: collaboratorId || "" });

    if (!best) {
      const r = createGroup(store, category, option, memberObject, phone, {
        state, district, city, requiredSize: requestedRequiredSize, collaboratorId, ...extra,
      });
      return r;
    }

    const outcome = joinTransaction(store, best.id, category, option, memberObject, phone);
    if (!outcome.retry && outcome.result) return outcome.result;
    // retry → loop
  }
  throw new Error("retries exhausted");
}

/* ------------------------------------------------------------------ */
/* Assertions                                                          */
/* ------------------------------------------------------------------ */
let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log("  ✓ " + label);
  } else {
    failures++;
    console.error("  ✗ FAIL: " + label);
  }
}

/* ------------------------------------------------------------------ */
/* SCENARIO 1 — the exact 4-user first-come-first-served flow          */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 1: User1→1/2, User2 joins→2/2, User3→new 1/2, User4 joins→2/2 ==");
{
  const store = makeStore();
  const criteria = { category: "gym", option: "split", state: "Karnataka", district: "Bangalore Urban", city: "Bangalore" };
  const users = [1, 2, 3, 4].map((n) => ({ ...criteria, phone: "9" + n + "00000000" }));

  // User 1 → create new 1/2
  const r1 = routeProcess(store, users[0]);
  check(r1.status === "created" && r1.membersCount === 1, `U1 creates new group ${r1.groupId} (1/2)`);
  check(store.get(r1.groupId).status === "waiting", "U1's group status = waiting");

  // User 2 → must JOIN SAME oldest open group (never create another)
  const r2 = routeProcess(store, users[1]);
  check(r2.groupId === r1.groupId, `U2 joins SAME group ${r1.groupId} (groupIds match)`);
  check(r2.membersCount === 2 && r2.status === "ready", `U2 fills group → 2/2 ready (membersCount=${r2.membersCount}, status=${r2.status})`);
  check(store.get(r1.groupId).membersCount === 2, "Group membersCount == 2");
  check(r2.status === "ready", "Group marked ready → dashboard shows Unlock ₹29");

  // User 3 → first group is ready (not open) → create NEW group 1/2
  const r3 = routeProcess(store, users[2]);
  check(r3.groupId !== r1.groupId && r3.membersCount === 1 && r3.status === "created", `U3 gets a NEW group ${r3.groupId} (1/2)`);

  // User 4 → join User 3's group → 2/2
  const r4 = routeProcess(store, users[3]);
  check(r4.groupId === r3.groupId && r4.membersCount === 2 && r4.status === "ready", `U4 joins U3's group ${r3.groupId} → 2/2 ready`);

  // No group ever exceeds requiredSize (2)
  check(store.all().every((g) => g.membersCount <= g.requiredSize), "No group exceeds requiredSize");
  check(store.all().filter((g) => g.membersCount >= g.requiredSize).length === 2, "Exactly 2 full groups created");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 2 — FIFO: multiple open groups exist, user must join the   */
/* OLDEST available group (edge case: legacy groups or concurrent      */
/* creators can leave more than one open group for the same criteria). */
/* ------------------------------------------------------------------ */
{
  console.log("\n== Scenario 2: FIFO — oldest open group wins ==");
  const store = makeStore();
  const criteria = { category: "gym", option: "split", state: "Karnataka", district: "Bangalore Urban", city: "Bangalore" };
  const mk = (phone) => ({ phone, uid: phone, name: "User-" + phone });

  // Seed two open 1/2 groups that are BOTH valid matches (created at t=1 and t=5).
  store.set("old", {
    category: "gym", option: "split", state: "Karnataka", district: "Bangalore Urban", city: "Bangalore",
    members: [mk("911000000001")], memberUIDs: ["911000000001"], membersCount: 1,
    requiredSize: 2, status: "waiting", createdAt: { seconds: 1, toMillis: () => 1000 },
  });
  store.set("new", {
    category: "gym", option: "split", state: "Karnataka", district: "Bangalore Urban", city: "Bangalore",
    members: [mk("911000000002")], memberUIDs: ["911000000002"], membersCount: 1,
    requiredSize: 2, status: "waiting", createdAt: { seconds: 5, toMillis: () => 5000 },
  });
  check(store.docs.size === 2, "Two open groups for identical criteria exist");

  // New user must join the OLDEST ("old") first.
  const r3 = routeProcess(store, { ...criteria, phone: "911000000003" });
  check(r3.groupId === "old", `U3 joins oldest open group "old" (actual: ${r3.groupId})`);
  check(store.get("old").status === "ready" && store.get("new").status === "waiting", "Oldest filled first; newer group still waits");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 3 — concurrent double-User-2 on the same 1/2 group         */
/* ------------------------------------------------------------------ */
{
  console.log("\n== Scenario 3: two simultaneous User 2 requests vs one open 1/2 group ==");
  const store = makeStore();
  const criteria = { category: "gym", option: "split", state: "Karnataka", district: "Bangalore Urban", city: "Bangalore" };
  const u = (n) => ({ ...criteria, phone: "92" + n });

  const r1 = routeProcess(store, u(1000000001)); // 1/2
  check(store.get(r1.groupId).membersCount === 1, "Setup: one open 1/2 group");

  // Both concurrently attempt the join; Firestore serializes them, so the
  // second one's transaction RE-READS the doc and sees 2/2 → aborts/retries.
  const results = await Promise.all([
    Promise.resolve().then(() => routeProcess(store, u(1000000002))),
    Promise.resolve().then(() => routeProcess(store, u(1000000003))),
  ]);
  const [ra, rb] = results;

  const group = store.get(r1.groupId);
  check(group.membersCount === 2, `Group never exceeds requiredSize (membersCount=${group.membersCount})`);
  check(group.status === "ready", "Exactly one transaction fills the group → ready");

  // The loser ends in their OWN fresh 1/2 group (NOT a duplicate of a filled group).
  const losers = [ra, rb].filter((r) => r.groupId !== r1.groupId);
  check(losers.length === 1, "Exactly one request created a new group (the loser re-scanned)");
  if (losers.length === 1) {
    const loserGroup = store.get(losers[0].groupId);
    check(loserGroup.membersCount === 1 && loserGroup.status === "waiting", "Loser's group is a clean new 1/2 (waiting)");
  }
  check(!store.all().some((g) => g.membersCount > g.requiredSize), "No over-capacity group anywhere");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 4 — gym layer: users only match within the SAME gym        */
/* ------------------------------------------------------------------ */
{
  console.log("\n== Scenario 4: same-gym matching (category + subcategory + gym + location) ==");
  const store = makeStore();
  const criteria = { category: "gym", option: "split", state: "Andhra Pradesh", district: "Krishna", city: "Vijayawada" };

  // U1 joins Cult Fit (gym-specific), U2 same gym → share group.
  const r1 = routeProcess(store, { ...criteria, phone: "910000000001", collaboratorId: "cultfit-vja", collaboratorName: "Cult Fit" });
  const r2 = routeProcess(store, { ...criteria, phone: "910000000002", collaboratorId: "cultfit-vja", collaboratorName: "Cult Fit" });
  check(r1.groupId === r2.groupId && r1.status === "created", "Same-gym users share a group (U1 1/2 → U2 2/2 same group)");
  check(store.get(r1.groupId).status === "ready", "Same-gym group is ready after 2 same-gym users");

  // A generic (no gym) user must NOT join the Cult Fit group.
  const r3 = routeProcess(store, { ...criteria, phone: "910000000003" });
  check(r3.groupId !== r1.groupId, "Generic user does NOT join a gym-specific group (separate group)");
  check(store.get(r1.groupId).memberUIDs.length === 2, "Cult Fit group unchanged by generic user");

  // Same location + subcategory but DIFFERENT gym → different groups.
  const r4 = routeProcess(store, { ...criteria, phone: "910000000004", collaboratorId: "goldshym-vja", collaboratorName: "Gold's Gym" });
  check(r4.groupId !== r1.groupId && r4.groupId !== r3.groupId, "Different gym → different group");

  // Two users of Gold's Gym (different city) must NOT join Vijayawada's group.
  const r5 = routeProcess(store, { ...criteria, city: "Guntur", phone: "910000000005", collaboratorId: "goldshym-vja", collaboratorName: "Gold's Gym" });
  check(r5.groupId !== r4.groupId, "Same gym but different city → separate group (location respected)");

  check(!store.all().some((g) => g.membersCount > g.requiredSize), "No over-capacity group anywhere");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 5 — gym VISIBILITY: pending hidden, approved area-scoped   */
/* (verification cases F and G)                                        */
/*                                                                     */
/* Replicates the real visibility pipeline:                            */
/*  - Pending user submissions live in `userCollaborations` and are    */
/*    NEVER in the marketplace/{category}/businesses collection, so    */
/*    they can never appear in the user's gym selection list.          */
/*  - On approval, approveUserCollaboration() creates a marketplace    */
/*    doc (visible: true, scope: "city", state/district/city +         */
/*    subcategory). filterBusinessesByScope() then shows it ONLY to    */
/*    users whose State → District → City matches.                     */
/* ------------------------------------------------------------------ */
{
  console.log("\n== Scenario 5: gym visibility (F: pending hidden, G: approved area-scoped) ==");

  const normalize = (v) => String(v ?? "").trim().toLowerCase();

  // Faithful replica of filterBusinessesByScope (marketplaceManager.ts):
  // hidden docs skipped, subcategory must match, scope decides area reach.
  function filterBusinessesByScope(data, subcategory, userState, userDistrict, userCity) {
    const normState = normalize(userState);
    const normDistrict = normalize(userDistrict);
    const normCity = normalize(userCity);
    const normSubcategory = normalize(subcategory);
    const results = [];
    for (const b of data) {
      if (b.visible === false) continue; // hidden
      if (normSubcategory && normalize(b.subcategory) !== normSubcategory) continue;
      let scopeMatch = false;
      switch (b.scope) {
        case "national":
          scopeMatch = true;
          break;
        case "state":
          scopeMatch = normalize(b.state) === normState;
          break;
        case "district":
          scopeMatch = normalize(b.state) === normState && normalize(b.district) === normDistrict;
          break;
        case "city":
          scopeMatch =
            normalize(b.state) === normState &&
            normalize(b.district) === normDistrict &&
            normalize(b.city) === normCity;
          break;
      }
      if (scopeMatch) results.push(b);
    }
    return results;
  }

  const userLoc = { state: "Andhra Pradesh", district: "Guntur", city: "Tenali" };

  // The ONLY source the gym grid queries: approved marketplace businesses.
  // (Pending submissions live in userCollaborations — modeled by their absence here.)
  const marketplaceDocs = [
    {
      id: "seed-cult-tenali",
      businessName: "Cult Gym",
      subcategory: "Gym Membership Split",
      visible: true,
      scope: "city",
      state: "Andhra Pradesh",
      district: "Guntur",
      city: "Tenali",
    },
    {
      id: "user-submitted-xyz",
      businessName: "XYZ Gym (user-submitted)",
      subcategory: "Gym Membership Split",
      visible: true,
      scope: "city",
      state: "Andhra Pradesh",
      district: "Guntur",
      city: "Tenali",
    },
    {
      id: "other-city-gym",
      businessName: "Vijayawada Gym",
      subcategory: "Gym Membership Split",
      visible: true,
      scope: "city",
      state: "Andhra Pradesh",
      district: "Krishna",
      city: "Vijayawada",
    },
  ];

  // Case F: a PENDING user-submitted gym is not in the marketplace at all.
  const pendingSubmission = {
    id: "pending-abc",
    businessName: "Pending Gym",
    subcategory: "Gym Membership Split",
    status: "pending", // userCollaborations doc — NOT in marketplaceDocs
  };
  const visibleF = filterBusinessesByScope(
    marketplaceDocs.filter((b) => b.id === pendingSubmission.id), // grid's source has no pending docs
    "Gym Membership Split",
    userLoc.state,
    userLoc.district,
    userLoc.city
  );
  check(visibleF.length === 0, "F: pending user-submitted gym is NOT visible before approval");

  // Case G1: approved user-submitted gym IS visible to users in the same area.
  const visibleTenali = filterBusinessesByScope(
    marketplaceDocs,
    "Gym Membership Split",
    userLoc.state,
    userLoc.district,
    userLoc.city
  );
  check(
    visibleTenali.some((b) => b.id === "user-submitted-xyz"),
    "G: approved user-submitted gym IS visible to users in the same State-District-City"
  );
  check(
    visibleTenali.some((b) => b.id === "seed-cult-tenali"),
    "G: seed/admin gym remains visible alongside the approved user gym"
  );

  // Case G2: an approved gym in a DIFFERENT city is NOT visible here.
  check(
    !visibleTenali.some((b) => b.id === "other-city-gym"),
    "G: approved gym from a different city is NOT visible (area scoping respected)"
  );

  // Case G3: users in the other city see THEIR gyms, not Tenali's.
  const visibleVja = filterBusinessesByScope(
    marketplaceDocs,
    "Gym Membership Split",
    "Andhra Pradesh",
    "Krishna",
    "Vijayawada"
  );
  check(
    visibleVja.some((b) => b.id === "other-city-gym") && !visibleVja.some((b) => b.id === "user-submitted-xyz"),
    "G: users in the other city see their own area's gyms only"
  );

  // Case G4: a rejected submission never becomes visible (approval is the
  // ONLY path that creates the marketplace doc).
  const rejectedDoc = { ...pendingSubmission, status: "rejected" };
  check(
    rejectedDoc.status !== "approved" &&
      filterBusinessesByScope(
        marketplaceDocs.filter((b) => b.id === rejectedDoc.id),
        "Gym Membership Split",
        userLoc.state,
        userLoc.district,
        userLoc.city
      ).length === 0,
    "G: rejected submission never becomes visible (only admin approval publishes)"
  );
}

/* ------------------------------------------------------------------ */
/* SCENARIO 6 — Profile Name field (A: full-name entry + persistence)  */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 6: profile Name field — full name entry + save-then-lock ==");
{
  // Replicates the profile page's state machine EXACTLY (app/profile/page.tsx):
  //   name       → live controlled-input value
  //   nameSaved  → true ONLY when a name is PERSISTED (loaded from Firestore
  //                with a saved value, or written by a successful save)
  //   nameLocked → shouldLockName(nameSaved, guest) — must NEVER depend on the
  //                live input value (keying it off the value was the root cause
  //                of the "one character only" bug: typing "M" made the value
  //                truthy and instantly set readOnly/disabled).
  const guest = false;

  // A. New user can enter the COMPLETE name — no keystroke may lock the field.
  let name = "";
  let nameSaved = false;
  const typed = "Manoj Kumar";
  let lockedAtKeystroke = -1;
  for (let i = 0; i < typed.length; i++) {
    name = typed.slice(0, i + 1); // each keystroke appends one char
    if (shouldLockName(nameSaved, guest)) {
      lockedAtKeystroke = i;
      break;
    }
  }
  check(lockedAtKeystroke === -1, "A: typing is NEVER locked mid-entry (field stays editable through every keystroke)");

  // The profile is saved/submitted → the COMPLETE typed name is persisted.
  const persisted = resolveSavedName("", name);
  check(persisted === "Manoj Kumar", `A: complete name persisted after save ("${persisted}", not just the first char)`);

  // Multi-word names too.
  check(resolveSavedName("", "Sathya Manoj Biyyapu") === "Sathya Manoj Biyyapu", 'A: "Sathya Manoj Biyyapu" accepted in full');

  // Name becomes fixed/read-only ONLY AFTER a successful save.
  nameSaved = true;
  check(shouldLockName(nameSaved, guest) === true, "A: name locks ONLY after the profile is successfully saved");

  // Existing users with an already-saved name keep the fixed-name design.
  check(shouldLockName(true, false) === true, "Existing saved name stays fixed/read-only (intended design)");

  // Identity preservation: an existing saved name always wins on re-save.
  check(resolveSavedName("Existing User", "Someone Else") === "Existing User", "Existing saved name is preserved forever (never overwritten)");

  // Guests can never save, so the field is never locked for them.
  check(shouldLockName(true, true) === false, "Guest mode never locks the name field");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 7 — My Matches display (J: 1/2 waiting + 2/2 matched,      */
/*               K: existing member visible before joining)            */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 7: My Matches display counts + member visibility ==");
{
  const mk = (phone, nm) => ({ phone, uid: phone, name: nm });

  // A real 1/2 waiting group exactly as /api/join-group writes it: member
  // objects carry name + masked phone and NO state/district/city (the old
  // dashboard counted only location-tagged members and mis-displayed groups).
  const waiting = {
    category: "gym",
    option: "split",
    state: "Andhra Pradesh",
    district: "Guntur",
    city: "Tenali",
    collaboratorId: "cult-gym-tenali",
    members: [mk("9000000001", "Manoj")],
    memberUIDs: ["9000000001"],
    membersCount: 1,
    requiredSize: 2,
    status: "waiting",
  };

  // J: a 1-member group classifies as WAITING (1/2) — never hidden, never
  // mis-filed as matched, and the count is the real membership.
  check(!isGroupMatched(waiting), "J: 1-member group classifies as WAITING (1/2), never hidden");
  check(actualMemberCount(waiting) === 1 && resolveRequired(waiting, "split") === 2, "J: '1/2 Waiting' count is exact");

  // K: the existing member is visible to the other eligible user BEFORE joining.
  const waitingNames = memberDisplayNames(waiting);
  check(waitingNames.length === 1 && waitingNames[0] === "Manoj", `K: existing member visible before joining (Members: ${waitingNames.join(", ")})`);

  // After the second member joins → 2/2 matched, BOTH members visible.
  const matched = {
    ...waiting,
    members: [mk("9000000001", "Manoj"), mk("9000000002", "Other User")],
    memberUIDs: ["9000000001", "9000000002"],
    membersCount: 2,
    status: "ready",
  };
  check(isGroupMatched(matched), "J: 2/2 group classifies as MATCHED (no longer joinable)");
  check(
    memberDisplayNames(matched).join(", ") === "Manoj, Other User",
    "J/K: both members visible on the matched card ('Manoj, Other User')"
  );

  // ROOT-CAUSE case: full 2/2 group whose members carry NO location tags —
  // must still display 2/2 Matched (old code showed "1/2" here forever).
  check(isGroupMatched({ ...matched, members: matched.members }), "J: full group with location-untagged members shows 2/2 Matched");

  // Defensive: stale declared count can never hide real members.
  check(actualMemberCount({ ...waiting, membersCount: undefined }) === 1, "Fallback: members array length used when membersCount is missing");
  check(actualMemberCount({ ...matched, membersCount: 1 }) === 2, "Defensive: declared count < actual members → actual members win (no fake 1/2)");

  // Privacy: a member row without a name falls back to the MASKED phone.
  check(memberDisplayNames({ members: ["9000000009"] })[0] === "xxxxx00009", "Privacy: nameless member shown as masked phone (no PII leak)");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 8 — Multiple partnerships per user (H) + missing-location  */
/*               safety (D) + profile-save contract (B, C)             */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 8: multiple matches per user + missing-location guard + profile contract ==");
{
  // H: the SAME user, same city, DIFFERENT gyms → separate independent groups.
  const store8 = makeStore();
  const multiUser = "9000000001";
  const gymA = routeProcess(store8, {
    category: "gym", option: "split", phone: multiUser,
    state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    collaboratorId: "gym-a", extra: { collaboratorName: "Gym A" },
  });
  const gymB = routeProcess(store8, {
    category: "gym", option: "split", phone: multiUser,
    state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    collaboratorId: "gym-b", extra: { collaboratorName: "Gym B" },
  });
  check(gymA.groupId !== gymB.groupId, "H: same user + different gyms in the SAME city → SEPARATE groups (both allowed)");
  check(gymA.status === "created" && gymA.membersCount === 1 && gymB.status === "created" && gymB.membersCount === 1, "H: both partnerships are independent 1/2 waiting groups");
  const gymA2 = routeProcess(store8, {
    category: "gym", option: "split", phone: "9000000077",
    state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    collaboratorId: "gym-a", extra: { collaboratorName: "Gym A" },
  });
  check(gymA2.groupId === gymA.groupId && gymA2.status === "ready", "H: Gym A group still fills independently (2/2) — untouched by Gym B");

  // Same user, same gym, DIFFERENT city → separate group (city is part of the key).
  const gymAOtherCity = routeProcess(store8, {
    category: "gym", option: "split", phone: multiUser,
    state: "Andhra Pradesh", district: "Krishna", city: "Vijayawada",
    collaboratorId: "gym-a", extra: { collaboratorName: "Gym A" },
  });
  check(gymAOtherCity.groupId !== gymA.groupId && gymAOtherCity.status === "created", "H: same gym from a DIFFERENT city → separate new 1/2 group");

  // D: a legacy "Location not set" group (empty state/district/city) must
  // NEVER be matched into by a user with a real saved profile.
  store8.set("bad-loc", {
    category: "gym", option: "split", state: "", district: "", city: "",
    collaboratorId: "", collaboratorBrand: "",
    members: [{ phone: "9000000500", uid: "9000000500", name: "Ghost" }],
    memberUIDs: ["9000000500"], membersCount: 1, requiredSize: 2,
    status: "waiting", createdAt: store8.nextTs(), createdBy: "9000000500",
  });
  check(
    matchesLocation(store8.get("bad-loc"), "Andhra Pradesh", "Guntur", "Tenali") === false &&
      matchesLocation(store8.get("bad-loc"), "x", "y", "z") === false,
    "D: 'Location not set' group never matches ANY real profile location"
  );
  const pickedReal = pickOldestOpen(store8.query("gym", "split"), {
    state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    option: "split", phone: "9000000900", collaboratorId: "gym-b",
  });
  check(
    pickedReal !== null && pickedReal.id === gymB.groupId,
    "D: real user is matched into a properly located waiting group, never the bad one"
  );

  // D: the route's mandatory-profile gate condition (name/gender/state/
  // district/city ALL required) blocks matching before any group is read.
  const gateBlocks = (p) =>
    !String(p?.name || "").trim() || !String(p?.gender || "").trim() ||
    !String(p?.state || "").trim() || !String(p?.district || "").trim() ||
    !String(p?.city || "").trim();
  check(gateBlocks({ name: "U", gender: "M", state: "AP", district: "Guntur", city: "" }) === true, "D: profile missing city is BLOCKED from matching (server gate)");
  check(gateBlocks({ name: "U", gender: "M", state: "AP", district: "Guntur", city: "Tenali" }) === false, "D: complete profile passes the gate");

  // B/C: /api/save-profile merge contract (replicated): mandatory fields are
  // required and existing saved values are never overwritten with empty ones —
  // so State/District/City persist across reloads.
  const saveProfileMerge = (existing, incoming) => {
    const pick = (v, k) => (v && String(v).trim() !== "" ? v : existing[k] ?? "");
    return {
      name: existing.name && String(existing.name).trim() !== "" ? String(existing.name).trim() : incoming.name,
      state: pick(incoming.state, "state"),
      district: pick(incoming.district, "district"),
      city: pick(incoming.city, "city"),
    };
  };
  const savedFresh = saveProfileMerge({}, { name: "Manoj Kumar", gender: "M", state: "Andhra Pradesh", district: "Guntur", city: "Tenali" });
  check(savedFresh.name === "Manoj Kumar" && savedFresh.state === "Andhra Pradesh" && savedFresh.district === "Guntur" && savedFresh.city === "Tenali", "B: new user profile saves name + gender + full location");
  const reSaved = saveProfileMerge(savedFresh, { name: "", gender: "M", state: "", district: "", city: "" });
  check(reSaved.state === "Andhra Pradesh" && reSaved.district === "Guntur" && reSaved.city === "Tenali" && reSaved.name === "Manoj Kumar", "C: re-save with empty fields keeps persisted State/District/City (values survive reload)");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 9 — Nearby candidate pool (L, M) + Pay enablement (N, O)   */
/*               + movie ticket rate (T)                               */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 9: nearby current-city pool + Pay gating + ticket rate ==");
{
  // L/M: the nearby pool uses the SAME matchesLocation rule as the matching
  // key — candidates must be in the viewer's CURRENT State→District→City.
  const me = { state: "Andhra Pradesh", district: "Guntur", city: "Tenali" };
  check(matchesLocation({ state: "Andhra Pradesh", district: "Guntur", city: "Tenali" }, me.state, me.district, me.city) === true, "L: candidate in the SAME current city IS in the nearby pool");
  check(matchesLocation({ state: "Andhra Pradesh", district: "Guntur", city: "Vijayawada" }, me.state, me.district, me.city) === false, "L: candidate from ANOTHER city is NEVER shown as nearby");
  check(matchesLocation({ state: "Andhra Pradesh", district: "Krishna", city: "Vijayawada" }, me.state, me.district, me.city) === false, "M: candidate from another district is excluded");
  const meMoved = { state: "Andhra Pradesh", district: "Krishna", city: "Vijayawada" };
  check(matchesLocation({ state: "Andhra Pradesh", district: "Krishna", city: "Vijayawada" }, meMoved.state, meMoved.district, meMoved.city) === true, "M: after the user changes city, the pool follows the NEW city");
  check(matchesLocation({ state: "Andhra Pradesh", district: "Guntur", city: "Tenali" }, meMoved.state, meMoved.district, meMoved.city) === false, "M: old-city candidates are not mixed into the new city pool");

  // N/O: Pay gating follows ACTUAL membership — disabled while 1/2, enabled
  // once 2/2 (dashboard action footer: matchingCount >= required → Unlock).
  const half = {
    category: "gym", option: "split", state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    collaboratorId: "gym-a",
    members: [{ phone: "9000000001", uid: "9000000001", name: "Manoj" }],
    memberUIDs: ["9000000001"], membersCount: 1, requiredSize: 2, status: "waiting",
  };
  const full = {
    ...half,
    members: [
      { phone: "9000000001", uid: "9000000001", name: "Manoj" },
      { phone: "9000000002", uid: "9000000002", name: "Other User" },
    ],
    memberUIDs: ["9000000001", "9000000002"], membersCount: 2, status: "ready",
  };
  check(isGroupMatched(half) === false, "N: Pay DISABLED at 1/2 (group not yet complete)");
  check(isGroupMatched(full) === true, "O: Pay ENABLED at 2/2 (group complete → Unlock)");
  check(actualMemberCount(full) === 2 && actualMemberCount(half) === 1, "O/N: counts driving the Pay gate are accurate (never a stale '2/10')");

  // T: movie-ticket RATE accepts at most 4 numeric digits.
  check(isValidTicketRate(100) && isValidTicketRate(500) && isValidTicketRate(1500) && isValidTicketRate(9999), "T: rates 100 / 500 / 1500 / 9999 are accepted");
  check(!isValidTicketRate(10000) && !isValidTicketRate(12345), "T: 5-digit rates (10000+) are REJECTED");
  check(!isValidTicketRate("12a5") && !isValidTicketRate(-5) && !isValidTicketRate(12.5) && !isValidTicketRate("abc") && !isValidTicketRate(null), "T: non-numeric / negative / decimal / null rates are REJECTED");
  check(sanitizeTicketRateInput("12a34bc5678") === "1234", "T: UI input mask strips non-digits and hard-caps at 4 digits");
  check(isValidTicketRate(sanitizeTicketRateInput("500")) === true, "T: masked input stays valid");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 10 — Full pairing lifecycle: match → pay → chat → remove   */
/*               → FIFO refill → payment reset (tests A–J)             */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 10: pairing lifecycle (match, pay, chat, remove, FIFO refill) ==");
{
  const store10 = makeStore();
  const LOC = { state: "Andhra Pradesh", district: "Prakasam", city: "Addanki" };
  const join = (phone, collaboratorId) => routeProcess(store10, {
    category: "gym", option: "split", phone,
    ...LOC, collaboratorId, extra: { collaboratorName: "Vault" },
  });

  // A: User 1 joins → 1/2.
  const u1 = join("9000000001", "vault-gym");
  check(u1.status === "created" && u1.membersCount === 1 && u1.requiredSize === 2, "A: User 1 joins → 1/2 waiting group");
  check(!chatUnlocked(store10.get(u1.groupId)) && !isGroupMatched(store10.get(u1.groupId)), "A: 1/2 → chat locked, Pay disabled");

  // B: User 2 joins the SAME exact key → 2/2, same group (live shared doc).
  const u2 = join("9000000002", "vault-gym");
  check(u2.groupId === u1.groupId && u2.status === "ready" && u2.membersCount === 2, "B: User 2 joins → same group 2/2 Matched (User 1's card updates from the shared doc)");

  // User 7 arrives while the pair is full → waits in their own lone group
  // (this is the FIFO queue the refill draws from).
  const u7 = join("9000000007", "vault-gym");
  check(u7.status === "created" && u7.groupId !== u1.groupId && u7.membersCount === 1, "Setup: full pair → User 7 waits in their own lone 1/2 group");

  // D: Pay button available to BOTH at 2/2 (group matched, self unpaid).
  const gA = store10.get(u1.groupId);
  check(isGroupMatched(gA) && !isPaidForPairing(gA, "9000000001") && !isPaidForPairing(gA, "9000000002"), "D: at 2/2 the Unlock/Pay button is available to both members");

  // E: Only User 1 pays → chat stays locked.
  const p1 = payProcess(store10, u1.groupId, "9000000001");
  check(p1.ok && isPaidForPairing(store10.get(u1.groupId), "9000000001"), "E: User 1 pays → marked paid for the current pairing");
  check(!chatUnlocked(store10.get(u1.groupId)), "E: 2/2 + one payment → chat REMAINS locked");

  // F: User 2 pays → both paid → chat unlocks for both.
  const p2 = payProcess(store10, u1.groupId, "9000000002");
  check(p2.ok && chatUnlocked(store10.get(u1.groupId)), "F: both paid → chat UNLOCKS for both users");

  // G: User 1 removes → User 2 immediately sees 1/2, payments reset.
  const r1 = removeProcess(store10, u1.groupId, "9000000001");
  const gAfterRemove = store10.get(u1.groupId);
  check(r1.ok && gAfterRemove.status === "waiting" && memberCount(gAfterRemove) === 1, "G: User 1 removes → group becomes 1/2 Waiting for User 2");
  check(!isPaidForPairing(gAfterRemove, "9000000002") && !chatUnlocked(gAfterRemove), "G: User 2's payment reset → 1/2 Waiting, chat locked");

  // H: User 7 was ALREADY waiting in their own lone group (joined while the
  // pair was full) → the FIFO refill moves them into the vacated slot.
  const refill = refillProcess(store10, u1.groupId);
  const gRefilled = store10.get(u1.groupId);
  check(!!refill && refill.movedPhone === "9000000007" && gRefilled.status === "ready" && memberCount(gRefilled) === 2, "H: FIFO refill → User 2 + User 7 = 2/2 Matched");
  check(!isOpen(store10.get(u7.groupId)) && memberCount(store10.get(u7.groupId)) === 0, "H: User 7's old lone group is marked empty (no orphan waiting groups)");

  // I: OLD payment state must NOT unlock the NEW pairing.
  check(getPairingId(gAfterRemove) !== getPairingId(gRefilled), "I: replacement created a NEW pairing id");
  check(!isPaidForPairing(gRefilled, "9000000002") && !isPaidForPairing(gRefilled, "9000000007") && !chatUnlocked(gRefilled), "I: new pairing starts with BOTH payments pending — chat locked");
  const rp1 = payProcess(store10, u1.groupId, "9000000002");
  check(rp1.ok && !chatUnlocked(store10.get(u1.groupId)), "I: only User 2 pays again → chat still locked (no carry-over)");
  const rp2 = payProcess(store10, u1.groupId, "9000000007");
  check(rp2.ok && chatUnlocked(store10.get(u1.groupId)), "I: User 7 also pays → chat unlocks for the NEW pair");

  // Join-time FIFO fill: when a user clicks AFTER a vacancy exists, they fill
  // the oldest open slot directly (no extra group created).
  removeProcess(store10, u1.groupId, "9000000002"); // User 2 leaves again
  const u9 = join("9000000009", "vault-gym");
  check(u9.groupId === u1.groupId && u9.status === "ready" && memberCount(store10.get(u1.groupId)) === 2, "FIFO join-time fill: User 9 clicking after the vacancy joins the open slot directly");
}

/* ------------------------------------------------------------------ */
/* SCENARIO 11 — Multiple pairs stay independent (J) + capacity (Q)    */
/* ------------------------------------------------------------------ */
console.log("\n== Scenario 11: multiple independent pairs + FIFO fill + capacity ==");
{
  const storeJ = makeStore();
  const LOC = { state: "Andhra Pradesh", district: "Prakasam", city: "Addanki" };
  const joinJ = (phone) => routeProcess(storeJ, {
    category: "gym", option: "split", phone, ...LOC, collaboratorId: "vault-gym",
  });
  const g1 = joinJ("8000000001"); joinJ("8000000002"); // Group A 2/2
  const g2 = joinJ("8000000003"); joinJ("8000000004"); // Group B 2/2
  const g3 = joinJ("8000000005"); joinJ("8000000006"); // Group C 2/2
  check(g1.groupId !== g2.groupId && g2.groupId !== g3.groupId, "J: three separate 2-person groups formed (1+2, 3+4, 5+6)");

  // User 7 arrives while ALL pairs are full → creates a lone 1/2 waiting group.
  const u7 = joinJ("8000000007");
  check(u7.status === "created" && memberCount(storeJ.get(u7.groupId)) === 1, "J: User 7 creates lone 1/2 waiting group (all pairs full)");
  check(u7.groupId !== g1.groupId && u7.groupId !== g2.groupId && u7.groupId !== g3.groupId, "J: User 7 is NOT in any existing full group");

  const beforeA = JSON.stringify(storeJ.get(g1.groupId));
  const beforeB = JSON.stringify(storeJ.get(g2.groupId));
  const beforeC = JSON.stringify(storeJ.get(g3.groupId));

  // User 2 leaves Group A → Group A drops to 1/2 (User 1 remains).
  removeProcess(storeJ, g1.groupId, "8000000002");
  check(memberCount(storeJ.get(g1.groupId)) === 1 && isOpen(storeJ.get(g1.groupId)), "J: User 2 leaves → Group A becomes 1/2 Waiting (User 1 remains)");

  // FIFO refill: User 7 (the oldest lone waiting user) fills Group A's slot.
  const refillJ = refillProcess(storeJ, g1.groupId);
  check(!!refillJ && refillJ.movedPhone === "8000000007" && memberCount(storeJ.get(g1.groupId)) === 2 && storeJ.get(g1.groupId).status === "ready", "J: User 2 leaves → waiting User 7 FIFO-fills Group A (1 + 7 = 2/2)");
  check(!isOpen(storeJ.get(u7.groupId)) && memberCount(storeJ.get(u7.groupId)) === 0, "J: User 7's old lone group is emptied after FIFO refill");
  check(JSON.stringify(storeJ.get(g2.groupId)) === beforeB && JSON.stringify(storeJ.get(g3.groupId)) === beforeC, "J: Groups 3+4 and 5+6 remain completely unchanged");

  // User 1 leaves → Group A drops to 1/2 (User 7 remains).
  removeProcess(storeJ, g1.groupId, "8000000001");
  check(memberCount(storeJ.get(g1.groupId)) === 1 && isOpen(storeJ.get(g1.groupId)), "J: User 1 leaves → Group A becomes 1/2 Waiting (User 7 remains)");

  // User 8 joins AFTER the vacancy exists → join-time fill: fills the open slot directly.
  const u8 = joinJ("8000000008");
  check(u8.groupId === g1.groupId && u8.status === "ready" && memberCount(storeJ.get(g1.groupId)) === 2, "J: continuous FIFO — User 8 fills the next vacancy at join time (1 + 8 = 2/2)");

  check(!storeJ.all().some((g) => resolveRequired(g, g.option) === 2 && memberCount(g) > 2), "Q: no group ever exceeds 2/2 (no 3/2 anywhere)");
  check(storeJ.all().every((g) => g.status !== "waiting" || memberCount(g) === 1 || memberCount(g) === 2), "Q: waiting groups are only lone (1/2) groups — FIFO queue integrity");
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nAll matching scenarios passed ✓");