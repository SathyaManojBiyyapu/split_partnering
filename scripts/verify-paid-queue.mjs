// Deterministic verification of the PAYMENT-FIRST marketplace queue
// (Requirement 2) + location-driven matching pool (Requirement 1).
//
// It exercises the SAME shared pure logic that the server queue entry
// (app/lib/serverQueueEntry.ts) imports — app/lib/groupMatching.ts — and
// replicates the entry transaction (pickOldestPaidWaiting → join preserving
// payments / create solo PAID waiting group) against an in-memory store.
//
// Run: node scripts/verify-paid-queue.mjs
import {
  activeMemberPhones,
  chatUnlocked,
  deriveQueueState,
  isGroupMatched,
  matchesLocation,
  paidMemberCountForPairing,
  pickOldestPaidWaiting,
  resolveRequired,
  isPaidForPairing,
} from "../app/lib/groupMatching.ts";

let failures = 0;
function check(cond, label) {
  if (cond) {
    console.log("  ✓ " + label);
  } else {
    failures++;
    console.error("  ✗ FAIL: " + label);
  }
}
const ts = (s) => ({ seconds: s, nanoseconds: 0, toMillis() { return s * 1000; } });

/* ---------------- in-memory store ---------------- */
function makeStore() {
  const docs = new Map();
  let seq = 1;
  return {
    docs,
    nextTs() { return ts(seq++); },
    query(category, option) {
      return [...docs.entries()]
        .filter(([, g]) => g.category === category && g.option === option)
        .map(([id, g]) => ({ id, data: () => g }));
    },
    set(id, g) { docs.set(id, g); },
    get(id) { return docs.get(id); },
  };
}

/* Mirrors enterPaidQueue's transaction: FIFO join the oldest compatible
   PAID waiting group (payments preserved), else create a solo PAID entry. */
function simulateEntry(store, phone, key, at) {
  const candidates = store.query(key.category, key.option);
  const best = pickOldestPaidWaiting(candidates, {
    state: key.state, district: key.district, city: key.city,
    option: key.option, phone, collaboratorId: key.collaboratorId || "",
  });

  if (best) {
    const g = { ...best.data() };
    const pairingId = String(g.pairingId || "");
    const phones = activeMemberPhones(g);
    const nextPhones = [...phones, phone];
    const nextPayments = {
      ...(g.memberPayments || {}),
      [phone]: { paid: true, pairingId, paidAt: at },
    };
    const paidCount = nextPhones.filter((p) =>
      isPaidForPairing({ ...g, memberPayments: nextPayments, pairingId }, p)
    ).length;
    const required = resolveRequired(g, key.option);
    const status = nextPhones.length >= required && paidCount === nextPhones.length ? "ready" : "waiting";
    store.set(best.id, {
      ...g,
      members: [...(g.members || []), { phone }],
      memberUIDs: nextPhones,
      membersCount: nextPhones.length,
      memberPayments: nextPayments,
      status,
    });
    return { groupId: best.id, status, paidCount, requiredSize: required, joined: true };
  }

  // CREATE solo PAID waiting entry
  const pairingId = `p_${phone}_${at.seconds}`;
  const required = key.requiredSize || 2;
  const id = `paidq_${phone}`;
  store.set(id, {
    category: key.category,
    option: key.option,
    state: key.state,
    district: key.district,
    city: key.city,
    collaboratorId: key.collaboratorId || "",
    requiredSize: required,
    members: [{ phone }],
    memberUIDs: [phone],
    membersCount: 1,
    status: "waiting",
    createdAt: at,
    pairingId,
    memberPayments: { [phone]: { paid: true, pairingId, paidAt: at } },
    paidEntry: true,
  });
  return { groupId: id, status: "waiting", paidCount: 1, requiredSize: required, joined: false };
}

const LOC = { state: "Himachal Pradesh", district: "Kullu", city: "Manali" };
const KEY = { category: "gym", option: "split", ...LOC, collaboratorId: "js-gym" };
const U = (n) => `90000000${String(n).padStart(2, "0")}`;

