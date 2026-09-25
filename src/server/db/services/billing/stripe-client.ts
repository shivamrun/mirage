import Stripe from "stripe";

import { env } from "@/shared/env";

export type BillingStripeClient = Pick<
  Stripe,
  "checkout" | "prices" | "subscriptions" | "webhooks"
>;

let stripeClient: BillingStripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
});

export function getBillingStripeClient() {
  return stripeClient;
}

export function setBillingStripeClientForTests(client: BillingStripeClient) {
  if (env.NODE_ENV !== "test") {
    throw new Error("Stripe test client override is only available in tests.");
  }

  stripeClient = client;
}
