import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import admin, { adminDb, adminTimestamp, adminCredentialsConfigured } from "@/firebase/admin";
import {
  getRequiredSize,
  maskPhone,
  isMember,
  isOpen,
  resolveRequired,
  memberCount,
  memberList,
  pickOldestOpen,
} from "@/app/lib/groupMatching";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * SERVER-SIDE, ATOMIC, FIRST-COME-FIRST-SERVED group matching.
 *
 * WHY a server route (not client-side):
 *  - firestore.rules grants `groups` updates to ADMINS ONLY, so the client can
 *    never atomically add a member to an existing group.
 *  - Matching must consider state + district + city + category + subcategory,
 *    pick the OLDEST open group first, and be race-safe so two users clicking
 *    simultaneously cannot overfill a group or both create groups.
 *
 * Flow:
 *   1. Verify the caller (Firebase ID token) and resolve the phone number.
 *   2. Load the user's state/district/city from their users doc.
 *   3. Search candidate open groups (same category + option + location),
 *      skipping already-full or self-membered groups, oldest first.
 *   4. If one exists → join it inside adminDb.runTransaction(): re-check
 *      capacity/status/membership atomically, push the member, bump the count,
 *      flip status to "ready" when full, and stamp readyAt.
 *   5. Otherwise → create a NEW single-member "waiting" group w/ location fields.
 *
 * Returns { groupId, status, membersCount, requiredSize }.
 */

// Record a selection document (mirrors the legacy client-side write).
async function recordSelection(data: {
  uid: string; phone: string; groupId: string; category: string; option: string;
  userName: string; status: string; collaboratorId: string; collaboratorName: string;
}) {
  await adminDb.collection("selections").add({
    uid: data.uid,
    phone: data.phone,
    maskedPhone: maskPhone(data.phone),
    userName: data.userName || "Anonymous",
    category: data.category,
    option: data.option,
    collaboratorId: data.collaboratorId || "",
    collaboratorName: data.collaboratorName || "",
    paid: false,
    status: data.status || "created",
    createdAt: adminTimestamp(),
  });
}

// Persist the chosen category/option on the user doc (legacy parity).
async function updateUserCategory(phone: string, category: string, option: string) {
  await adminDb.collection("users").doc(phone).update({
    category: category.replace(/-/g, " "),
    option,
    updatedAt: adminTimestamp(),
  });
}

// Ensure a chat document exists once a group forms.
async function ensureChat(groupId: string, members: any[], memberUIDs: string[]) {
  const existing = await adminDb.collection("chats").where("groupId", "==", groupId).limit(1).get();
  if (!existing.empty) return;
  await adminDb.collection("chats").add({
    groupId,
    createdAt: adminTimestamp(),
    members: members || [],
    memberUIDs: memberUIDs || [],
    lastMessage: "",
    lastMessageAt: adminTimestamp(),
    unreadCounts: {},
    isActive: true,
  });
}

async function loadCurrentUser(cleanPhone: string) {
  const userDoc = await adminDb.collection("users").doc(cleanPhone).get();
  return userDoc.exists ? userDoc.data() : {};
}

