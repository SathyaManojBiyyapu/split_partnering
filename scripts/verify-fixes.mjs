// Deterministic verification of the three fixes:
//   1. Profile-save doc-ID convergence (client-claimed own doc is honored,
//      attacker-claimed foreign doc is rejected).
//   2. userLookup pinned phoneDocId candidate gating.
//   3. User-collaboration hierarchy grouping + case-insensitive status.
// Run: node scripts/verify-fixes.mjs
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
/* 1. /api/save-profile route helpers (faithful replicas)             */
/* ------------------------------------------------------------------ */
function ownDocCandidates(decoded) {
  const candidates = [];
  const rawPhone = typeof decoded?.phone_number === "string" ? decoded.phone_number : "";
  let canonical = rawPhone ? rawPhone.replace(/[^0-9]/g, "") : "";
  if (canonical.length === 12 && canonical.startsWith("91")) canonical = canonical.slice(2);
  if (canonical.length === 11 && canonical.startsWith("0")) canonical = canonical.slice(1);

  if (canonical) candidates.push(canonical);
  if (rawPhone && !candidates.includes(rawPhone)) candidates.push(rawPhone);
  const legacy = canonical && canonical.length === 10 ? `91${canonical}` : "";
  if (legacy && !candidates.includes(legacy)) candidates.push(legacy);
  if (decoded?.uid && !candidates.includes(decoded.uid)) candidates.push(decoded.uid);
  return candidates;
}

function isClaimedOwnDoc(decoded, claimedDocId) {
  if (!claimedDocId) return false;
  if (claimedDocId === decoded?.uid) return true;
  const rawPhone = typeof decoded?.phone_number === "string" ? decoded.phone_number : "";
  if (!rawPhone) return false;
  let canonical = rawPhone.replace(/[^0-9]/g, "");
  if (canonical.length === 12 && canonical.startsWith("91")) canonical = canonical.slice(2);
  if (canonical.length === 11 && canonical.startsWith("0")) canonical = canonical.slice(1);
  const legacy = canonical && canonical.length === 10 ? `91${canonical}` : "";
  return claimedDocId === canonical || claimedDocId === rawPhone || claimedDocId === legacy;
}

// Simulated resolution: claimed own doc (existing), else token candidates.
function resolveTargetDoc(decoded, claimedDocId, docExists) {
  if (claimedDocId && isClaimedOwnDoc(decoded, claimedDocId) && docExists(claimedDocId)) {
    return claimedDocId;
  }
  for (const id of ownDocCandidates(decoded)) {
    if (docExists(id)) return id;
  }
  const first = ownDocCandidates(decoded)[0] || decoded?.uid;
  return first || null;
}

console.log("\n== Issue 1: profile save doc-ID convergence ==");
{
  // OTP token + client resolved canonical doc → write lands on the doc the client reads.
  const otp = { phone_number: "+919876543210", uid: "uidA" };
  const exists = (id) => id === "9876543210";
  check(
    resolveTargetDoc(otp, "9876543210", exists) === "9876543210",
    "OTP user: claimed canonical doc id honored (same doc the client reads)"
  );

  // Doc keyed under +91 form (raw) → claimed doc honored.
  const existsPlus = (id) => id === "+919876543210" || id === "9876543210";
  check(
    resolveTargetDoc(otp, "+919876543210", existsPlus) === "+919876543210",
    "OTP user: +91-keyed doc honored (no new duplicate doc created)"
  );

  // Legacy 91XXXXXXXXXX keyed doc → honored.
  const existsLegacy = (id) => id === "919876543210";
  check(
    resolveTargetDoc(otp, "919876543210", existsLegacy) === "919876543210",
    "OTP user: legacy 91XXXXXXXXXX doc honored"
  );

  // Google user (no phone claim) with UID-keyed doc → claimed uid honored.
  const google = { uid: "uidGoogle", phone_number: undefined };
  const existsUid = (id) => id === "uidGoogle" || id === "9876543210";
  check(
    resolveTargetDoc(google, "uidGoogle", existsUid) === "uidGoogle",
    "Google user: UID-keyed doc honored (reads and write converge)"
  );

  // Attacker with Google token claiming a FOREIGN 10-digit doc → REJECTED:
  // the foreign doc is never consulted; fallback resolves to the caller's own
  // UID candidate.
  let foreignQueried = false;
  const existsForeign = (id) => {
    if (id === "9999999999") {
      foreignQueried = true;
      return true;
    }
    return id === "uidGoogle";
  };
  check(
    resolveTargetDoc(google, "9999999999", existsForeign) === "uidGoogle",
    "Security: foreign phone docId claim rejected for phone-less token (fallback to own candidates)"
  );
  check(
    foreignQueried === false,
    "Security: the foreign doc was never even read by the resolver"
  );
  check(
    isClaimedOwnDoc(google, "9999999999") === false,
    "Security: claimed foreign docId never considered own for a Google token"
  );
  check(
    isClaimedOwnDoc(otp, "9999999999") === false,
    "Security: a phone claim never authorizes a different phone's doc"
  );
}

