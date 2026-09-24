import Stripe from "stripe";

import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import {
  type BillingSubscriptionRecord,
  updateBillingSubscription,
} from "@/server/db/dal/billing";
import { env } from "@/shared/env";

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
});

type StripeSubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
  current_period_end?: number;
  current_period_start?: number;
};

export type BillingTransaction = {
  amountPaid: null | number;
  billingInterval: null | string;
  currency: string;
  expiresAt: Date | null;
  hostedInvoiceUrl: null | string;
  id: string;
  invoiceNumber: null | string;
  planName: null | string;
  status: null | string;
  timestamp: Date;
};

const activeStatuses = new Set(["active", "trialing"]);

function getPrimarySubscriptionItem(stripeSubscription: Stripe.Subscription) {
  return stripeSubscription.items.data.find(
    (item): item is StripeSubscriptionItemWithPeriod =>
      Boolean(item.price.recurring),
  );
}

function resolvePlanName(stripePrice: Stripe.Price, fallbackPlanName: string) {
  const plan = subscriptionPlans.find(
    (plan) =>
      "lookupKey" in plan &&
      (plan.lookupKey === stripePrice.lookup_key ||
        plan.annualDiscountLookupKey === stripePrice.lookup_key),
  );

  return plan?.name.toLowerCase() ?? fallbackPlanName;
}

function resolvePlanDisplayName(stripePrice: Stripe.Price) {
  return (
    subscriptionPlans.find(
      (plan) =>
        "lookupKey" in plan &&
        (plan.lookupKey === stripePrice.lookup_key ||
          plan.annualDiscountLookupKey === stripePrice.lookup_key),
    )?.name ?? null
  );
}

function getInvoicePlanLine(invoice: Stripe.Invoice) {
  return (
    invoice.lines.data.find((line) => line.pricing?.price_details) ??
    invoice.lines.data[0]
  );
}

function getInvoicePlanName(invoice: Stripe.Invoice) {
  const planLine = getInvoicePlanLine(invoice);
  const price = planLine?.pricing?.price_details?.price;

  if (price && typeof price !== "string") {
    const planName = resolvePlanDisplayName(price);

    if (planName) {
      return planName;
    }
  }

  return planLine?.description ?? null;
}

function getInvoiceBillingInterval(invoice: Stripe.Invoice) {
  const price = getInvoicePlanLine(invoice)?.pricing?.price_details?.price;

  return price && typeof price !== "string"
    ? (price.recurring?.interval ?? null)
    : null;
}

function getInvoiceExpiresAt(invoice: Stripe.Invoice) {
  return fromStripeTimestamp(getInvoicePlanLine(invoice)?.period.end);
}

function normalizePlanName(value: null | string | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? null;
}

function planMatches(first: null | string | undefined, second: string) {
  const normalizedFirst = normalizePlanName(first);
  const normalizedSecond = normalizePlanName(second);

  if (normalizedFirst === normalizedSecond) {
    return true;
  }

  const matchingPlan = subscriptionPlans.find((plan) => {
    if (!("limits" in plan)) {
      return false;
    }

    const planKey =
      typeof plan.limits === "object" &&
      plan.limits !== null &&
      "plan" in plan.limits
        ? plan.limits.plan
        : null;

    return (
      normalizePlanName(plan.name) === normalizedFirst ||
      normalizePlanName(plan.name) === normalizedSecond ||
      normalizePlanName(typeof planKey === "string" ? planKey : null) ===
        normalizedFirst ||
      normalizePlanName(typeof planKey === "string" ? planKey : null) ===
        normalizedSecond
    );
  });

  if (!matchingPlan || !("limits" in matchingPlan)) {
    return false;
  }

  const planKey =
    typeof matchingPlan.limits === "object" &&
    matchingPlan.limits !== null &&
    "plan" in matchingPlan.limits
      ? matchingPlan.limits.plan
      : null;

  const normalizedPlanName = normalizePlanName(matchingPlan.name);
  const normalizedPlanKey = normalizePlanName(
    typeof planKey === "string" ? planKey : null,
  );

  return (
    (normalizedFirst === normalizedPlanName ||
      normalizedFirst === normalizedPlanKey) &&
    (normalizedSecond === normalizedPlanName ||
      normalizedSecond === normalizedPlanKey)
  );
}

