import Stripe from "stripe";
import { env } from "@/shared/env";

export type BillingStripeClient = Pick<
  Stripe,
  | "billingPortal"
  | "checkout"
  | "customers"
  | "events"
  | "invoices"
  | "prices"
  | "subscriptionSchedules"
  | "subscriptions"
  | "webhooks"
>;

let stripeClient: BillingStripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
  timeout: 30_000,
});

export const billingStripeClientProxy = new Proxy({} as Stripe, {
  get(_target, property) {
    return Reflect.get(getBillingStripeClient(), property);
  },
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
