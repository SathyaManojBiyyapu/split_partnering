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
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
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
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

export const adminDb = admin.firestore();
export const adminTimestamp = admin.firestore.FieldValue.serverTimestamp;
export default admin;