/* ------------------------------------------------------------------ */
/* 2. userLookup pinned phoneDocId candidate gating (faithful replica) */
/* ------------------------------------------------------------------ */
console.log("\n== Issue 1: userLookup pinned phoneDocId candidate ==");
{
  function pinnedCandidates({ phone, raw, uid, phoneDocId }) {
    const candidates = [];
    if (phoneDocId && phoneDocId !== phone && !candidates.includes(phoneDocId)) {
      const pinnedIsOwn =
        phoneDocId === uid ||
        phoneDocId === raw ||
        (phone && phoneDocId === phone) ||
        (phone && phoneDocId === "+91" + phone) ||
        (phone && phoneDocId === "91" + phone);
      if (pinnedIsOwn) candidates.push(phoneDocId);
    }
    if (phone) candidates.push(phone);
    if (raw && raw !== phone) candidates.push(raw);
    const withCC = phone ? "+91" + phone : "";
    if (withCC && !candidates.includes(withCC)) candidates.push(withCC);
    if (uid && !candidates.includes(uid)) candidates.push(uid);
    return candidates;
  }

  // After a server save wrote to users/<uid>, reads must prefer that pinned doc.
  check(
    pinnedCandidates({ phone: "9876543210", raw: "9876543210", uid: "uidA", phoneDocId: "uidA" })[0] === "uidA",
    "pinned uid doc becomes the first read candidate (matches server write)"
  );
  // A stale/cross-account pinned id is NOT honored as a candidate.
  check(
    !pinnedCandidates({ phone: "9876543210", raw: "9876543210", uid: "uidA", phoneDocId: "9999999999" }).includes("9999999999"),
    "foreign pinned docId is never used as a read candidate"
  );
  // Normal OTP user without a pinned id keeps the canonical phone first.
  check(
    pinnedCandidates({ phone: "9876543210", raw: "9876543210", uid: "uidA", phoneDocId: "" })[0] === "9876543210",
    "canonical phone stays the first candidate when nothing was pinned"
  );
}

/* ------------------------------------------------------------------ */
/* 3. Collaboration hierarchy + case-insensitive status                */
/* ------------------------------------------------------------------ */
console.log("\n== Issue 3: collaboration hierarchy grouping ==");
{
  const statusKey = (c) => String(c?.status || "pending").toLowerCase();
  const groupByHierarchy = (collabs) => {
    const groups = new Map();
    for (const c of collabs) {
      const category = (c.category || "Uncategorized").trim();
      const subCategory = (c.subCategory || "").trim();
      const key = `${category}::${subCategory}`;
      if (!groups.has(key)) groups.set(key, { category, subCategory, children: [] });
      groups.get(key).children.push(c);
    }
    return Array.from(groups.values())
      .map((g) => ({
        ...g,
        children: g.children.sort(
          (a, b) => ((b.submittedAt && b.submittedAt.seconds) || 0) - ((a.submittedAt && a.submittedAt.seconds) || 0)
        ),
      }))
      .sort((a, b) => a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory));
  };

  const rows = [
    { businessName: "JS Gym", category: "Gym", subCategory: "Personal Trainer Split", status: "pending", submittedAt: { seconds: 3 } },
    { businessName: "ABC Fitness", category: "Gym", subCategory: "Personal Trainer Split", status: "pending", submittedAt: { seconds: 2 } },
    { businessName: "XYZ Training Center", category: "Gym", subCategory: "Personal Trainer Split", status: "pending", submittedAt: { seconds: 1 } },
    { businessName: "Gold Gym", category: "Gym", subCategory: "Gym Membership Split", status: "Pending", submittedAt: { seconds: 4 } },
  ];
  const groups = groupByHierarchy(rows);
  const splitGroup = groups.find((g) => g.subCategory === "Personal Trainer Split");
  check(
    splitGroup.children.length === 3,
    "Gym → Personal Trainer Split has all 3 user-created children (JS Gym, ABC Fitness, XYZ Training Center)"
  );
  check(
    splitGroup.children.map((g) => g.businessName).join(",") === "JS Gym,ABC Fitness,XYZ Training Center",
    "children are displayed under category → collaboration → child hierarchy"
  );
  check(groups.length === 2, "records are grouped by category → subcategory");
  check(
    [statusKey({ status: "Pending" }), statusKey({ status: "APPROVED" }), statusKey({ status: "pending" })].join(",") ===
      "pending,approved,pending",
    "status matching is case-insensitive (Pending/PENDING/pending)"
  );
}

console.log(failures === 0 ? "\nAll fix scenarios passed ✓" : `\n${failures} fix scenario(s) FAILED ✗`);
process.exit(failures === 0 ? 0 : 1);

