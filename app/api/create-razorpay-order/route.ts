export const runtime = "nodejs";

import { NextResponse } from "next/server";
import Razorpay from "razorpay";

/* =========================
   GET RAZORPAY INSTANCE
========================= */

function getRazorpay(): Razorpay {

  const keyId =
    process.env
      .NEXT_PUBLIC_RAZORPAY_KEY_ID ||

    process.env
      .RAZORPAY_KEY_ID;

  const keySecret =
    process.env
      .RAZORPAY_KEY_SECRET;
      if (
        !keyId ||
        !keySecret
      ) {
      
        throw new Error(
          `Missing Razorpay keys:
           keyId=${keyId}
           keySecret=${keySecret}`
        );
      }

  // Block production startup with test keys
  if (
    process.env.NODE_ENV === "production" &&
    keyId.startsWith("rzp_test_")
  ) {
    throw new Error(
      "PRODUCTION BLOCKED: You are using Razorpay TEST keys (rzp_test_*) in production. " +
      "Replace with LIVE keys from https://dashboard.razorpay.com/app/keys"
    );
  }

  return new Razorpay({

    key_id:
      keyId,

    key_secret:
      keySecret,
  });
}

/* =========================
   CREATE ORDER API
========================= */

export async function POST(
  req: Request
) {

  try {

    const razorpay =
      getRazorpay();

    const body =
      await req.json();

    const {
      amount,
      groupId,
      uid,
    } = body;

    /* =========================
       VALIDATION
    ========================= */

    if (
      !amount
    ) {

      return NextResponse.json(
        {
          error:
            "Missing amount",
        },
        {
          status: 400,
        }
      );
    }

    const finalAmount =
      Number(amount);

    if (
      isNaN(
        finalAmount
      ) ||

      finalAmount < 1
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid payment amount",
        },
        {
          status: 400,
        }
      );
    }

    /* =========================
       CREATE ORDER
    ========================= */

    const order =
      await razorpay.orders.create({

        amount:
          Math.round(
            finalAmount *
              100
          ),

        currency:
          "INR",

        receipt:
          `grp_${Date.now()}`,

        notes: {

          uid:
            uid || "",

          groupId:
            groupId || "",

          platform:
            "partnersync",
        },
      });

    /* =========================
       SUCCESS
    ========================= */

    return NextResponse.json({

      success:
        true,

      id:
        order.id,

      amount:
        order.amount,

      currency:
        order.currency,
    });

  } catch (error: any) {

    console.error(
      "FULL Razorpay order creation error:",  
      JSON.stringify(error, null, 2)
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Razorpay order creation failed",
      },
      {
        status: 500,
      }
    );
  }
}