function formatSubscriptionPlanName(value: string) {
  const matchingPlan = subscriptionPlans.find((plan) =>
    planMatches(plan.name, value),
  );

  if (matchingPlan) {
    return matchingPlan.name;
  }

  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fromStripeTimestamp(value?: null | number) {
  return value ? new Date(value * 1000) : null;
}

async function syncSubscriptionFromStripe(
  subscription: BillingSubscriptionRecord,
) {
  if (!subscription.stripeSubscriptionId) {
    return subscription;
  }

  const stripeSubscription = await stripeClient.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  );
  const subscriptionItem = getPrimarySubscriptionItem(stripeSubscription);

  if (!subscriptionItem) {
    return subscription;
  }

  return (
    (await updateBillingSubscription(subscription.id, {
      billingInterval: subscriptionItem.price.recurring?.interval,
      cancelAt: fromStripeTimestamp(stripeSubscription.cancel_at),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: fromStripeTimestamp(stripeSubscription.canceled_at),
      endedAt: fromStripeTimestamp(stripeSubscription.ended_at),
      periodEnd: fromStripeTimestamp(subscriptionItem.current_period_end),
      periodStart: fromStripeTimestamp(subscriptionItem.current_period_start),
      plan: resolvePlanName(subscriptionItem.price, subscription.plan),
      seats: subscriptionItem.quantity,
      status: stripeSubscription.status,
      stripeScheduleId:
        typeof stripeSubscription.schedule === "string"
          ? stripeSubscription.schedule
          : (stripeSubscription.schedule?.id ?? null),
      stripeSubscriptionId: stripeSubscription.id,
    })) ?? subscription
  );
}

export async function syncBillingSubscriptionsFromStripe(
  subscriptions: BillingSubscriptionRecord[],
) {
  const syncedSubscriptions = [];

  for (const subscription of subscriptions) {
    try {
      syncedSubscriptions.push(await syncSubscriptionFromStripe(subscription));
    } catch (error) {
      console.warn(
        `Unable to sync Stripe subscription ${subscription.stripeSubscriptionId}:`,
        error,
      );
      syncedSubscriptions.push(subscription);
    }
  }

  return syncedSubscriptions;
}

function isSameSubscriptionPeriod(
  transaction: BillingTransaction,
  subscription: BillingSubscriptionRecord,
) {
  return (
    transaction.expiresAt?.getTime() === subscription.periodEnd?.getTime() &&
    transaction.billingInterval === subscription.billingInterval &&
    planMatches(transaction.planName, subscription.plan)
  );
}

function createCurrentSubscriptionTransaction(
  subscription: BillingSubscriptionRecord,
  matchingTransaction?: BillingTransaction,
): BillingTransaction {
  return {
    amountPaid: matchingTransaction?.amountPaid ?? null,
    billingInterval: subscription.billingInterval,
    currency: matchingTransaction?.currency ?? "usd",
    expiresAt: subscription.periodEnd,
    hostedInvoiceUrl: matchingTransaction?.hostedInvoiceUrl ?? null,
    id: `subscription:${subscription.id}`,
    invoiceNumber: matchingTransaction?.invoiceNumber ?? null,
    planName: formatSubscriptionPlanName(subscription.plan),
    status: subscription.status,
    timestamp: subscription.periodStart ?? new Date(),
  };
}

export async function getBillingTransactions(
  customerId?: null | string,
  currentSubscription?: BillingSubscriptionRecord,
) {
  const shouldIncludeCurrentSubscription = Boolean(
    currentSubscription?.stripeSubscriptionId &&
      activeStatuses.has(currentSubscription.status ?? ""),
  );

  if (!customerId) {
    return shouldIncludeCurrentSubscription && currentSubscription
      ? [createCurrentSubscriptionTransaction(currentSubscription)]
      : [];
  }

  const invoices = await stripeClient.invoices.list({
    customer: customerId,
    expand: ["data.lines.data.pricing.price_details.price"],
    limit: 10,
  });

  const transactions = invoices.data.map((invoice): BillingTransaction => {
    return {
      amountPaid: invoice.amount_paid,
      billingInterval: getInvoiceBillingInterval(invoice),
      currency: invoice.currency,
      expiresAt: getInvoiceExpiresAt(invoice),
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      id: invoice.id,
      invoiceNumber: invoice.number,
      planName: getInvoicePlanName(invoice),
      status: invoice.status,
      timestamp: new Date(invoice.created * 1000),
    };
  });

  if (shouldIncludeCurrentSubscription && currentSubscription) {
    const matchingTransaction = transactions.find((transaction) =>
      isSameSubscriptionPeriod(transaction, currentSubscription),
    );

    return [
      createCurrentSubscriptionTransaction(
        currentSubscription,
        matchingTransaction,
      ),
      ...transactions.filter(
        (transaction) =>
          !isSameSubscriptionPeriod(transaction, currentSubscription),
      ),
    ];
  }

  return transactions;
}
