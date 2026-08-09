import { NextResponse } from "next/server";
import admin, { adminDb } from "@/firebase/admin";

const ALLOWED_ADMIN_EMAIL = "sathyamanojbiyyapu@gmail.com";

/**
 * SERVER-SIDE admin verification.
 * Only the authorized admin email passes. All other requests are rejected.
 */
export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "Missing idToken" },
        { status: 400 }
      );
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401 }
      );
    }

    const email = decoded.email || null;

    if (!email || email !== ALLOWED_ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      email,
      uid: decoded.uid,
    });
  } catch (error) {
    console.error("Admin verification error:", error);
    return NextResponse.json(
      { error: "Admin verification failed" },
      { status: 500 }
    );
  }
}