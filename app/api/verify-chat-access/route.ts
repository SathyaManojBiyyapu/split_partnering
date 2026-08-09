import { NextResponse } from "next/server";
import { adminDb } from "@/firebase/admin";

/**
 * SERVER-SIDE chat access verification.
 * Chat is unlocked ONLY when:
 * 1. The user is a member of the group
 * 2. The user has a VERIFIED payment (status === "paid" && verified === true)
 * 3. The chat exists for that group
 *
 * The frontend alone can never unlock chat — this endpoint is the source of truth.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { uid, groupId } = body;

    if (!uid || !groupId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 1. Check group exists and user is a member
    const groupRef = adminDb.collection("groups").doc(groupId);
    const groupSnap = await groupRef.get();

    if (!groupSnap.exists) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

    const group = groupSnap.data();
    const members = group?.members || [];
    const memberUIDs = group?.memberUIDs || [];
    const isMember = members.some((m: any) => m?.phone === uid || m?.uid === uid) || memberUIDs.includes(uid);

    if (!isMember) {
      return NextResponse.json(
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    // 2. Check verified payment exists
    const paymentsRef = adminDb.collection("payments");
    const paySnap = await paymentsRef
      .where("uid", "==", uid)
      .where("groupId", "==", groupId)
      .where("status", "==", "paid")
      .where("verified", "==", true)
      .limit(1)
      .get();

    const isPaid = !paySnap.empty;

    if (!isPaid) {
      return NextResponse.json(
        { error: "Payment not verified. Please complete payment to unlock chat." },
        { status: 403 }
      );
    }

    // 3. Check chat exists for this group
    const chatsRef = adminDb.collection("chats");
    const chatSnap = await chatsRef
      .where("groupId", "==", groupId)
      .limit(1)
      .get();

    if (chatSnap.empty) {
      return NextResponse.json(
        { error: "Chat not available yet" },
        { status: 404 }
      );
    }

    // Return the chat ID + member info (masked, no phone numbers)
    const chatDoc = chatSnap.docs[0];
    const chatData = chatDoc.data();

    const memberPhones = Array.isArray(chatData?.memberUIDs) ? chatData.memberUIDs : [];
    const maskedMembers = memberPhones.map((p: string) => ({
      userId: `PS-${p.replace(/\D/g, "").slice(-5)}`,
    }));

    return NextResponse.json({
      success: true,
      chatId: chatDoc.id,
      groupId,
      category: group?.category || "",
      option: group?.option || "",
      collaboratorBrand: group?.collaboratorBrand || "",
      members: maskedMembers,
    });
  } catch (error) {
    console.error("Chat access verification error:", error);
    return NextResponse.json(
      { error: "Chat access verification failed" },
      { status: 500 }
    );
  }
}