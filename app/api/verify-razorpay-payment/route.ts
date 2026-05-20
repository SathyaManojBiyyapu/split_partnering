import { NextResponse } from "next/server";
import crypto from "crypto";

import { db } from "@/firebase/config";

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  addDoc,
} from "firebase/firestore";

/* =========================
   GET RAZORPAY SECRET
========================= */

function getRazorpaySecret(): string {
  const secret =
    process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new Error(
      "RAZORPAY_KEY_SECRET is not set"
    );
  }

  return secret;
}

/* =========================
   VERIFY SIGNATURE
========================= */

function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {

  const expected =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        `${orderId}|${paymentId}`
      )
      .digest("hex");

  return expected === signature;
}

/* =========================
   VERIFY PAYMENT API
========================= */

export async function POST(
  req: Request
) {
  try {

    const secret =
      getRazorpaySecret();

    const body =
      await req.json();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      uid,
      groupId,
    } = body;

    /* =========================
       VALIDATION
    ========================= */

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !uid ||
      !groupId
    ) {

      return NextResponse.json(
        {
          error:
            "Missing required fields",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       VERIFY SIGNATURE
    ========================= */

    const valid =
      verifySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        secret
      );

    if (!valid) {

      return NextResponse.json(
        {
          error:
            "Invalid payment signature",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       FIND PENDING PAYMENT
    ========================= */

    const paymentsRef =
      collection(
        db,
        "payments"
      );

    const pendingQuery =
      query(
        paymentsRef,

        where(
          "uid",
          "==",
          uid
        ),

        where(
          "groupId",
          "==",
          groupId
        ),

        where(
          "status",
          "==",
          "pending"
        )
      );

    const pendingSnap =
      await getDocs(
        pendingQuery
      );

    if (pendingSnap.empty) {

      return NextResponse.json(
        {
          error:
            "No pending payment found",
        },
        {
          status: 404,
        }
      );
    }

    /* =========================
       UPDATE PAYMENT
    ========================= */

    for (const docSnap of pendingSnap.docs) {

      await updateDoc(
        docSnap.ref,
        {
          status: "paid",

          verified: true,

          paidAt:
            new Date(),

          razorpayPaymentId:
            razorpay_payment_id,

          razorpayOrderId:
            razorpay_order_id,
        }
      );
    }

    /* =========================
       CHECK GROUP
    ========================= */

    const groupRef =
      doc(
        db,
        "groups",
        groupId
      );

    const groupSnap =
      await getDoc(
        groupRef
      );

    if (groupSnap.exists()) {

      const groupData =
        groupSnap.data();

      const members =
        groupData.members ||
        [];

      /* =========================
         CHECK PAID USERS
      ========================= */

      const paidQuery =
        query(
          paymentsRef,

          where(
            "groupId",
            "==",
            groupId
          ),

          where(
            "status",
            "==",
            "paid"
          )
        );

      const paidSnap =
        await getDocs(
          paidQuery
        );

      /* =========================
         COMPLETE GROUP
      ========================= */

      if (
        paidSnap.size >=
          members.length &&
        members.length > 0
      ) {

        await updateDoc(
          groupRef,
          {
            status:
              "completed",

            completedAt:
              new Date(),

            lastActivityAt:
              new Date(),
          }
        );

        /* =========================
           CREATE CHAT
        ========================= */

        const chatsRef =
          collection(
            db,
            "chats"
          );

        const chatQuery =
          query(
            chatsRef,

            where(
              "groupId",
              "==",
              groupId
            )
          );

        const chatSnap =
          await getDocs(
            chatQuery
          );

        if (chatSnap.empty) {

          await addDoc(
            chatsRef,
            {
              groupId,

              members,

              createdAt:
                new Date(),

              isActive:
                true,

              lastMessage:
                "",

              lastMessageAt:
                new Date(),
            }
          );
        }
      }
    }

    /* =========================
       SUCCESS
    ========================= */

    return NextResponse.json({
      success: true,

      paymentId:
        razorpay_payment_id,
    });

  } catch (error) {

    console.error(
      "Razorpay verification error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Payment verification failed",
      },
      {
        status: 500,
      }
    );
  }
}