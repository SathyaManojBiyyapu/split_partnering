import { NextResponse } from "next/server";
import admin, { adminDb, adminTimestamp, adminCredentialsConfigured } from "@/firebase/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * SERVER-SIDE user gym/business submission with duplicate prevention.
 *
 * Why a server route (not a client Firestore write):
 *  - userCollaborations is ADMIN-READ-ONLY + admin-created (firestore.rules),
 *    so the client can neither read existing submissions (dup-check) nor
 *    bypass the pending â†’ approved workflow.
 *  - Admin approves via the existing UserCollaborationsPanel, which creates
 *    the live marketplace business for the submitter's city/scope.
 *
 * Flow:
 *  1. Verify caller (Firebase ID token).
 *  2. Validate fields (name, category, subCategory, state, district, city).
 *  3. Duplicate check across userCollaborations (pending/approved) and the
 *     live marketplace list for the same category â€” normalized name + city.
 *  4. Create a PENDING userCollaborations doc (never an official option).
 *     Approved gyms only appear in user selection after admin approval.
 */

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export async function POST(req: Request) {
  try {
    if (!adminCredentialsConfigured) {
      console.error(
        "SUBMIT-GYM ERROR: Firebase admin credentials are not configured. " +
          "Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line service-account JSON) " +
          "in the deployment environment."
      );
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing. Gym submission is temporarily unavailable." },
        { status: 503 }
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // fall through to validation
    }

    const businessName = String(payload?.businessName || "").trim();
    const category = String(payload?.category || "").trim();
    const categorySlug = String(payload?.categorySlug || "").trim();
    const subCategory = String(payload?.subCategory || "").trim();
    let state = String(payload?.state || "").trim();
    let district = String(payload?.district || "").trim();
    let city = String(payload?.city || "").trim();
    const createdBy = String(payload?.createdBy || "").trim();
    const createdByName = String(payload?.createdByName || "").trim();
    const createdByEmail = String(payload?.createdByEmail || "").trim();
    const createdByPhone = String(payload?.createdByPhone || "").trim();

    if (!businessName || businessName.length < 2 || businessName.length > 100) {
      return NextResponse.json({ error: "Please enter a valid gym/business name (2-100 characters)." }, { status: 400 });
    }
    if (!category) return NextResponse.json({ error: "Category is required." }, { status: 400 });
    if (!state || !district || !city) {
      return NextResponse.json({ error: "Please complete your profile with State, District, and City first." }, { status: 400 });
    }
    // --- Authenticate the caller ---
    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let callerPhone = "";
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded.phone_number) {
        callerPhone = decoded.phone_number.replace(/^\+91/, "").trim();
      }
    } catch (error: any) {
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }
    const submitterPhone = callerPhone || createdByPhone || createdBy || "anonymous";
    const submitterName = createdByName || "Anonymous";

    /* --- AUTHORITATIVE LOCATION: the authenticated user's saved profile ---
       The client payload can carry a wrong fallback (e.g. district used as
       city when the profile save had failed). The Firestore profile is the
       source of truth for State → District → City, so a gym submitted from
       Tenali is stored under Tenali — never the district name. */
    if (callerPhone) {
      let userSnap = await adminDb.collection("users").doc(callerPhone).get();
      if (!userSnap.exists) {
        // Legacy docs are keyed as "91XXXXXXXXXX" — try that form too.
        userSnap = await adminDb.collection("users").doc(`91${callerPhone}`).get();
      }
      const up = (userSnap.data() || {}) as any;
      const pState = String(up?.state || "").trim();
      const pDistrict = String(up?.district || "").trim();
      const pCity = String(up?.city || "").trim();
      if (!pState || !pDistrict || !pCity) {
        return NextResponse.json(
          { error: "Please complete your profile with State, District, and City first." },
          { status: 400 }
        );
      }
      state = pState;
      district = pDistrict;
      city = pCity;
    }

    // --- Duplicate check (normalized name + category + city) ---
    const dupName = norm(businessName);

    // 1. Existing pending/approved submissions in userCollaborations
    const userCollabSnap = await adminDb
      .collection("userCollaborations")
      .where("category", "==", category)
      .limit(200)
      .get();

    for (const d of userCollabSnap.docs) {
      const c = d.data() as any;
      const st = String(c?.status || "").toLowerCase();
      if (st !== "pending" && st !== "approved") continue;
      const cCity = String(c?.city || "").trim().toLowerCase();
      if (cCity !== city.toLowerCase()) continue;
      if (norm(c?.businessName) === dupName) {
        return NextResponse.json(
          {
            error:
              st === "approved"
                ? `"${businessName}" is already available in ${city}. Please select it from the list.`
                : `"${businessName}" was already submitted for ${city} and is pending admin approval.`,
          },
          { status: 409 }
        );
      }
    }

    // 2. Already-live approved businesses in the marketplace list
    if (categorySlug) {
      const marketSnap = await adminDb
        .collection("marketplace")
        .doc(categorySlug)
        .collection("businesses")
        .limit(300)
        .get();
      for (const d of marketSnap.docs) {
        const b = d.data() as any;
        if (b?.visible === false) continue;
        const bCity = String(b?.city || "").trim().toLowerCase();
        if (bCity !== city.toLowerCase()) continue;
        if (norm(b?.businessName) === dupName) {
          return NextResponse.json(
            { error: `"${businessName}" is already available in ${city}. Please select it from the list.` },
            { status: 409 }
          );
        }
      }
    }
    // --- Create the PENDING submission (never an official option until approved) ---
    const ref = adminDb.collection("userCollaborations").doc();
    await ref.set({
      businessName,
      category,
      categorySlug: categorySlug || category.toLowerCase().replace(/\s+/g, "-"),
      subCategory,
      state,
      district,
      city,
      createdBy: submitterPhone,
      createdByName: submitterName,
      createdByEmail,
      createdByPhone: submitterPhone,
      submittedAt: adminTimestamp(),
      status: "pending",
      verified: false,
      image: null,
      source: "user",
    });

    console.log(`SUBMIT-GYM: "${businessName}" (${category}/${subCategory}, ${city}) submitted by ${submitterPhone}`);

    return NextResponse.json(
      { id: ref.id, status: "pending", submitted: true },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(
      "SUBMIT-GYM ERROR:",
      error?.code || "",
      error?.message || error,
      "\n",
      error?.stack || ""
    );
    return NextResponse.json({ error: "Gym submission failed. Please try again." }, { status: 500 });
  }
}
