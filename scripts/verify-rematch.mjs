// Deterministic verification of FIFO re-matching after payment +
// server-derived SUCCESS/PENDING pairing status (admin + dashboard).
//
// Exact business scenario (Users keyed 9000000001..9000000004):
//   1 + 2 match (FIFO) → 1 pays, 2 unpaid → 3 arrives & pays
//   → 1 + 3 become the ACTIVE PAID pairing (fresh pairingId)  → SUCCESS
//   → 2 re-enters the FIFO pool → 4 joins → 2 + 4             → PENDING
//   → 2 pays  → still PENDING
//   → 4 pays  → SUCCESS, chat unlocked
//
// Run: node scripts/verify-rematch.mjs
import {
  buildRematchPlan,
  findRematchCandidate,
  derivePairingStatus,
  memberPaidStatus,
  memberPaymentRows,
  maskPhoneKey,
} from "../app/lib/rematching.ts";
import {
  pickOldestOpen,
  chatUnlocked,
  isPaidForPairing,
  getPairingId,
  activeMemberPhones,
  resolveRequired,
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

/* ---------------- fixtures (faithful to groupMatching semantics) -------- */
const U1 = "9000000001", U2 = "9000000002", U3 = "9000000003", U4 = "9000000004";
const ts = (s) => ({ seconds: s, nanoseconds: 0 });
const doc = (id, data) => ({ id, data: () => data, ref: { id } });
const BASE = { category: "gym", option: "split", state: "Andhra Pradesh", district: "Prakasam", city: "Addanki", collaboratorId: "", requiredSize: 2 };

// G1: User 1 + User 2, 2/2 ready; User 1 paid, User 2 NOT paid.
const G1 = {
  ...BASE,
  id: "G1",
  members: [{ phone: U1 }, { phone: U2 }],
  memberUIDs: [U1, U2],
  membersCount: 2,
  status: "ready",
  createdAt: ts(1000),
  pairingId: "P1",
  memberPayments: { [U1]: { paid: true, pairingId: "P1", paidAt: ts(2000) } },
};

// G2: same criteria EXCEPT different city — must never be a rematch candidate.
const G2 = { ...BASE, id: "G2", city: "Visakhapatnam", members: [{ phone: "9000000099" }], membersCount: 1, status: "waiting", createdAt: ts(500) };

// G3: User 3 waiting alone (1/2) and PAID pre-match (relaxed 1/2 payment gate).
const G3 = {
  ...BASE,
  id: "G3",
  members: [{ phone: U3 }],
  memberUIDs: [U3],
  membersCount: 1,
  status: "waiting",
  createdAt: ts(3000),
  pairingId: "P3",
  memberPayments: { [U3]: { paid: true, pairingId: "P3", paidAt: ts(4000) } },
};

/* ---------------- 1. The exact scenario --------------------------------- */
console.log("\n[1] Scenario: 1+2 match, 1 paid, 3 arrives & pays → rematch");
const plan = buildRematchPlan(G3, U3, [doc("G1", G1), doc("G2", G2), doc("G3", G3)], ts(5000), "G3");
check(!!plan, "rematch plan produced");
check(plan?.swap.groupId === "G1" && plan?.swap.memberKey === U1, "pairs User 3 with PAID User 1 from G1 (never G2 — wrong city)");
const NEW = plan.newGroupData;
check(plan.newPairingId !== "P1" && plan.newPairingId !== "P3", "fresh pairingId (old entitlements can never unlock the new pairing)");
check(activeMemberPhones(NEW).length === 2 && NEW.membersCount === 2 && NEW.status === "ready", "new pairing is 2/2 ready");
check(
  isPaidForPairing(NEW, U1) && isPaidForPairing(NEW, U3),
  "both User 1 and User 3 paid FOR THE NEW pairingId"
);
check(chatUnlocked(NEW) === true, "new pairing: chat unlocked (SUCCESS)");
check(derivePairingStatus(NEW) === "SUCCESS", "admin status = SUCCESS (1+3)");
// plan.myUpdates = the CALLER's vacated group (G3 — User 3 left it)
// plan.partnerUpdates = the CANDIDATE group (G1 — User 1 left it)
const G1after = { ...G1, ...plan.partnerUpdates };
check(activeMemberPhones(G1after).length === 1 && G1after.membersCount === 1 && G1after.status === "waiting", "G1 keeps unpaid User 2 and RE-ENTERS the FIFO pool (waiting)");
check(!(U1 in G1after.memberPayments), "User 1's payment key removed from old group");
check(isPaidForPairing(G1after, U1) === false, "User 1's OLD payment can never unlock the old pairing (pairingId protection)");
check(isPaidForPairing(G1after, U2) === false, "unpaid User 2 stays unpaid and FIFO-matchable");
check(chatUnlocked(G1after) === false, "old pairing stays locked");
const G3after = { ...G3, ...plan.myUpdates };
check(activeMemberPhones(G3after).length === 0 && G3after.status === "closed", "User 3's vacated group closed");

/* ---------------- 2. User 2 + User 4 → PENDING pairing ------------------- */
console.log("\n[2] User 2 re-enters FIFO pool; User 4 joins → PENDING pairing");
// User 4 joins the vacated G1 (now waiting with only User 2) via the normal
// join flow: 2/2 ready, nobody paid yet.
const G4 = {
  ...G1after,
  members: [...G1after.members, { phone: U4 }],
  memberUIDs: [...G1after.memberUIDs, U4],
  membersCount: 2,
  status: "ready",
  memberPayments: {},
};
check(derivePairingStatus(G4) === "PENDING", "2 + 4 pairing status = PENDING (2/2, nobody paid)");
check(chatUnlocked(G4) === false, "2 + 4 pairing: chat LOCKED");
check(JSON.stringify(memberPaymentRows(G4)) === JSON.stringify([{ masked: "*****002", status: "PENDING" }, { masked: "*****004", status: "PENDING" }]), "admin rows: both PENDING, phones masked");

// User 2 pays for pairingId P1 → still PENDING (User 4 unpaid)
const G4b = { ...G4, memberPayments: { [U2]: { paid: true, pairingId: "P1", paidAt: ts(6000) } } };
check(derivePairingStatus(G4b) === "PENDING", "User 2 pays → status still PENDING (one-sided payment)");
check(chatUnlocked(G4b) === false, "chat still LOCKED after only User 2 pays");
check(memberPaidStatus(G4b, U2) === "PAID" && memberPaidStatus(G4b, U4) === "PENDING", "admin rows: User 2 = PAID, User 4 = PENDING");

// User 4 pays → SUCCESS, chat unlocks
const G4c = { ...G4b, memberPayments: { ...G4b.memberPayments, [U4]: { paid: true, pairingId: "P1", paidAt: ts(7000) } } };
check(derivePairingStatus(G4c) === "SUCCESS", "User 4 pays → status = SUCCESS");
check(chatUnlocked(G4c) === true, "chat UNLOCKED once both payments confirmed");

/* ---------------- 3. No rematch when pairing is complete ---------------- */
console.log("\n[3] Guard rails");
check(buildRematchPlan(G4c, U2, [doc("G1", G1), doc("G3", G3)], ts(8000), "G1") === null, "no rematch for an already-unlocked (SUCCESS) pairing — completed pairs are never broken");
check(buildRematchPlan({ ...G1, requiredSize: 4 }, U1, [doc("G3", G3)], ts(8000), "G1") === null, "no rematch for non-2-person groups (existing behavior preserved)");
const wrongCat = { ...G3, category: "yoga" };
check(findRematchCandidate(G1, U1, [doc("G3", wrongCat)], "G1") === null, "different category → never a rematch candidate");
const wrongCity = { ...G3, city: "Visakhapatnam" };
check(findRematchCandidate(G1, U1, [doc("G3", wrongCity)], "G1") === null, "different city → never a rematch candidate");
const wrongGym = { ...G3, collaboratorId: "other-gym" };
check(findRematchCandidate({ ...G1, collaboratorId: "my-gym" }, U1, [doc("G3", wrongGym)], "G1") === null, "different marketplace/entity → never a rematch candidate");
const unpaidU3 = { ...G3, memberPayments: {} };
check(findRematchCandidate(G1, U1, [doc("G3", unpaidU3)], "G1") === null, "unpaid candidate member → never a rematch target");

/* ---------------- 4. FIFO order ----------------------------------------- */
console.log("\n[4] FIFO ordering is deterministic (server timestamps, not array order)");
const EA = { ...BASE, id: "EA", pairingId: "PEA", members: [{ phone: "9000000010" }], membersCount: 1, status: "waiting", createdAt: ts(100), memberPayments: { "9000000010": { paid: true, pairingId: "PEA", paidAt: ts(9000) } } };
const EB = { ...BASE, id: "EB", pairingId: "PEB", members: [{ phone: "9000000011" }], membersCount: 1, status: "waiting", createdAt: ts(200), memberPayments: { "9000000011": { paid: true, pairingId: "PEB", paidAt: ts(8000) } } };
// EB's member paid EARLIER (8000 < 9000) even though EA is older and EA comes first in the array.
const MYF = { ...BASE, pairingId: "PMY", members: [{ phone: U1 }], membersCount: 1, memberPayments: { [U1]: { paid: true, pairingId: "PMY", paidAt: ts(7000) } } };
const cand = findRematchCandidate(MYF, U1, [doc("EA", EA), doc("EB", EB)], "my");
check(cand?.doc.id === "EB" && cand?.memberKey === "9000000011", "earliest paidAt wins regardless of array order");

/* ---------------- 5. Masked identity ------------------------------------ */
console.log("\n[5] Privacy");
check(maskPhoneKey(U1) === "*****001" && !maskPhoneKey(U1).includes("9000000001"), "member keys are masked in admin rows (no full phone exposure)");

console.log("\n" + (failures === 0 ? "✓ ALL REMATCH CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`));
process.exit(failures === 0 ? 0 : 1);
