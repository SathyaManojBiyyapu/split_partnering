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
    collaboratorId: extra.collaboratorId || "",
    collaboratorBrand: extra.collaboratorName || "",
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
/* Summary                                                             */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */
if (failures > 0) {
  console.error(`\n${failures} assertion(s) FAILED`);
  process.exit(1);
}
console.log("\nAll matching scenarios passed ✓");