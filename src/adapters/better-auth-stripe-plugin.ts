import { stripe } from "@better-auth/stripe";
import type Stripe from "stripe";
import { billingStripeClientProxy } from "@/adapters/stripe/client";
import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import { processStripeWebhook } from "@/server/db/services/billing/stripe-webhooks";
import { env } from "@/shared/env";

const durableEventTypes = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

function eventObjectId(event: Stripe.Event) {
  const object = event.data.object as { id?: unknown };
  return typeof object.id === "string" ? object.id : null;
}

export const authStripePlugin = stripe({
  stripeClient: billingStripeClientProxy,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
  createCustomerOnSignUp: true,
  async onEvent(event) {
    if (durableEventTypes.has(event.type)) {
      const objectId = eventObjectId(event);
      if (!objectId) throw new Error("Stripe event object has no ID.");
      await processStripeWebhook({
        eventId: event.id,
        eventType: event.type as Parameters<
          typeof processStripeWebhook
        >[0]["eventType"],
        objectId,
      });
    }
  },
  subscription: {
    enabled: true,
    plans: subscriptionPlans,
  },
});
