"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase/config";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const sessionId = searchParams.get("session_id");

  const [message, setMessage] = useState("Verifying payment...");

  const phone =
    typeof window !== "undefined"
      ? localStorage.getItem("phone")?.trim()
      : null;

  useEffect(() => {
    if (!groupId || !sessionId || !phone) {
      setMessage("Invalid payment return. Redirecting...");
      setTimeout(() => router.push("/dashboard"), 2000);
      return;
    }

    const finalize = async () => {
      try {
        const verifyRes = await fetch("/api/verify-stripe-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || "Verification failed");
        }

        const paymentsRef = collection(db, "payments");
        const qPay = query(
          paymentsRef,
          where("uid", "==", phone),
          where("groupId", "==", groupId),
          where("status", "==", "pending")
        );

        const paySnap = await getDocs(qPay);

        for (const d of paySnap.docs) {
          await updateDoc(doc(db, "payments", d.id), {
            status: "paid",
            paidAt: serverTimestamp(),
            stripeSessionId: sessionId,
          });
        }

        setMessage("Payment successful! Redirecting to chat...");
        setTimeout(() => router.push(`/chat/${groupId}`), 1500);
      } catch (err) {
        console.error(err);
        setMessage("Payment verification failed. Redirecting...");
        setTimeout(() => router.push(`/payment?groupId=${groupId}`), 2500);
      }
    };

    finalize();
  }, [groupId, sessionId, phone, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <p className="text-lg text-[#FFD166]">{message}</p>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading...
        </div>
      }
    >
      <PaymentSuccessContent />
    </Suspense>
  );
}
