import admin from "firebase-admin";

/* ---------------- FIREBASE ADMIN INIT ---------------- */

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!admin.apps.length) {
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: use default credentials (works on Firebase/Google Cloud hosting)
    // NOTE: On Vercel there are NO default credentials — Firestore Admin calls
    // will throw "Could not load the default credentials" at runtime. Set
    // FIREBASE_SERVICE_ACCOUNT_KEY (the full service-account JSON as a string)
    // in the deployment environment.
    console.warn(
      "[firebase/admin] FIREBASE_SERVICE_ACCOUNT_KEY is not set. " +
        "Falling back to Application Default Credentials — this only works on " +
        "Google-hosted infrastructure (Cloud Run / App Hosting / GCE), NOT on Vercel."
    );
    admin.initializeApp({
      projectId: "splitpartnering",
    });
  }
}

export const adminDb = admin.firestore();
export const adminTimestamp = admin.firestore.FieldValue.serverTimestamp;
export default admin;