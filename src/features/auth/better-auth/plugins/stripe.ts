import { stripe } from "@better-auth/stripe";
import type Stripe from "stripe";

import { analytics } from "@/adapters/analytics/server";
import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import {
  getBillingSubscriptionByStripeCustomerId,
  getBillingSubscriptionByStripeSubscriptionId,
} from "@/server/db/dal/billing";
import type {
  BillingCheckoutInterval,
  BillingCheckoutPlan,
} from "@/server/db/services/billing/catalog";
import { billingCatalog } from "@/server/db/services/billing/catalog";
import { billingStripeClientProxy } from "@/server/db/services/billing/stripe-client";
import { enqueueStripeWebhookJob } from "@/server/db/services/billing/stripe-webhook-jobs";
import { reconcileCreditGrantForSubscription } from "@/server/db/services/credits/ledger";
import { notifyBestEffort } from "@/server/db/services/notifications/service";
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

function formatSubscriptionPlan(value: string) {
  const normalizedPlan = normalizeSubscriptionPlan(value);

  if (normalizedPlan) {
    return billingCatalog.subscriptions[normalizedPlan].displayName;
  }

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatSubscriptionInterval(value: null | string | undefined) {
  const normalizedInterval = normalizeSubscriptionInterval(value);

  if (normalizedInterval === "monthly") {
    return "monthly";
  }

  if (normalizedInterval === "yearly") {
    return "yearly";
  }

  return value?.trim() || undefined;
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

function isPaymentFailedEvent(event: Stripe.Event) {
  return event.type === "invoice.payment_failed";
}

function stripeObjectId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "id" in value &&
    typeof value.id === "string"
  ) {
    return value.id;
  }

  return null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    parent?: {
      subscription_details?: {
        subscription?: unknown;
      };
    };
    subscription?: unknown;
  };

  return (
    stripeObjectId(invoiceWithSubscription.subscription) ??
    stripeObjectId(
      invoiceWithSubscription.parent?.subscription_details?.subscription,
    )
  );
}

async function resolveInvoiceRecipient(invoice: Stripe.Invoice) {
  const metadataUserId = invoice.metadata?.userId;

  if (metadataUserId) {
    return {
      plan: invoice.metadata?.plan,
      recipientId: metadataUserId,
    };
  }

  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (stripeSubscriptionId) {
    const subscription =
      await getBillingSubscriptionByStripeSubscriptionId(stripeSubscriptionId);

    if (subscription) {
      return {
        plan: subscription.plan,
        recipientId: subscription.referenceId,
      };
    }
  }

  const stripeCustomerId = stripeObjectId(invoice.customer);
  if (stripeCustomerId) {
    const subscription =
      await getBillingSubscriptionByStripeCustomerId(stripeCustomerId);

    if (subscription) {
      return {
        plan: subscription.plan,
        recipientId: subscription.referenceId,
      };
    }
  }

  return null;
}

async function notifySubscriptionStarted({
  subscription,
}: {
  subscription: {
    billingInterval?: null | string;
    id: string;
    plan: string;
    referenceId: string;
    stripeSubscriptionId?: null | string;
  };
}) {
  await notifyBestEffort(
    {
      data: {
        interval: formatSubscriptionInterval(subscription.billingInterval),
        plan: formatSubscriptionPlan(subscription.plan),
      },
      idempotencyKey: `billing:subscription:${subscription.id}:started`,
      recipientId: subscription.referenceId,
      subject: {
        id: subscription.stripeSubscriptionId ?? subscription.id,
        type: "stripe_subscription",
      },
      type: "billing.subscription_started",
    },
    "billing.subscription_started",
  );
}

async function notifySubscriptionCanceled({
  subscription,
}: {
  subscription: {
    cancelAtPeriodEnd?: boolean | null;
    id: string;
    plan: string;
    referenceId: string;
    stripeSubscriptionId?: null | string;
  };
}) {
  await notifyBestEffort(
    {
      data: {
        cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
        plan: formatSubscriptionPlan(subscription.plan),
      },
      idempotencyKey: `billing:subscription:${subscription.id}:canceled`,
      recipientId: subscription.referenceId,
      subject: {
        id: subscription.stripeSubscriptionId ?? subscription.id,
        type: "stripe_subscription",
      },
      type: "billing.subscription_canceled",
    },
    "billing.subscription_canceled",
  );
}

async function notifyPaymentFailed(event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;
  const recipient = await resolveInvoiceRecipient(invoice);

  if (!recipient) {
    return;
  }

  await notifyBestEffort(
    {
      data: {
        invoiceId: invoice.id ?? event.id,
        plan: recipient.plan,
      },
      idempotencyKey: `billing:payment_failed:${invoice.id ?? event.id}`,
      recipientId: recipient.recipientId,
      subject: {
        id: invoice.id ?? event.id,
        type: "stripe_invoice",
      },
      type: "billing.payment_failed",
    },
    "billing.payment_failed",
  );
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
      const session = event.data.object as Stripe.Checkout.Session;
      await enqueueStripeWebhookJob({
        eventId: event.id,
        eventType: event.type as
          | "checkout.session.async_payment_succeeded"
          | "checkout.session.completed",
        objectId: session.id,
      });
    }

    if (isPaymentFailedEvent(event)) {
      await notifyPaymentFailed(event);
    }
  },
  subscription: {
    enabled: true,
    async onSubscriptionComplete({ subscription }) {
      const result = await reconcileCreditGrantForSubscription(subscription);

      if (result?.grantCreated) {
        await notifySubscriptionStarted({ subscription });
        await trackSubscriptionStarted({ subscription });
      }
    },
    async onSubscriptionCreated({ subscription }) {
      const result = await reconcileCreditGrantForSubscription(subscription);

      if (result?.grantCreated) {
        await notifySubscriptionStarted({ subscription });
        await trackSubscriptionStarted({ subscription });
      }
    },
    async onSubscriptionCancel({ subscription }) {
      const plan = normalizeSubscriptionPlan(subscription.plan);
      const billingInterval = normalizeSubscriptionInterval(
        subscription.billingInterval,
      );

      if (plan && billingInterval) {
        await notifySubscriptionCanceled({ subscription });
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