/* ============ SCENARIO 2: ONE PAID USER → WAITING (never confirmed) ============ */
console.log("\n[Scenario 2] User 1 pays → PAID / WAITING (1/2 members paid)");
{
  const store = makeStore();
  const r = simulateEntry(store, U(1), KEY, ts(1000));
  const g = store.get(r.groupId);
  check(r.status === "waiting", "entry status is WAITING (not matched)");
  check(deriveQueueState(g, U(1)) === "PAID_WAITING", "User 1 is PAID_WAITING");
  check(paidMemberCountForPairing(g) === 1 && resolveRequired(g, "split") === 2, "1/2 members paid");
  check(!chatUnlocked(g), "chat is LOCKED (paid ≠ matched)");
  check(isPaidForPairing(g, U(1)), "User 1 is marked PAID for the current pairing");
}

/* ============ SCENARIO 3: SECOND PAID USER → MATCH CONFIRMED ============ */
console.log("\n[Scenario 3] User 17 pays (compatible) → 2/2 paid → MATCH CONFIRMED");
{
  const store = makeStore();
  simulateEntry(store, U(1), KEY, ts(1000));
  const r = simulateEntry(store, U(17), KEY, ts(2000));
  const g = store.get(r.groupId);
  check(r.joined === true, "User 17 FIFO-joined User 1's paid waiting group");
  check(r.status === "ready" && isGroupMatched(g), "group is complete (2/2)");
  check(paidMemberCountForPairing(g) === 2, "2/2 members PAID");
  check(chatUnlocked(g), "MATCH CONFIRMED → chat unlocked for both");
  check(deriveQueueState(g, U(1)) === "MATCHED" && deriveQueueState(g, U(17)) === "MATCHED", "both users are MATCHED");
  const again = pickOldestPaidWaiting(
    store.query(KEY.category, KEY.option),
    { ...KEY, phone: U(99) }
  );
  check(again === null, "confirmed users are removed from the queue — no re-match for the same pairing");
}

/* ============ SCENARIO 4: MULTIPLE WAITING USERS (FIFO + compatibility) ============ */
console.log("\n[Scenario 4] Multiple paid waiting users; FIFO order + compatibility enforced");
{
  const store = makeStore();
  // Three PAID/WAITING users at three DIFFERENT gyms (pairwise incompatible).
  const r1 = simulateEntry(store, U(1), KEY, ts(1000));
  const r8 = simulateEntry(store, U(8), { ...KEY, collaboratorId: "other-gym" }, ts(1500));
  const r17 = simulateEntry(store, U(17), { ...KEY, collaboratorId: "gym-c" }, ts(2000));
  check(r1.joined === false && r8.joined === false && r17.joined === false,
    "U1, U8, U17 wait in separate queue entries (1/2 each — pairwise incompatible)");

  // User 21 pays at JS Gym → must join the OLDEST compatible PAID waiting
  // group (User 1's), never User 8's (different gym).
  const r21 = simulateEntry(store, U(21), KEY, ts(3000));
  check(r21.groupId === r1.groupId, "User 21 FIFO-matched with User 1 (oldest first)");
  check(r21.status === "ready" && chatUnlocked(store.get(r21.groupId)), "U1 + U21 confirmed (2/2 paid)");

  // User 3 pays at gym-c → joins User 17's waiting entry.
  const r3 = simulateEntry(store, U(3), { ...KEY, collaboratorId: "gym-c" }, ts(4000));
  check(r3.groupId === r17.groupId, "User 3 FIFO-matched with User 17");
  check(chatUnlocked(store.get(r3.groupId)), "U17 + U3 confirmed");

  // User 22 pays at JS Gym — the only remaining waiter (U8) is at a
  // different gym → must NOT be matched; a fresh solo entry is created.
  const r22 = simulateEntry(store, U(22), KEY, ts(5000));
  check(r22.joined === false, "incompatible waiting users are never matched (gym key)");
  const g22 = store.get(r22.groupId);
  check(matchesLocation(g22, LOC.state, LOC.district, LOC.city) === true, "new entry carries the SAME location key");
}

