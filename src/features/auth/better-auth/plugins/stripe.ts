import { stripe } from "@better-auth/stripe";
import type Stripe from "stripe";

import { analytics } from "@/adapters/analytics/server";
import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import type {
  BillingCheckoutInterval,
  BillingCheckoutPlan,
} from "@/server/db/services/billing/catalog";
import { billingCatalog } from "@/server/db/services/billing/catalog";
import { billingStripeClientProxy } from "@/server/db/services/billing/stripe-client";
import { reconcileCreditGrantForSubscription } from "@/server/db/services/credits/ledger";
import { grantCreditTopUpForCheckoutSession } from "@/server/db/services/credits/top-up";
import { env } from "@/shared/env";

function normalizeSubscriptionPlan(value: null | string | undefined) {
  const normalizedValue = value?.toLowerCase().trim();

  if (normalizedValue === "pro" || normalizedValue === "mirage pro") {
    return "pro" satisfies BillingCheckoutPlan;
  }

  if (normalizedValue === "hacker" || normalizedValue === "mirage hacker") {
    return "hacker" satisfies BillingCheckoutPlan;
  }

  return null;
}

function normalizeSubscriptionInterval(value: null | string | undefined) {
  const normalizedValue = value?.toLowerCase().trim();

  if (normalizedValue === "month" || normalizedValue === "monthly") {
    return "monthly" satisfies BillingCheckoutInterval;
  }

  if (normalizedValue === "year" || normalizedValue === "annual") {
    return "yearly" satisfies BillingCheckoutInterval;
  }

  return null;
}

function isCreditTopUpCheckoutSession(event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return false;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const isTopUp =
    session.mode === "payment" &&
    session.payment_status === "paid" &&
    session.metadata?.lookupKey === billingCatalog.creditTopUp.lookupKey &&
    session.metadata.purchaseType === "credit_top_up";

  return isTopUp;
}

async function trackSubscriptionStarted({
  subscription,
}: {
  subscription: {
    billingInterval?: null | string;
    plan: string;
    referenceId: string;
  };
}) {
  const plan = normalizeSubscriptionPlan(subscription.plan);
  const billingInterval = normalizeSubscriptionInterval(
    subscription.billingInterval,
  );

  if (plan && billingInterval) {
    await analytics.trackAuthoritative(
      "subscription_started",
      { billingInterval, plan },
      { context: { distinctId: subscription.referenceId } },
    );
  }
}

export const authStripePlugin = stripe({
  stripeClient: billingStripeClientProxy,
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
  createCustomerOnSignUp: true,
  async onEvent(event) {
    if (isCreditTopUpCheckoutSession(event)) {
      await grantCreditTopUpForCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
      );
    }
  },
  subscription: {
    enabled: true,
    async onSubscriptionComplete({ subscription }) {
      const result = await reconcileCreditGrantForSubscription(subscription);

      if (result?.grantCreated) {
        await trackSubscriptionStarted({ subscription });
      }
    },
    async onSubscriptionCreated({ subscription }) {
      const result = await reconcileCreditGrantForSubscription(subscription);

      if (result?.grantCreated) {
        await trackSubscriptionStarted({ subscription });
      }
    },
    async onSubscriptionCancel({ subscription }) {
      const plan = normalizeSubscriptionPlan(subscription.plan);
      const billingInterval = normalizeSubscriptionInterval(
        subscription.billingInterval,
      );

      if (plan && billingInterval) {
        await analytics.trackAuthoritative(
          "subscription_cancelled",
          {
            billingInterval,
            cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
            plan,
          },
          { context: { distinctId: subscription.referenceId } },
        );
      }
    },
    async onSubscriptionUpdate({ subscription }) {
      await reconcileCreditGrantForSubscription(subscription);
    },
    plans: subscriptionPlans,
  },
});
