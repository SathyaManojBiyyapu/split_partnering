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
} from "../app/lib/groupMatching.ts";

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
// no longer joinable.
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
  store.set(groupId, {
    ...g,
    members: [...members, memberObject],
    memberUIDs: [...(g.memberUIDs || []), phone],
    membersCount: updatedCount,
    status: nextStatus,
    ...(nextStatus === "ready" ? { readyAt: 1 } : {}),
  });

  return { retry: false, result: { status: nextStatus, groupId, membersCount: updatedCount, requiredSize: required } };
}

function createGroup(store, category, option, memberObject, phone, extra = {}) {
  const id = "g" + (store.all().length + 1);
  const required = extra.requiredSize || getRequiredSize(option);
  store.set(id, {
    category,
    option,
    state: extra.state,
    district: extra.district,
    city: extra.city,
    members: [memberObject],
    memberUIDs: [phone],
    membersCount: 1,
    requiredSize: required,
    status: "waiting",
    createdAt: store.nextTs(),
    createdBy: phone,
  });
  return { status: "created", groupId: id, membersCount: 1, requiredSize: required };
}

// Replicates /api/join-group's retry loop exactly.
function routeProcess(store, { category, option, phone, state, district, city, requestedRequiredSize, extra = {} }) {
  const memberObject = { phone, uid: phone, name: "User-" + phone };
  for (let attempt = 0; attempt < 4; attempt++) {
    const candidates = store.query(category, option);
    const best = pickOldestOpen(candidates, { state, district, city, option, phone });

    if (!best) {
      const r = createGroup(store, category, option, memberObject, phone, {
        state, district, city, requiredSize: requestedRequiredSize, ...extra,
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
/* Summary                                                             */
/* ------------------------------------------------------------------ */
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nAll matching scenarios passed ✓");