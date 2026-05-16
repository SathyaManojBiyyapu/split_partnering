"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/firebase/config";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { onAuthStateChanged } from "firebase/auth";

function PaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupId = searchParams.get("groupId");

  const [firebaseUser, setFirebaseUser] =
    useState<any>(null);

  const [groupData, setGroupData] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [processing, setProcessing] =
    useState(false);

  /* ✅ EXISTING PAYMENT */

  const [
    existingPayment,
    setExistingPayment,
  ] = useState(false);

  const PRICE = 29;

  /* -----------------------------
     AUTH LISTENER
  ----------------------------- */

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        if (!user) {
          router.push("/login");
        } else {
          setFirebaseUser(user);

          if (!user.phoneNumber) {
            router.push(
              "/verify-phone"
            );
          }
        }
      }
    );

    return () => unsub();
  }, [router]);

  /* -----------------------------
     FETCH GROUP DATA
  ----------------------------- */

  useEffect(() => {
    if (!groupId) return;

    const fetchGroup = async () => {
      try {
        const snap = await getDoc(
          doc(db, "groups", groupId)
        );

        if (snap.exists()) {
          setGroupData(snap.data());
        } else {
          alert("Group not found");

          router.push("/dashboard");
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    };

    fetchGroup();
  }, [groupId, router]);

  /* -----------------------------
     CHECK EXISTING PAYMENT
  ----------------------------- */

  useEffect(() => {
    if (!firebaseUser || !groupId)
      return;

    const checkExistingPayment =
      async () => {
        try {
          const paymentsRef =
            collection(
              db,
              "payments"
            );

          const qPay = query(
            paymentsRef,
            where(
              "uid",
              "==",
              firebaseUser.uid
            ),
            where(
              "groupId",
              "==",
              groupId
            )
          );

          const snap = await getDocs(
            qPay
          );

          if (!snap.empty) {
            setExistingPayment(true);
          }
        } catch (err) {
          console.error(
            "Payment check error:",
            err
          );
        }
      };

    checkExistingPayment();
  }, [firebaseUser, groupId]);

  /* -----------------------------
     STRIPE PAYMENT
  ----------------------------- */

  const handlePayment =
    async () => {
      if (
        !firebaseUser ||
        !groupData ||
        !groupId
      )
        return;

      try {
        setProcessing(true);

        /* SAVE PAYMENT */

        await addDoc(
          collection(db, "payments"),
          {
            uid: firebaseUser.uid,
            groupId,
            category:
              groupData.category,
            option: groupData.option,
            amount: PRICE,
            status: "pending",
            paymentMethod: "stripe",
            createdAt:
              serverTimestamp(),
          }
        );

        /* STRIPE API */

        const response = await fetch(
          "/api/create-checkout-session",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              amount: PRICE,
              groupId,
              uid: firebaseUser.uid,
            }),
          }
        );

        const data =
          await response.json();

        if (data.url) {
          window.location.href =
            data.url;
        } else {
          alert(
            "Stripe session creation failed ❌"
          );

          setProcessing(false);
        }
      } catch (error) {
        console.error(
          "Stripe payment error:",
          error
        );

        alert("Payment failed ❌");

        setProcessing(false);
      }
    };

  /* -----------------------------
     RAZORPAY PAYMENT
  ----------------------------- */

  const handleRazorpay =
    async () => {
      if (
        !firebaseUser ||
        !groupData ||
        !groupId
      )
        return;

      try {
        setProcessing(true);

        /* SAVE PAYMENT */

        await addDoc(
          collection(db, "payments"),
          {
            uid: firebaseUser.uid,
            groupId,
            category:
              groupData.category,
            option: groupData.option,
            amount: PRICE,
            status: "pending",
            paymentMethod:
              "razorpay",
            createdAt:
              serverTimestamp(),
          }
        );

        /* REDIRECT TO RAZORPAY */

        window.location.href =
          "https://rzp.io/rzp/YOUR_RAZORPAY_LINK";
      } catch (error) {
        console.error(
          "Razorpay error:",
          error
        );

        alert(
          "Razorpay payment failed ❌"
        );

        setProcessing(false);
      }
    };

  /* -----------------------------
     LOADING
  ----------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        Loading Partner Sync
        details...
      </div>
    );
  }

  /* -----------------------------
     UI
  ----------------------------- */

  return (
    <div className="min-h-screen flex items-center justify-center text-white px-4">
      <div
        className="
          bg-black/40
          backdrop-blur-lg
          p-10
          rounded-2xl
          shadow-2xl
          w-[420px]
          border border-[#E6C972]/30
        "
      >
        <h2 className="text-3xl font-bold text-[#E6C972] mb-4">
          Activate Partner Sync
        </h2>

        <p className="text-gray-400 text-sm mb-6">
          Unlock secure coordination
          and verified group
          benefits.
        </p>

        {/* GROUP INFO */}

        {groupData && (
          <div
            className="
              mb-6
              border border-[#E6C972]/20
              rounded-xl
              p-4
              bg-black/30
            "
          >
            <p className="text-gray-300 mb-1">
              Category:
              <span className="text-[#E6C972] ml-2">
                {groupData.category.replace(
                  "-",
                  " "
                )}
              </span>
            </p>

            <p className="text-gray-300 mb-1">
              Option:
              <span className="text-[#E6C972] ml-2">
                {groupData.option}
              </span>
            </p>

            <p className="text-gray-400 text-sm mt-2">
              Members Synced:{" "}
              {
                groupData.membersCount
              }
              /
              {
                groupData.requiredSize
              }
            </p>
          </div>
        )}

        {/* EXISTING PAYMENT */}

        {existingPayment && (
          <p className="text-green-400 text-sm mb-4 text-center">
            ✅ Payment already
            initiated for this group.
          </p>
        )}

        {/* PRICE */}

        <div className="mb-4 text-gray-300 text-sm">
          One-time Activation Fee
        </div>

        <div className="text-2xl font-bold text-green-400 mb-6">
          ₹{PRICE}
        </div>

        {/* STRIPE BUTTON */}

        <button
          onClick={handlePayment}
          disabled={
            processing ||
            existingPayment
          }
          className="
            w-full py-3 rounded-xl
            bg-[#635BFF]
            text-white font-bold
            hover:opacity-90
            transition
            disabled:opacity-50
          "
        >
          {processing
            ? "Processing..."
            : existingPayment
            ? "Already Initiated"
            : "Pay with Stripe"}
        </button>

        {/* RAZORPAY BUTTON */}

        <button
          onClick={handleRazorpay}
          disabled={
            processing ||
            existingPayment
          }
          className="
            w-full py-3 rounded-xl
            bg-[#E6C972]
            text-black font-bold
            hover:bg-[#f5e29c]
            transition
            disabled:opacity-50
            mt-4
          "
        >
          {processing
            ? "Processing..."
            : existingPayment
            ? "Already Initiated"
            : "Pay with Razorpay / UPI"}
        </button>

        {/* BACK */}

        <button
          onClick={() =>
            router.push("/dashboard")
          }
          className="
            w-full mt-5
            text-sm text-gray-400
            hover:text-white
            transition
          "
        >
          ← Back to Dashboard
        </button>

        <p className="text-xs text-gray-500 mt-6 text-center">
          Secure payment powered by
          Stripe & Razorpay.
        </p>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading Partner Sync
          details...
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}