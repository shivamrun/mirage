import type Stripe from "stripe";

import {
  constructCreditTopUpStripeEvent,
  grantCreditTopUpForCheckoutSession,
} from "@/server/db/services/credits/top-up";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json(
      { message: "Stripe signature is required." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    event = await constructCreditTopUpStripeEvent({
      body: await request.text(),
      signature,
    });
  } catch {
    return Response.json(
      { message: "Stripe signature verification failed." },
      { status: 400 },
    );
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await grantCreditTopUpForCheckoutSession(event.data.object);
  }

  return Response.json({ received: true });
}
