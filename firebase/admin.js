import admin from "firebase-admin";
import fs from "node:fs";
import path from "node:path";

/* ---------------- FIREBASE ADMIN INIT ---------------- */

// Service-account credentials are resolved in this order:
//   1. FIREBASE_SERVICE_ACCOUNT_KEY   → full service-account JSON as a single-line string
//   2. FIREBASE_SERVICE_ACCOUNT_PATH  → explicit path to a service-account JSON file
//   3. GOOGLE_APPLICATION_CREDENTIALS → standard Google default-credentials file path
//   4. ./firebase-service-account.json→ file dropped in the project root (dev convenience)
//   5. ./service-account.json         → generic fallback file name in the project root
//
// If none are found we fall back to Application Default Credentials, which only
// works on Google-hosted infrastructure (Cloud Run / App Hosting / GCE) — NOT on
// Vercel. Place the JSON you download from Firebase Console →
// Project settings → Service accounts → Generate new private key as
// `firebase-service-account.json` in the project root to enable adminDb locally.

function resolveServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    return normalizeServiceAccount(sa);
  }

  // Alternative: three discrete env vars — avoids whole-JSON paste mangling.
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return normalizeServiceAccount({
      project_id: process.env.FIREBASE_PROJECT_ID || "splitpartnering",
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY,
    });
  }

  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(process.cwd(), "firebase-service-account.json"),
    path.join(process.cwd(), "service-account.json"),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        return normalizeServiceAccount(JSON.parse(fs.readFileSync(filePath, "utf8")));
      }
    } catch (err) {
      console.warn(
        `[firebase/admin] Could not read service-account file at ${filePath}:`,
        err.message
      );
    }
  }

  return null;
}

/**
 * Fix the classic paste-mangling failure: when the service-account JSON is
 * stored in an env var, the private key's newlines are often stored as literal
 * "\n" two-character sequences. JSON.parse then yields a key whose REAL
 * newlines were double-escaped, and google-auth-library fails only when it
 * actually signs a token — surfacing as an opaque 500 on every admin call.
 * A valid PEM never contains a literal backslash-n, so this replace is safe.
 */
function normalizeServiceAccount(sa) {
  if (sa && typeof sa.private_key === "string" && sa.private_key.includes("\\n")) {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

if (!admin.apps.length) {
  const serviceAccount = resolveServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: use default credentials (works on Firebase/Google Cloud hosting)
    // NOTE: On Vercel there are NO default credentials — Firestore Admin calls
    // will throw "Could not load the default credentials" at runtime. Set
    // FIREBASE_SERVICE_ACCOUNT_KEY (single-line JSON) in the deployment
    // environment, or drop `firebase-service-account.json` in the project root
    // for local development.
    console.warn(
      "[firebase/admin] No service-account credentials found. Falling back to " +
        "Application Default Credentials — this only works on Google-hosted " +
        "infrastructure (Cloud Run / App Hosting / GCE), NOT on Vercel. Set " +
        "FIREBASE_SERVICE_ACCOUNT_KEY in the deployment environment, or place " +
        "firebase-service-account.json in the project root for local development."
    );
    admin.initializeApp({
      projectId: "splitpartnering",
    });
  }
}

/**
 * True when a real service-account credential was resolved at init time.
 * When false, every adminDb call will throw at runtime (no default
 * credentials on Vercel) — API routes use this to fail fast with a clear,
 * actionable error instead of an opaque 500.
 */
export const adminCredentialsConfigured = Boolean(resolveServiceAccount());

export const adminDb = admin.firestore();
export const adminTimestamp = admin.firestore.FieldValue.serverTimestamp;
export default admin;