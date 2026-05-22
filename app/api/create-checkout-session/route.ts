import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key || key.includes("xxxx")) {
    return null;
  }

  return new Stripe(key);
}

export async function POST(
  req: Request
) {

  try {

    const stripe =
      getStripe();

    if (!stripe) {
      return NextResponse.json(
        {
          error:
            "Stripe is not configured. Add a real STRIPE_SECRET_KEY to .env.local and set NEXT_PUBLIC_STRIPE_ENABLED=true",
        },
        { status: 503 }
      );
    }

    const body =
      await req.json();

    const {
      amount,
      groupId,
      uid,
    } = body;

    /* -----------------------------
       BASIC VALIDATION
    ----------------------------- */

    if (
      !amount ||
      !groupId ||
      !uid
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

    /* -----------------------------
       SAFE AMOUNT
    ----------------------------- */

    const finalAmount =
      Number(amount);

    if (
      isNaN(finalAmount) ||
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

    /* -----------------------------
       CREATE STRIPE SESSION
    ----------------------------- */

    const session =
      await stripe.checkout.sessions.create(
        {

          payment_method_types:
            ["card"],

          mode:
            "payment",

          line_items: [
            {
              price_data: {

                currency:
                  "inr",

                product_data:
                  {
                    name:
                      "Partner Sync Activation",

                    description:
                      "Unlock internal group coordination & chat",
                  },

                unit_amount:
                  finalAmount *
                  100,
              },

              quantity: 1,
            },
          ],

          success_url:
            `${process.env.NEXT_PUBLIC_BASE_URL}/payment-success?groupId=${groupId}`,

          cancel_url:
            `${process.env.NEXT_PUBLIC_BASE_URL}/payment?groupId=${groupId}`,

          metadata: {
            uid,
            groupId,
          },
        }
      );

    return NextResponse.json(
      {
        url:
          session.url,
      }
    );

  } catch (error) {

    console.error(
      "Stripe Session Creation Error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Stripe session creation failed",
      },
      {
        status: 500,
      }
    );
  }
}