export async function POST(req: Request) {
  try {
    // Fail fast with an actionable error when the server has no admin
    // credentials (e.g. FIREBASE_SERVICE_ACCOUNT_KEY missing on Vercel) —
    // otherwise every adminDb call throws and surfaces as an opaque 500.
    if (!adminCredentialsConfigured) {
      console.error(
        "JOIN-GROUP ERROR: Firebase admin credentials are not configured. " +
          "Set FIREBASE_SERVICE_ACCOUNT_KEY (single-line service-account JSON) " +
          "in the deployment environment."
      );
      return NextResponse.json(
        { error: "Server configuration error: Firebase admin credentials missing. Matching is temporarily unavailable." },
        { status: 503 }
      );
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      // fall through to validation below
    }

    const category = String(payload?.category || "").trim();
    const option = String(payload?.option || "").trim();
    const collaboratorId = String(payload?.collaboratorId || "").trim();
    const collaboratorName = String(payload?.collaboratorName || "").trim();
    const customRequiredSize = Number(payload?.requiredSize);
    const requestedRequiredSize = Number.isFinite(customRequiredSize) && customRequiredSize >= 2 && customRequiredSize <= 20
      ? customRequiredSize
      : null;
    const budget = String(payload?.budget || "").trim();
    const dateTime = String(payload?.dateTime || "").trim();
    const description = String(payload?.description || "").trim();
    const notes = String(payload?.notes || "").trim();

    if (!category || !option) {
      return NextResponse.json({ error: "category and option are required" }, { status: 400 });
    }

    const authorization = req.headers.get("authorization") || "";
    const idToken = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* --- Resolve the logged-in user's authoritative phone from the token --- */
    let verifiedPhone = "";
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded.phone_number) {
        verifiedPhone = decoded.phone_number.replace(/^\+91/, "").trim();
      }
    } catch (error: any) {
      // Only genuine token problems are the caller's fault → 401.
      // Credential/infra failures must NOT masquerade as "Invalid token" —
      // rethrow so the 500 handler surfaces the real cause.
      if (String(error?.code || "").startsWith("auth/")) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      throw error;
    }

    const requestedPhone = String(payload?.phone || "").trim();
    const cleanPhone = verifiedPhone || requestedPhone;
    if (!cleanPhone) {
      return NextResponse.json({ error: "Phone number could not be resolved" }, { status: 400 });
    }

    /* --- Load user profile (name + location) --- */
    const userData = await loadCurrentUser(cleanPhone);
    // Matching criteria = exactly what the user selected. Prefer explicit
    // location overrides (Create Group form) and fall back to the profile.
    const state = String(payload?.state || userData?.state || "").trim();
    const district = String(payload?.district || userData?.district || "").trim();
    const city = String(payload?.city || userData?.city || "").trim();

    const memberObject = {
      uid: cleanPhone,
      phone: cleanPhone,
      maskedPhone: maskPhone(cleanPhone),
      name: userData?.name || "User",
      gender: String(userData?.gender || ""),
      photoURL: String(userData?.photoURL || ""),
      // NOTE: Firestore FORBIDS FieldValue.serverTimestamp() inside array
      // fields ("members" is an array) — it throws at write time. Use a real
      // timestamp value instead.
      joinedAt: new Date(),
      online: true,
      paid: false,
      collaboratorId,
      collaboratorName,
    };

    const groupsRef = adminDb.collection("groups");

    /* --- Retry loop: re-scan if a chosen group fills up mid-flight --- */
    for (let attempt = 0; attempt < 4; attempt++) {
      const snap = await groupsRef
        .where("category", "==", category)
        .where("option", "==", option)
        .limit(100)
        .get();

      const best = pickOldestOpen(snap.docs, { state, district, city, option, phone: cleanPhone, collaboratorId });

      if (!best) {
        // ---- No compatible open group → create a brand-new 1/x group ----
        const newRef = groupsRef.doc();
        const required = requestedRequiredSize || getRequiredSize(option);
        await newRef.set({
          category,
          option,
          state,
          district,
          city,
          collaboratorBrand: collaboratorName || "",
          collaboratorId: collaboratorId || "",
          members: [memberObject],
          memberUIDs: [cleanPhone],
          membersCount: 1,
          requiredSize: required,
          status: "waiting",
          createdAt: adminTimestamp(),
          updatedAt: adminTimestamp(),
          lastActivityAt: adminTimestamp(),
          createdBy: cleanPhone,
          totalPaid: 0,
          revenue: 0,
          ...(budget ? { budget } : {}),
          ...(dateTime ? { dateTime } : {}),
          ...(description ? { description } : {}),
          ...(notes ? { notes } : {}),
        });

        await recordSelection({
          uid: cleanPhone, phone: cleanPhone, groupId: newRef.id,
          category, option, userName: memberObject.name,
          status: "created", collaboratorId, collaboratorName,
        });
        await updateUserCategory(cleanPhone, category, option).catch(() => {});

        return NextResponse.json({ groupId: newRef.id, status: "created", membersCount: 1, requiredSize: required });
      }

      // ---- Open compatible group → join ATOMICALLY ----
      const targetRef = best.ref;
      const outcome = await adminDb.runTransaction(async (tx) => {
        const now = await tx.get(targetRef);
        if (!now.exists) return { retry: true, result: null };
        const g = now.data();
        if (!isOpen(g)) return { retry: true, result: null };

        const currentUIDs = Array.isArray(g?.memberUIDs) ? g.memberUIDs : [];
        if (currentUIDs.map((u: any) => String(u).trim()).includes(cleanPhone)) {
          return {
            retry: false,
            result: { status: "already", groupId: targetRef.id, membersCount: memberCount(g), requiredSize: resolveRequired(g, option) },
          };
        }

        const members = memberList(g);
        const required = resolveRequired(g, option);
        if (members.length >= required) return { retry: true, result: null };

        const updatedCount = members.length + 1;
        const nextStatus = updatedCount >= required ? "ready" : "waiting";

        await tx.update(targetRef, {
          members: FieldValue.arrayUnion(memberObject),
          memberUIDs: FieldValue.arrayUnion(cleanPhone),
          membersCount: updatedCount,
          updatedAt: adminTimestamp(),
          lastActivityAt: adminTimestamp(),
          status: nextStatus,
          ...(nextStatus === "ready" ? { readyAt: adminTimestamp() } : {}),
        });

        return {
          retry: false,
          result: { status: nextStatus, groupId: targetRef.id, membersCount: updatedCount, requiredSize: required },
        };
      });

      if (!outcome.retry && outcome.result) {
        const r = outcome.result;
        await recordSelection({
          uid: cleanPhone, phone: cleanPhone, groupId: r.groupId,
          category, option, userName: memberObject.name,
          status: r.status, collaboratorId, collaboratorName,
        });
        await updateUserCategory(cleanPhone, category, option).catch(() => {});
        // Include the full (updated) member list in the chat document.
        const joinedSnap = await adminDb.collection("groups").doc(r.groupId).get();
        const joinedData = joinedSnap.exists ? (joinedSnap.data() ?? {}) : {};
        await ensureChat(
          r.groupId,
          Array.isArray(joinedData.members) ? joinedData.members : [memberObject],
          Array.isArray(joinedData.memberUIDs) ? joinedData.memberUIDs : [cleanPhone]
        ).catch(() => {});
        return NextResponse.json(r);
      }
      // retry → loop again (group filled/closed in the meantime)
    }

    return NextResponse.json({ error: "Could not finalize group after multiple attempts, please try again" }, { status: 409 });
  } catch (error: any) {
    console.error(
      "JOIN-GROUP ERROR:",
      error?.code || "",
      error?.message || error,
      "\n",
      error?.stack || ""
    );
    // Error detail is exposed ONLY outside production (local/dev debugging).
    // Never leak internals to production clients.
    const includeDetail = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: "Matching failed. Please try again.",
        ...(includeDetail
          ? { detail: `${error?.code || "unknown"}: ${String(error?.message || error).slice(0, 300)}` }
          : {}),
      },
      { status: 500 }
    );
  }
}