/* ============ SCENARIO 5: UNPAID USERS ============ */
console.log("\n[Scenario 5] Unpaid users never count, never confirm, never unlock");
{
  const store = makeStore();
  const r = simulateEntry(store, U(1), KEY, ts(1000));
  const g = store.get(r.groupId);

  // A legacy UNPAID member joins the same group (old free-join path).
  store.set(r.groupId, {
    ...g,
    members: [...g.members, { phone: U(2) }],
    memberUIDs: [...g.memberUIDs, U(2)],
    membersCount: 2,
    status: "ready",
  });
  const gFull = store.get(r.groupId);
  check(isGroupMatched(gFull), "legacy full group (2 members)");
  check(paidMemberCountForPairing(gFull) === 1, "unpaid member does NOT count toward members paid (1/2)");
  check(!chatUnlocked(gFull), "unpaid user does NOT create a confirmed match — chat stays locked");

  // pickOldestPaidWaiting must SKIP groups containing unpaid members —
  // a paying user is never paired into a group with an unpaid holder.
  const pick = pickOldestPaidWaiting(
    store.query(KEY.category, KEY.option),
    { ...KEY, phone: U(30) }
  );
  check(pick === null, "a paying user never joins a group that contains unpaid members");
  check(deriveQueueState(gFull, U(2)) === "PENDING_PAYMENT", "unpaid member is PENDING_PAYMENT (not PAID_WAITING, not MATCHED)");
}

/* ============ DUPLICATE / RE-ENTRY SAFETY ============ */
console.log("\n[Integrity] duplicate entries");
{

/* ============ REQUIREMENT 1: location drives the matching pool ============ */
console.log("\n[Location] new saved location → new matching pool; old city never leaks");
{
  const store = makeStore();
  // User 1 paid & waiting in Himachal (their CURRENT saved location).
  simulateEntry(store, U(1), KEY, ts(1000));
  // A stale queue entry still tagged with the OLD location (AP/Guntur/Tenali).
  store.set("stale-ap", {
    category: "gym", option: "split",
    state: "Andhra Pradesh", district: "Guntur", city: "Tenali",
    collaboratorId: "js-gym", requiredSize: 2,
    members: [{ phone: U(50) }], memberUIDs: [U(50)], membersCount: 1,
    status: "waiting", createdAt: ts(500), // OLDER than User 1 → would win FIFO if location were ignored
    pairingId: "p_old", memberPayments: { [U(50)]: { paid: true, pairingId: "p_old" } },
  });

  // User 17 (Himachal) pays → candidates are filtered by THEIR current
  // location: the old-city entry must never be picked.
  const r = simulateEntry(store, U(17), KEY, ts(2000));
  check(r.groupId !== "stale-ap", "old-location (Tenali) entries never join the new-location pool");
  check(matchesLocation(store.get(r.groupId), LOC.state, LOC.district, LOC.city), "User 17 paired within the Himachal pool");

  // And a user whose CURRENT location is the old city matches only there.
  const oldKey = { ...KEY, state: "Andhra Pradesh", district: "Guntur", city: "Tenali" };
  const rOld = simulateEntry(store, U(51), oldKey, ts(3000));
  check(rOld.groupId === "stale-ap", "Tenali users still match within Tenali (location-isolated pools)");
  const cross = pickOldestPaidWaiting(
    store.query("gym", "split"),
    { ...KEY, phone: U(60) } // Himachal user — the Tenali entry is invisible
  );
  check(!cross || cross.id !== "stale-ap", "cross-location leak impossible (matchesLocation guard)");
}

/* ============ GROUP SIZES > 2 (configurable) ============ */
console.log("\n[Configurable size] 3-member partnership: 1/3, 2/3 waiting; 3/3 confirmed");
{
  const store = makeStore();
  const key3 = { ...KEY, requiredSize: 3 };
  const a = simulateEntry(store, U(1), key3, ts(1000));
  const b = simulateEntry(store, U(2), key3, ts(2000));
  check(a.status === "waiting" && b.joined && b.status === "waiting", "1/3 and 2/3 → still WAITING");
  check(paidMemberCountForPairing(store.get(b.groupId)) === 2 && !chatUnlocked(store.get(b.groupId)), "2/3 paid — not confirmed yet");
  const c = simulateEntry(store, U(3), key3, ts(3000));
  check(c.status === "ready" && chatUnlocked(store.get(c.groupId)), "3/3 paid → confirmed + chat unlocked");
}

console.log("\n" + (failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`));
process.exit(failures === 0 ? 0 : 1);

  const store = makeStore();
  simulateEntry(store, U(1), KEY, ts(1000));
  // The paid user's own group is excluded from candidate selection for
  // themselves (no self-join / no second queue entry via the FIFO path).
  const self = pickOldestPaidWaiting(
    store.query(KEY.category, KEY.option),
    { ...KEY, phone: U(1) }
  );
  check(self === null, "a paid waiting user is never FIFO-matched with their own entry (isMember guard)");
}

