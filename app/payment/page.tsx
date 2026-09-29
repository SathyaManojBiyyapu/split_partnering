"use client";

import {
  Suspense,
  useEffect,
  useRef,
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
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  isGroupMatched,
  isPaidForPairing,
  chatUnlocked,
  activeMemberPhones,
  paidMemberCountForPairing,
} from "@/app/lib/groupMatching";

function PaymentContent() {

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const groupId =
    searchParams.get(
      "groupId"
    );

  /* ============================================================
     PAYMENT-FIRST MARKETPLACE ENTRY (Requirement 2)
     /payment?category=…&option=…&collaboratorId=…&collaboratorName=…
     (NO groupId) — the user pays to ENTER the paid matching/waiting
     queue. The server resolves/creates the queue group AFTER the
     payment verifies; this page then live-tracks that group's
     "X/Y members paid" state until the match confirms.
     ============================================================ */
  const entryCategory =
    searchParams.get("category") || "";
  const entryOption =
    searchParams.get("option") || "";
  const entryCollaboratorId =
    searchParams.get("collaboratorId") || "";
  const entryCollaboratorName =
    searchParams.get("collaboratorName") || "";
  const isEntryMode =
    !groupId && !!entryCategory && !!entryOption;
    !groupId && !!entryCategory && !!entryOption;

  const [
    entryResult,
    setEntryResult,
  ] = useState<any>(null);

  const [
    activeGroupId,
    setActiveGroupId,
  ] = useState<string | null>(null);

  const [
    entryError,
    setEntryError,
  ] = useState<string | null>(null);

  const [
    userLoc,
    setUserLoc,
  ] = useState<{ state: string; district: string; city: string } | null>(null);

  /* Optional group metadata (create-group flow) forwarded to the server so
     the created queue group keeps the caller's custom fields. */
  const entryRequiredSize = searchParams.get("requiredSize") || "";
  const entryBudget = searchParams.get("budget") || "";
  const entryDateTime = searchParams.get("dateTime") || "";
  const entryDescription = searchParams.get("description") || "";
  const entryNotes = searchParams.get("notes") || "";

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

  /* Latest group doc, always in sync via the onSnapshot listener below.
     The async Razorpay handler reads this ref (state would be stale inside
     the closure) to decide "go to chat" vs "waiting for partner". */
  const groupDataRef = useRef<any>(null);

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

  /* FIXED PRICE — amount is hardcoded server-side to prevent payment bypass */
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
     ENTRY MODE — load the saved profile location (display only; the
     SERVER always re-reads the authoritative users doc itself).
  ----------------------------- */

  useEffect(() => {

    if (!isEntryMode) return;

    const loadLoc = async () => {
      try {
        const { fetchCurrentUserDoc } = await import("@/app/lib/userLookup");
        const resolved = await fetchCurrentUserDoc();
        if (resolved) {
          const d = resolved.data as any;
          setUserLoc({
            state: d.state || "",
            district: d.district || "",
            city: d.city || "",
          });
        }
      } catch {
        /* display-only */
      }
    };
    loadLoc();

  }, [isEntryMode]);

  /* -----------------------------
     LIVE GROUP + PAYMENT LISTENER
     onSnapshot keeps BOTH users' payment pages in sync: when the partner
     joins, pays, or leaves, this listener fires immediately — no manual
     refresh needed. The shared group doc (memberPayments, membersCount,
     pairingId) is the single source of truth for payment/chat state.
  ----------------------------- */

  useEffect(() => {

    /* Entry mode: nothing to watch until the verified payment resolves the
       queue group (the verify response returns activeGroupId). */
    const watchId = activeGroupId || groupId;
    if (!watchId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "groups", watchId),
      (snap) => {
        if (!snap.exists()) {
          /* Stale-link recovery: a FIFO rematch may have moved this user
             into a NEW pairing (or the old group was emptied/deleted).
             Instead of dead-ending with "Group not found", send them to
             their CURRENT pairing — same flow, correct URL. Only groups
             the user genuinely belongs to (memberUIDs contains their
             session phone) qualify. */
          const recover = async () => {
            const userId = getUserId();
            let replacement: string | null = null;
            if (userId) {
              try {
                const qs = await getDocs(
                  query(
                    collection(db, "groups"),
                    where("memberUIDs", "array-contains", userId)
                  )
                );
                const mine = qs.docs
                  .filter((d) => d.id !== watchId)
                  .map((d) => ({ id: d.id, g: d.data() as any }))
                  .filter(
                    ({ g }) =>
                      Array.isArray(g?.members) &&
                      g.members.some(
                        (m: any) => String(m?.phone || "").trim() === userId
                      )
                  );
                if (mine.length > 0) {
                  mine.sort((a, b) => {
                    const ua = chatUnlocked(a.g) ? 1 : 0;
                    const ub = chatUnlocked(b.g) ? 1 : 0;
                    if (ua !== ub) return ub - ua; // unlocked pairing wins
                    const ta = a.g?.updatedAt?.toMillis?.() || 0;
                    const tb = b.g?.updatedAt?.toMillis?.() || 0;
                    return tb - ta; // most recently active wins
                  });
                  replacement = mine[0].id;
                }
              } catch {
                /* rules/permission — fall back to the dashboard */
              }
            }
            if (replacement) {
              router.replace("/payment?groupId=" + replacement);
            } else {
              alert("Group not found");
              router.push("/dashboard");
            }
          };
          recover();
          return;
        }

        const gData = snap.data() as any;
        setGroupData(gData);
        groupDataRef.current = gData;

        /* ---- AUTHORITATIVE per-pairing payment check (group doc) ---- */
        const userId = getUserId();
        if (userId) {
          const mePaid = isPaidForPairing(gData, userId);
          setPaymentCompleted(mePaid);

          /* Live redirect: once chat is unlocked, take the user to chat. */
          if (chatUnlocked(gData) && mePaid) {
            setSuccessAnim(true);
          }
        }

        setLoading(false);
      },
      (err) => {
        console.warn("Group listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();

  }, [groupId, activeGroupId, phone, router]);

  /* -----------------------------
     CHECK PAYMENT STATUS (best-effort fallback)
     The authoritative check lives above (group doc via onSnapshot). This
     one-time lookup of the /payments collection is kept as a fallback for
     logins whose payment docs were written by the server webhook (e.g.
     Google login without a phone claim).
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

          // Rule-gated for some login types — non-fatal; the live listener
          // above is the authoritative source of truth.
          console.warn(
            "Payment lookup skipped:",
            (err as any)?.code || (err as any)?.message || err
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
     CHAT REDIRECT — single source of truth
     Navigates whenever the success screen is showing AND the LIVE group
     doc says the chat is unlocked. This covers every path:
       - own payment verified and the partner already paid
       - partner pays while this user waits on this page
       - user re-opens /payment when the pair is already fully paid
     Previously the listener-only path set the "Redirecting to private
     group chat..." screen but NEVER scheduled a navigation — the user was
     stuck on a success screen that never redirected.
  ----------------------------- */

  useEffect(() => {

    const chatTargetId = activeGroupId || groupId;
    if (!successAnim || !chatTargetId) return;

    const latest =
      groupDataRef.current;

    if (!latest || !chatUnlocked(latest)) return; // wait for the live doc

    const t = setTimeout(() => {
      router.push(`/chat/${activeGroupId || groupId}`);
    }, 1500);

    return () => clearTimeout(t);

  }, [successAnim, groupData, groupId, router]);

  /* -----------------------------
     STRIPE PAYMENT
  ----------------------------- */

  const userId = getUserId();

  /* Shared request body for order/session creation — entry mode sends the
     marketplace key (server resolves location + duplicate guard); legacy
     pairing mode sends the groupId. */
  const orderBody = isEntryMode
    ? {
        mode: "entry",
        category: entryCategory,
        option: entryOption,
        collaboratorId: entryCollaboratorId,
        collaboratorName: entryCollaboratorName,
        ...(entryRequiredSize ? { requiredSize: entryRequiredSize } : {}),
        ...(entryBudget ? { budget: entryBudget } : {}),
        ...(entryDateTime ? { dateTime: entryDateTime } : {}),
        ...(entryDescription ? { description: entryDescription } : {}),
        ...(entryNotes ? { notes: entryNotes } : {}),
        uid: userId,
      }
    : { groupId, uid: userId };

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

        // Best-effort pending doc. Firestore rules only allow OWN payment docs —
        // Google-login users without a phone claim are denied here. That must
        // never block payment: /api/verify-razorpay-payment records the paid
        // doc server-side regardless.
        try {
          if (isEntryMode) {
            /* Entry payments are recorded by the SERVER (with the resolved
               groupId) — there is no groupId at pending-doc time. */
            throw new Error("entry-mode: skip pending doc");
          }
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

            // Firestore rules REQUIRE a pairingId on payments.create —
            // without it every client pending-doc write is rule-denied and
            // the verify route cannot find/update it.
            pairingId:
              groupData?.pairingId || "",

            paymentMethod:
              "stripe",

            createdAt:
              serverTimestamp(),
          }
        );
        } catch {
          console.warn("Pending payment doc skipped (rule-gated) — server records it on verification.");
        }

        const response =
          await fetch(
            "/api/create-checkout-session",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${await firebaseUser.getIdToken()}`,
              },

              body: JSON.stringify(orderBody),
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

        // Best-effort pending doc (see the Stripe handler note — Google-login
        // users are rule-denied here; the server records the paid doc).
        try {
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

            // Firestore rules REQUIRE a pairingId on payments.create —
            // without it every client pending-doc write is rule-denied and
            // the verify route cannot find/update it.
            pairingId:
              groupData?.pairingId || "",

            paymentMethod:
              "razorpay",

            createdAt:
              serverTimestamp(),
          }
        );
        } catch {
          console.warn("Pending payment doc skipped (rule-gated) — server records it on verification.");
        }

        const orderRes =
          await fetch(
            "/api/create-razorpay-order",
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
                Authorization:
                  `Bearer ${await firebaseUser.getIdToken()}`,
              },

              body:
                JSON.stringify(orderBody),
            }
          );

          const order =
          await orderRes.json();
        
        console.log(
          "ORDER RESPONSE:",
          order
        );
        
        if (!orderRes.ok) {
        
          if (isEntryMode) {
            /* Duplicate-payment / validation guard surfaced by the server. */
            setEntryError(
              order?.error ||
                "Could not start the payment. Please try again."
            );
          }
        
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
                /* Entry mode: verify with the marketplace key (no groupId yet).
                   Legacy pairing mode: verify against the group. */
                const verifyBody = isEntryMode
                  ? {
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                      uid: userId,
                      mode: "entry",
                      category: entryCategory,
                      option: entryOption,
                      collaboratorId: entryCollaboratorId,
                      collaboratorName: entryCollaboratorName,
                      ...(entryRequiredSize ? { requiredSize: entryRequiredSize } : {}),
                      ...(entryBudget ? { budget: entryBudget } : {}),
                      ...(entryDateTime ? { dateTime: entryDateTime } : {}),
                      ...(entryDescription ? { description: entryDescription } : {}),
                      ...(entryNotes ? { notes: entryNotes } : {}),
                    }
                  : {
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                      uid: userId,
                      groupId,
                    };

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
                          Authorization:
                            `Bearer ${await firebaseUser.getIdToken()}`,
                        },

                      body:
                        JSON.stringify(verifyBody),
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

                /* ---- ENTRY MODE: the payment has ENTERED (or completed) the
                   paid waiting queue. Rebind to the resolved queue group and
                   show the live WAITING AREA (never an instant match). ---- */
                if (isEntryMode) {
                  setEntryResult(verifyData);
                  const g =
                    verifyData.activeGroupId || verifyData.groupId || "";
                  if (g) setActiveGroupId(g);
                  if (verifyData.chatUnlocked) {
                    setSuccessAnim(true);
                  }
                  return;
                }

                /* FIFO RE-MATCH: when the payer's old pairing is replaced
                   by a new paid pairing, the SERVER returns the NEW active
                   groupId. Rebind this page to it - the live onSnapshot
                   listener on the new group decides "go to chat" vs
                   "waiting for partner's payment" (the old group doc is
                   historical only). */
                if (
                  verifyData.activeGroupId &&
                  verifyData.activeGroupId !== groupId
                ) {
                  router.replace(
                    `/payment?groupId=${verifyData.activeGroupId}`
                  );
                  return;
                }

                /* Navigate ONLY when the SERVER says the whole pairing has
                   paid (the verify route re-reads the group doc AFTER the
                   entitlement write and returns chatUnlocked). When the
                   partner has not paid yet, stay on this page — the live
                   onSnapshot listener flips the UI to "Waiting for
                   partner's payment" and the redirect effect below
                   navigates automatically the moment the partner pays.
                   (The old code redirected unconditionally → paying users
                   landed on the locked-chat screen and could pay twice.) */
                if (verifyData.chatUnlocked) {
                  setSuccessAnim(
                    true
                  );
                } else {
                  console.log(
                    "Payment verified. Chat unlocks automatically once your partner pays."
                  );
                }

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
     LIVE PAYMENT/GROUP STATE (derived from the shared group doc)
  ----------------------------- */

  const groupMatched = groupData ? isGroupMatched(groupData) : false;
  const mePaidForPair =
    !!(userId && groupData && isPaidForPairing(groupData, userId));
  const canPayNow =
    !!userId && !!groupData && groupMatched && !mePaidForPair;
  const partnerPhone =
    (groupData ? activeMemberPhones(groupData).find((p) => p !== userId) : "") || "";
  const partnerPaidForPair =
    !!partnerPhone && !!groupData && isPaidForPairing(groupData, partnerPhone);
  const chatReady =
    !!groupData && chatUnlocked(groupData);
  const membersNow =
    groupData && Number.isFinite(Number(groupData.membersCount))
      ? Number(groupData.membersCount)
      : (Array.isArray(groupData?.members) ? groupData.members.length : 0);
  const requiredNow =
    Number(groupData?.requiredSize) || Number(entryResult?.requiredSize) || 2;
  const paidNow = groupData
    ? paidMemberCountForPairing(groupData)
    : Number(entryResult?.paidCount) || 0;

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
          p-6 sm:p-10
          rounded-2xl
          shadow-2xl
          w-full max-w-[420px]
          border border-[#E6C972]/30
        "
      >

        <h2 className="text-3xl font-bold text-[#E6C972] mb-4">
          Activate Partner Sync
        </h2>

        <p className="text-gray-400 text-sm mb-6">
          Unlock secure coordination and verified group benefits.
        </p>

        {isEntryMode && !entryResult && (
          <div className="mb-6 border border-[#E6C972]/20 rounded-xl p-4 bg-black/30">
            <p className="text-gray-300 mb-1">
              Category:
              <span className="text-[#E6C972] ml-2">
                {entryCategory.replace(/-/g, " ")}
              </span>
            </p>
            <p className="text-gray-300 mb-1">
              Partnership:
              <span className="text-[#E6C972] ml-2">
                {entryOption.replace(/-/g, " ")}
              </span>
            </p>
            {entryCollaboratorName ? (
              <p className="text-gray-300 mb-1">
                Business:
                <span className="text-[#E6C972] ml-2">
                  {entryCollaboratorName}
                </span>
              </p>
            ) : null}
            {userLoc ? (
              <p className="text-gray-400 text-xs mt-2">
                📍 Marketplace: {userLoc.state} → {userLoc.district} → {userLoc.city}
              </p>
            ) : null}
            <p className="text-gray-500 text-[11px] mt-2 leading-relaxed">
              Pay once to enter the matching queue. You will be matched
              automatically when the required number of compatible members
              have paid — chat unlocks on match confirmation.
            </p>
          </div>
        )}

        {entryError && (
          <div className="mb-4 border border-red-500/30 bg-red-500/10 rounded-xl p-3">
            <p className="text-red-400 text-xs font-semibold">{entryError}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-2 text-[11px] text-gray-300 underline"
            >
              Go to My Matches
            </button>
          </div>
        )}

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

            {/* LIVE grouping + payment state */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {groupMatched ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                  {membersNow}/{requiredNow} Matched
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {membersNow}/{requiredNow} Waiting
                </span>
              )}
              {partnerPhone ? (
                <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded-full border " + (partnerPaidForPair ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20")}>
                  👤 Partner: {partnerPaidForPair ? "Paid" : "Payment Pending"}
                </span>
              ) : null}
              {chatReady ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  💬 Chat: Unlocked
                </span>
              ) : groupMatched ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">
                  🔒 Chat: Locked (waiting for both payments)
                </span>
              ) : null}
            </div>

          </div>
        )}

        <div className="mb-4 text-gray-300 text-sm">
          Fixed Activation Fee
        </div>

        <div className="text-3xl font-bold text-green-400 mb-6">
          ₹29
        </div>

        {isEntryMode && entryResult ? (
          entryResult.chatUnlocked || chatReady ? (
            <>
              <div className="mb-3 text-center">
                <p className="text-green-400 font-bold text-sm">
                  ✓ Match Confirmed
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  Payment Complete · Chat Unlocked
                </p>
              </div>
              <button
                onClick={() =>
                  router.push(
                    `/chat/${activeGroupId || groupId}`
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
            </>
          ) : (
            <>
              {/* MATCHING / WAITING AREA — paid but not yet matched.
                  Live: groupData is watched by onSnapshot, so the moment a
                  compatible partner pays, the required members are paid,
                  the match confirms and chat unlocks — no refresh needed. */}
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <p className="text-emerald-400 font-bold text-sm">🟢 PAID</p>
                <p className="text-yellow-300 text-xs mt-1 font-semibold">
                  ⏳ WAITING FOR PARTNER
                </p>
                <p className="text-white text-lg font-bold mt-2">
                  {paidNow}/{requiredNow} MEMBERS PAID
                </p>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Waiting for a compatible partner. You&apos;ll be matched
                  automatically when the required members have paid.
                </p>
              </div>
              <button
                disabled
                className="
                  w-full py-3 rounded-xl
                  bg-gray-800
                  text-gray-400 font-bold
                "
              >
                ⏳ Waiting for partner
              </button>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full mt-3 text-sm text-gray-400 hover:text-white transition"
              >
                View My Matches →
              </button>
            </>
          )
        ) : (
          chatReady ? (

          <button
            onClick={() =>
              router.push(
                `/chat/${activeGroupId || groupId}`
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

        ) : !groupMatched ? (

          <button
            disabled
            className="
              w-full py-3 rounded-xl
              bg-gray-800
              text-gray-400 font-bold
            "
          >
            ⏳ {membersNow}/{requiredNow} Waiting — pay once a partner joins
          </button>

        ) : mePaidForPair ? (

          <>
            <div className="mb-2 text-[11px] text-green-400 text-center">
              ✅ Your payment was verified — waiting for your partner to pay.
            </div>

            <button
              disabled
              className="
                w-full py-3 rounded-xl
                bg-gray-800
                text-gray-400 font-bold
              "
            >
              ⏳ Waiting for partner&apos;s payment
            </button>

            <div className="mt-2 text-[11px] text-gray-500 text-center">
              Chat unlocks automatically the moment your partner pays.
            </div>
          </>

        ) : (

          <>
            <div className="mb-2 text-[11px] text-gray-500 text-center">
              Match complete ({membersNow}/{requiredNow}) — unlock chat for ₹29.
            </div>

            {stripeEnabled && !isEntryMode ? (
              <button
                onClick={
                  handlePayment
                }
                disabled={
                  processing || !canPayNow
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
                processing || !canPayNow
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
        )
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