import { NextResponse } from "next/server";
import Stripe from "stripe";
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

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe signature" },
      { status: 400 }
    );
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error("Webhook secret missing in env");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      endpointSecret
    );
  } catch (err: any) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 }
    );
  }

  /* ---------------------------------
     HANDLE CHECKOUT SUCCESS
  ---------------------------------- */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const uid = session.metadata?.uid;
    const groupId = session.metadata?.groupId;

    if (!uid || !groupId) {
      console.error("Missing metadata in Stripe session");
      return NextResponse.json({ received: true });
    }

    try {
      const paymentsRef = collection(db, "payments");

      const q = query(
        paymentsRef,
        where("uid", "==", uid),
        where("groupId", "==", groupId),
        where("status", "==", "pending")
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        console.log("No pending payment found (maybe already processed).");
      } else {
        for (const docSnap of snap.docs) {
          await updateDoc(docSnap.ref, {
            status: "paid",
            paidAt: new Date(),
            stripeSessionId: session.id,
          });
        }

        console.log("✅ Payment marked as PAID in Firestore");
      }

      /* ---------------------------------
         CHECK IF ALL MEMBERS HAVE PAID
      ---------------------------------- */

      const groupRef = doc(db, "groups", groupId);
      const groupSnap = await getDoc(groupRef);

      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        const members = groupData.members || [];

        const qAllPaid = query(
          paymentsRef,
          where("groupId", "==", groupId),
          where("status", "==", "paid")
        );

        const paidSnap = await getDocs(qAllPaid);

        // If all members have paid → complete group
        if (paidSnap.size >= members.length && members.length > 0) {
          await updateDoc(groupRef, {
            status: "completed",
            completedAt: new Date(),
          });

          console.log("🎉 Group marked as COMPLETED");

          /* ---------------------------------
             CHECK IF CHAT ALREADY EXISTS
          ---------------------------------- */

          const chatsRef = collection(db, "chats");
          const qChat = query(
            chatsRef,
            where("groupId", "==", groupId)
          );

          const chatSnap = await getDocs(qChat);

          if (chatSnap.empty) {
            await addDoc(chatsRef, {
              groupId: groupId,
              members: members,
              createdAt: new Date(),
              isActive: true,
            });

            console.log("💬 Private chat created for group");
          } else {
            console.log("Chat already exists for this group");
          }
        }
      }

    } catch (error) {
      console.error("🔥 Firestore update error:", error);
    }
  }

  return NextResponse.json({ received: true });
}