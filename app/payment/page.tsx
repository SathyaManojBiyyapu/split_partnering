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
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

function PaymentContent() {

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const groupId =
    searchParams.get(
      "groupId"
    );

  const [
    firebaseUser,
    setFirebaseUser,
  ] = useState<any>(null);

  const [
    groupData,
    setGroupData,
  ] = useState<any>(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    existingPayment,
    setExistingPayment,
  ] = useState(false);

  const [
    paymentCompleted,
    setPaymentCompleted,
  ] = useState(false);

  const [
    successAnim,
    setSuccessAnim,
  ] = useState(false);

  const [
    razorpayLoaded,
    setRazorpayLoaded,
  ] = useState(false);

  /* PHONE UID */

  const phone =
    typeof window !==
    "undefined"
      ? localStorage.getItem(
          "phone"
        )?.trim()
      : null;

  const getUserId = () => {
    if (phone) return phone;

    const authPhone =
      firebaseUser?.phoneNumber?.replace(
        /^\+91/,
        ""
      );

    return authPhone || null;
  };

  /* FIXED PRICE */

  const PRICE = 29;

  const stripeEnabled =
    process.env
      .NEXT_PUBLIC_STRIPE_ENABLED ===
    "true";

  /* -----------------------------
     LOAD RAZORPAY SDK
  ----------------------------- */

  useEffect(() => {

    // If already loaded or loading, skip
    if (document.querySelector('script[src*="checkout.razorpay.com"]')) {
      if ((window as any).Razorpay) {
        setRazorpayLoaded(true);
      }
      return;
    }

    const script =
      document.createElement(
        "script"
      );

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    script.onload = () => {
      setRazorpayLoaded(true);
      console.log("Razorpay SDK loaded successfully");
    };

    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
    };

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

            router.push(
              "/login"
            );

          } else {

            setFirebaseUser(
              user
            );
          }
        }
      );

    return () =>
      unsub();

  }, [router]);

  /* -----------------------------
     FETCH GROUP
  ----------------------------- */

  useEffect(() => {

    if (!groupId)
      return;

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

          if (
            snap.exists()
          ) {

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

          console.error(
            err
          );
        }

        setLoading(false);
      };

    fetchGroup();

  }, [groupId, router]);

  /* -----------------------------
     CHECK PAYMENT STATUS
  ----------------------------- */

  useEffect(() => {

    const userId =
      getUserId();

    if (
      !userId ||
      !groupId
    )
      return;

    const checkPayment =
      async () => {

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
                userId
              ),

              where(
                "groupId",
                "==",
                groupId
              )
            );

          const snap =
            await getDocs(
              qPay
            );

          if (
            !snap.empty
          ) {

            setExistingPayment(
              true
            );

            snap.forEach(
              (d) => {

                const data =
                  d.data();

                if (
                  data.status ===
                    "paid" ||
                  data.paid ===
                    true
                ) {

                  setPaymentCompleted(
                    true
                  );
                }
              }
            );
          }

        } catch (err) {

          console.error(
            "Payment check error:",
            err
          );
        }
      };

    checkPayment();

  }, [
    phone,
    groupId,
    firebaseUser,
  ]);

  /* -----------------------------
     STRIPE PAYMENT
  ----------------------------- */

  const handlePayment =
    async () => {

      const userId =
        getUserId();

      if (
        !userId ||
        !groupData ||
        !groupId
      ) {

        alert(
          "Please log in with your mobile number before paying."
        );

        return;
      }

      try {

        setProcessing(
          true
        );

        await addDoc(
          collection(
            db,
            "payments"
          ),
          {
            uid:
              userId,

            phone:
              userId,

            groupId,

            category:
              groupData.category,

            option:
              groupData.option,

            amount:
              PRICE,

            status:
              "pending",

            paymentMethod:
              "stripe",

            createdAt:
              serverTimestamp(),
          }
        );

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
                    userId,
                }
              ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.url
        ) {

          alert(
            data.error ||
              "Stripe session creation failed ❌. Check STRIPE_SECRET_KEY in .env.local."
          );

          setProcessing(
            false
          );

          return;
        }

        window.location.href =
          data.url;

      } catch (error) {

        console.error(
          "Stripe payment error:",
          error
        );

        alert(
          "Payment failed ❌"
        );

        setProcessing(
          false
        );
      }
    };

  /* -----------------------------
     RAZORPAY PAYMENT
  ----------------------------- */

  const handleRazorpay =
    async () => {

      const userId =
        getUserId();

      if (
        !userId ||
        !groupData ||
        !groupId
      ) {

        alert(
          "Please log in with your mobile number before paying."
        );

        return;
      }

      try {

        setProcessing(
          true
        );

        await addDoc(
          collection(
            db,
            "payments"
          ),
          {
            uid:
              userId,

            phone:
              userId,

            groupId,

            category:
              groupData.category,

            option:
              groupData.option,

            amount:
              PRICE,

            status:
              "pending",

            verified:
              false,

            paymentMethod:
              "razorpay",

            createdAt:
              serverTimestamp(),
          }
        );

        const orderRes =
          await fetch(
            "/api/create-razorpay-order",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    amount:
                      PRICE,

                    groupId,

                    uid:
                      userId,
                  }
                ),
            }
          );

          const order =
          await orderRes.json();
        
        console.log(
          "ORDER RESPONSE:",
          order
        );
        
        if (!orderRes.ok) {
        
          alert(
            order?.error ||
            JSON.stringify(order)
          );
        
          setProcessing(false);
        
          return;
        }
        
        if (!order?.id) {
        
          alert(
            "Order ID missing: " +
            JSON.stringify(order)
          );
        
          setProcessing(false);
        
          return;
        }
        const options = {

          key:
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,

          currency:
            "INR",

          name:
            "Partnering",

          description:
            "Partner Sync Payment",

          order_id:
            order.id,

          handler:
            async function (
              response: any
            ) {

              try {

                const verifyRes =
                  await fetch(
                    "/api/verify-razorpay-payment",
                    {
                      method:
                        "POST",

                      headers:
                        {
                          "Content-Type":
                            "application/json",
                        },

                      body:
                        JSON.stringify(
                          {
                            razorpay_order_id:
                              response.razorpay_order_id,

                            razorpay_payment_id:
                              response.razorpay_payment_id,

                            razorpay_signature:
                              response.razorpay_signature,

                            uid:
                              userId,

                            groupId,
                          }
                        ),
                    }
                  );

                const verifyData =
                  await verifyRes.json();

                if (
                  !verifyRes.ok ||
                  !verifyData.success
                ) {

                  alert(
                    verifyData.error ||
                      "Payment verification failed ❌"
                  );

                  setProcessing(
                    false
                  );

                  return;
                }


                setPaymentCompleted(
                  true
                );

                setSuccessAnim(
                  true
                );

                setTimeout(
                  () => {

                    router.push(
                      `/chat/${groupId}`
                    );

                  },
                  1800
                );

              } catch (err) {

                console.error(
                  err
                );

                alert(
                  "Payment verification failed ❌"
                );

                setProcessing(
                  false
                );
              }
            },

          prefill: {

            email:
              firebaseUser?.email,

            contact:
              phone,
          },

          theme: {
            color:
              "#E6C972",
          },
        };

        if (
          !(window as any).Razorpay
        ) {
        
          alert(
            "Razorpay SDK not loaded"
          );
        
          setProcessing(false);
        
          return;
        }
        
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

        setProcessing(
          false
        );
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

  /* SUCCESS */

  if (
    successAnim
  ) {

    return (

      <div className="min-h-screen flex items-center justify-center bg-black text-white">

        <div className="text-center">

          <div className="text-7xl mb-6">
            ✅
          </div>

          <h1 className="text-4xl font-bold text-green-400">
            Payment Successful
          </h1>

          <p className="text-gray-400 mt-4">
            Redirecting to private group chat...
          </p>

        </div>

      </div>
    );
  }

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

        <div className="mb-4 text-gray-300 text-sm">
          Fixed Activation Fee
        </div>

        <div className="text-3xl font-bold text-green-400 mb-6">
          ₹29
        </div>

        {paymentCompleted ? (

          <button
            onClick={() =>
              router.push(
                `/chat/${groupId}`
              )
            }
            className="
              w-full py-3 rounded-xl
              bg-green-600
              text-white font-bold
            "
          >
            Open Chat
          </button>

        ) : (

          <>

            {stripeEnabled ? (
              <button
                onClick={
                  handlePayment
                }
                disabled={
                  processing
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
            ) : null}

            {/* RAZORPAY */}

            <button
              onClick={
                handleRazorpay
              }
              disabled={
                processing
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

          </>
        )}

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