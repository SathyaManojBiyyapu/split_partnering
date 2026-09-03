/**
 * Local Firebase Admin diagnostic — run with:  node scripts/diagnose-admin.mjs
 *
 * Loads env vars exactly the way Next.js does (.env.local, .env), initializes
 * firebase-admin the same way firebase/admin.js does, then attempts:
 *   1. Credential resolution + JSON parse
 *   2. initializeApp + cert()
 *   3. A real Firestore read (forces OAuth JWT signing — the step that fails
 *      when the private key is mangled)
 *   4. verifyIdToken with a dummy token (should fail with Invalid token, which
 *      is EXPECTED and fine)
 *
 * Prints ONLY error codes/messages and sanitized key metadata — never the
 * secret itself.
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local"), ...process.env };

console.log("=== 1. Credential resolution ===");
const raw = env.FIREBASE_SERVICE_ACCOUNT_KEY;
if (!raw) {
  console.log("FIREBASE_SERVICE_ACCOUNT_KEY: NOT SET (this is the production bug if Vercel is the same)");
  process.exit(0);
}
console.log(`FIREBASE_SERVICE_ACCOUNT_KEY: set, length=${raw.length}`);

let sa;
try {
  sa = typeof raw === "string" ? JSON.parse(raw) : raw;
  console.log("JSON.parse: OK");
} catch (e) {
  console.log(`JSON.parse: FAILED → ${e.message}`);
  console.log(">>> ROOT CAUSE: the key is not valid JSON. Re-copy the FULL service-account JSON as a single line.");
  process.exit(1);
}

const required = ["project_id", "client_email", "private_key"];
for (const f of required) {
  if (!sa[f]) {
    console.log(`Field "${f}": MISSING`);
    console.log(">>> ROOT CAUSE: not a complete service-account JSON.");
    process.exit(1);
  }
}
console.log(`project_id: ${sa.project_id}`);
console.log(`client_email: ${sa.client_email}`);

const pk = sa.private_key;
const hasRealNewlines = pk.includes("\n");
const hasEscaped = pk.includes("\\n");
console.log(`private_key length: ${pk.length}, real-newlines: ${hasRealNewlines}, \\n-escaped: ${hasEscaped}`);
if (!pk.startsWith("-----BEGIN PRIVATE KEY-----")) {
  console.log(">>> ROOT CAUSE: private_key does not look like a PEM key.");
  process.exit(1);
}
if (!hasRealNewlines && !hasEscaped) {
  console.log(">>> ROOT CAUSE: private_key has NO line breaks at all (single line). The key is mangled.");
  process.exit(1);
}

console.log("\n=== 2. initializeApp + cert() ===");
const admin = (await import("firebase-admin")).default;
if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    console.log("initializeApp + cert(): OK");
  } catch (e) {
    console.log(`initializeApp FAILED → ${e.code || ""} ${e.message}`);
    process.exit(1);
  }
}

console.log("\n=== 3. Real Firestore read (forces OAuth token signing) ===");
try {
  const snap = await admin.firestore().collection("users").limit(1).get();
  console.log(`Firestore read: OK (${snap.size} doc(s) sampled)`);
} catch (e) {
  console.log(`Firestore read FAILED → ${e.code || ""} ${e.message}`);
  console.log(">>> This is the exact error that surfaces as a 500 on /api/join-group.");
  process.exit(1);
}

console.log("\n=== 4. verifyIdToken sanity (dummy token → expect 'Invalid token') ===");
try {
  await admin.auth().verifyIdToken("dummy.token.value");
  console.log("verifyIdToken: unexpectedly succeeded");
} catch (e) {
  console.log(`verifyIdToken rejected dummy token as expected → ${e.code || ""} (auth works)`);
}

console.log("\n=== RESULT: credentials are fully functional locally ===");
process.exit(0);
