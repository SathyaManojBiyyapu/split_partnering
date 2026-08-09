"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const groupId = searchParams.get("groupId");
  const sessionId = searchParams.get("session_id");

  const [message, setMessage] = useState("Verifying payment...");
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");

  const phone =
    typeof window !== "undefined" ? localStorage.getItem("phone")?.trim() : null;

  useEffect(() => {
    if (!groupId || !sessionId || !phone) {
      setMessage("Invalid payment return. Redirecting to dashboard...");
      setStatus("failed");
      setTimeout(() => router.push("/dashboard"), 2000);
      return;
    }

    const finalize = async () => {
      try {
        // 1. Verify session with Stripe server-side
        const verifyRes = await fetch("/api/verify-stripe-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const verifyData = await verifyRes.json();

        if (!verifyRes.ok || !verifyData.success) {
          throw new Error(verifyData.error || "Verification failed");
        }

        // Verify the returned uid matches the logged in user
        if (verifyData.uid && verifyData.uid !== phone) {
          throw new Error("Payment user mismatch");
        }

        // 2. Confirm payment doc was finalized server-side (from webhook)
        const payRef = collection(db, "payments");
        const qPay = query(
          payRef,
          where("uid", "==", phone),
          where("groupId", "==", groupId),
          where("status", "==", "paid")
        );
        const snap = await getDocs(qPay);

        if (snap.empty) {
          // Payment may not have been finalized by webhook yet. Verify session again.
          setMessage("Payment confirmed, finalizing...");
          // If webhook hasn't fired yet, redirect to dashboard and let the dashboard reflect status
          setTimeout(() => router.push(`/dashboard`), 1000);
          return;
        }

        setMessage("Payment successful! Redirecting to chat...");
        setStatus("success");
        setTimeout(() => router.push(`/chat/${groupId}`), 1500);
      } catch (err) {
        console.error(err);
        setMessage("Payment verification failed. Redirecting...");
        setStatus("failed");
        setTimeout(() => router.push(`/payment?groupId=${groupId}`), 2500);
      }
    };

    finalize();
  }, [groupId, sessionId, phone, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="text-center px-6">
        <div className="text-7xl mb-6">
          {status === "success" ? "✅" : status === "failed" ? "❌" : "⏳"}
        </div>
        <p className={`text-lg ${status === "failed" ? "text-red-400" : "text-[#FFD166]"}`}>{message}</p>
      </div>
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