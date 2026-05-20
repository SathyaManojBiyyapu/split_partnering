"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  auth,
  db,
} from "@/firebase/config";

import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  updateDoc,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

function PaymentContent() {
  const router = useRouter();

  const searchParams =
    useSearchParams();

  const groupId =
    searchParams.get("groupId");

  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState<any>(null);

  const [
    groupData,
    setGroupData,
  ] = useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    existingPayment,
    setExistingPayment,
  ] = useState(false);

  /* FIXED PRICE */

  const PRICE =29 
  ;

  /* -----------------------------
     LOAD RAZORPAY SDK
  ----------------------------- */

  useEffect(() => {
    const script =
      document.createElement(
        "script"
      );

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    document.body.appendChild(
      script
    );
  }, []);

  /* -----------------------------
     AUTH LISTENER
  ----------------------------- */

  useEffect(() => {
    const unsub =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            router.push("/login");
          } else {
            setFirebaseUser(user);

            if (
              !user.phoneNumber
            ) {
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

    const fetchGroup =
      async () => {
        try {
          const snap =
            await getDoc(
              doc(
                db,
                "groups",
                groupId
              )
            );

          if (snap.exists()) {
            setGroupData(
              snap.data()
            );
          } else {
            alert(
              "Group not found"
            );

            router.push(
              "/dashboard"
            );
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
    if (
      !firebaseUser ||
      !groupId
    )
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

          const snap =
            await getDocs(qPay);

          if (!snap.empty) {
            setExistingPayment(
              true
            );
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
     MARK MEMBER PAID
  ----------------------------- */

  const markMemberPaid =
    async () => {
      if (
        !firebaseUser ||
        !groupId
      )
        return;

      try {
        const groupRef = doc(
          db,
          "groups",
          groupId
        );

        const groupSnap =
          await getDoc(
            groupRef
          );

        if (
          !groupSnap.exists()
        )
          return;

        const group =
          groupSnap.data();

        const updatedMembers =
          (
            group.members || []
          ).map((m: any) => {
            if (
              typeof m ===
              "string"
            ) {
              return m;
            }

            if (
              m.uid ===
              firebaseUser.uid
            ) {
              return {
                ...m,
                paid: true,
              };
            }

            return m;
          });

        await updateDoc(
          groupRef,
          {
            members:
              updatedMembers,
          }
        );
      } catch (err) {
        console.error(
          "Paid update error:",
          err
        );
      }
    };

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

        await addDoc(
          collection(
            db,
            "payments"
          ),
          {
            uid:
              firebaseUser.uid,

            groupId,

            category:
              groupData.category,

            option:
              groupData.option,

            amount: PRICE,

            status: "pending",

            paymentMethod:
              "stripe",

            createdAt:
              serverTimestamp(),
          }
        );

        await markMemberPaid();

        const response =
          await fetch(
            "/api/create-checkout-session",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify(
                {
                  amount:
                    PRICE,

                  groupId,

                  uid:
                    firebaseUser.uid,
                }
              ),
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

        alert(
          "Payment failed ❌"
        );

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
          collection(
            db,
            "payments"
          ),
          {
            uid:
              firebaseUser.uid,

            groupId,

            category:
              groupData.category,

            option:
              groupData.option,

            amount: PRICE,

            status: "pending",

            paymentMethod:
              "razorpay",

            createdAt:
              serverTimestamp(),
          }
        );

        /* UPDATE MEMBER */

        await markMemberPaid();

        /* RAZORPAY POPUP */
const orderRes =
  await fetch(
    "/api/create-razorpay-order",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        amount: PRICE,
      }),
    }
  );

const order =
  await orderRes.json();

        const options = {
          key:
  process.env
    .NEXT_PUBLIC_RAZORPAY_KEY_ID,

      order_id:
  order.id,

          currency: "INR",

          name:
            "Partnering",

          description:
            "Partner Sync Payment",

          handler:
            async function (
              response: any
            ) {
              try {
                const paymentsRef =
                  collection(
                    db,
                    "payments"
                  );

                const qPay =
                  query(
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

                const paySnap =
                  await getDocs(
                    qPay
                  );

                for (const d of paySnap.docs) {
                  await updateDoc(
                    doc(
                      db,
                      "payments",
                      d.id
                    ),
                    {
                      status:
                        "paid",

                      razorpayPaymentId:
                        response.razorpay_payment_id,
                    }
                  );
                }

                alert(
                  "Payment successful ✅"
                );

                router.push(
                  `/chat/${groupId}`
                );
              } catch (err) {
                console.error(
                  err
                );

                alert(
                  "Payment verification failed"
                );
              }
            },

          prefill: {
            email:
              firebaseUser.email,

            contact:
              firebaseUser.phoneNumber,
          },

          theme: {
            color:
              "#E6C972",
          },
        };

        const razor =
          new (
            window as any
          ).Razorpay(
            options
          );

        razor.open();
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
        Loading Partner Sync details...
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
          Unlock secure coordination and verified group benefits.
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
              Members Synced:
              {" "}
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

        {/* PRICE */}

        <div className="mb-4 text-gray-300 text-sm">
          Fixed Activation Fee
        </div>

        <div className="text-3xl font-bold text-green-400 mb-6">
          ₹29
          
        </div>

        {/* STRIPE */}

        <button
          onClick={
            handlePayment
          }
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
            : "Pay with Stripe"}
        </button>

        {/* RAZORPAY */}

        <button
          onClick={
            handleRazorpay
          }
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
            : "Pay ₹29 with Razorpay"}
        </button>

        {/* BACK */}

        <button
          onClick={() =>
            router.push(
              "/dashboard"
            )
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
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white">
          Loading Partner Sync details...
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  );
}