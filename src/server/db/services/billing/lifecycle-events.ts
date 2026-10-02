import { analytics } from "@/adapters/analytics/server";
import type { StripeInvoice } from "@/adapters/stripe/billing-provider";
import {
  getBillingSubscriptionByStripeCustomerId,
  getBillingSubscriptionByStripeSubscriptionId,
} from "@/server/db/dal/billing";
import { reconcileCreditGrantForSubscription } from "@/server/db/services/credits/ledger";
import { notifyBestEffort } from "@/server/db/services/notifications/service";
import {
  billingCatalog,
  normalizeBillingInterval,
  normalizeBillingPlan,
} from "@/shared/billing";

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return typeof value.id === "string" ? value.id : null;
  }
  return null;
}

function invoiceSubscriptionId(invoice: StripeInvoice) {
  const value = invoice as StripeInvoice & {
    parent?: { subscription_details?: { subscription?: unknown } };
    subscription?: unknown;
  };
  return (
    stripeObjectId(value.subscription) ??
    stripeObjectId(value.parent?.subscription_details?.subscription)
  );
}

function displayPlan(plan: string) {
  const key = normalizeBillingPlan(plan);
  return key ? billingCatalog.plans[key].displayName : plan;
}

export async function handleSubscriptionStarted(subscription: {
  billingInterval?: null | string;
  id: string;
  plan: string;
  referenceId: string;
  stripeSubscriptionId?: null | string;
}) {
  const result = await reconcileCreditGrantForSubscription(subscription);
  if (!result?.grantCreated) return result;
  const plan = normalizeBillingPlan(subscription.plan);
  const interval = normalizeBillingInterval(subscription.billingInterval);
  await notifyBestEffort(
    {
      data: {
        interval: interval ?? undefined,
        plan: displayPlan(subscription.plan),
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
  if (plan && plan !== "free" && interval) {
    await analytics.trackAuthoritative(
      "subscription_started",
      {
        billingInterval: interval === "annual" ? "yearly" : "monthly",
        plan,
      },
      { context: { distinctId: subscription.referenceId } },
    );
  }
  return result;
}

export async function handleSubscriptionUpdated(
  subscription: Parameters<typeof reconcileCreditGrantForSubscription>[0],
) {
  return reconcileCreditGrantForSubscription(subscription);
}

export async function handleSubscriptionCanceled(subscription: {
  billingInterval?: null | string;
  cancelAtPeriodEnd?: boolean | null;
  id: string;
  plan: string;
  referenceId: string;
  stripeSubscriptionId?: null | string;
}) {
  const plan = normalizeBillingPlan(subscription.plan);
  const interval = normalizeBillingInterval(subscription.billingInterval);
  await notifyBestEffort(
    {
      data: {
        cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
        plan: displayPlan(subscription.plan),
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
  if (plan && plan !== "free" && interval) {
    await analytics.trackAuthoritative(
      "subscription_cancelled",
      {
        billingInterval: interval === "annual" ? "yearly" : "monthly",
        cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
        plan,
      },
      { context: { distinctId: subscription.referenceId } },
    );
  }
}

export async function handlePaymentFailedInvoice(
  invoice: StripeInvoice,
  eventId: string,
) {
  let recipient = invoice.metadata?.userId
    ? { plan: invoice.metadata.plan, recipientId: invoice.metadata.userId }
    : null;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!recipient && subscriptionId) {
    const record =
      await getBillingSubscriptionByStripeSubscriptionId(subscriptionId);
    if (record)
      recipient = { plan: record.plan, recipientId: record.referenceId };
  }
  const customerId = stripeObjectId(invoice.customer);
  if (!recipient && customerId) {
    const record = await getBillingSubscriptionByStripeCustomerId(customerId);
    if (record)
      recipient = { plan: record.plan, recipientId: record.referenceId };
  }
  if (!recipient) return;
  await notifyBestEffort(
    {
      data: { invoiceId: invoice.id ?? eventId, plan: recipient.plan },
      idempotencyKey: `billing:payment_failed:${invoice.id ?? eventId}`,
      recipientId: recipient.recipientId,
      subject: { id: invoice.id ?? eventId, type: "stripe_invoice" },
      type: "billing.payment_failed",
    },
    "billing.payment_failed",
  );
}
