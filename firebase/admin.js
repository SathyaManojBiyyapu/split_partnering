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
    admin.initializeApp({
      projectId: "splitpartnering",
    });
  }
}

export const adminDb = admin.firestore();
export const adminTimestamp = admin.firestore.FieldValue.serverTimestamp;
export default admin;