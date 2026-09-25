import type Stripe from "stripe";

import {
  constructBillingStripeEvent,
  handleBillingStripeEvent,
} from "@/server/db/services/billing/webhook";

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
    event = await constructBillingStripeEvent({
      body: await request.text(),
      signature,
    });
  } catch {
    return Response.json(
      { message: "Stripe signature verification failed." },
      { status: 400 },
    );
  }

  await handleBillingStripeEvent(event);

  return Response.json({ received: true });
}
