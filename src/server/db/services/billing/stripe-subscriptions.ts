import {
  type StripeInvoice,
  type StripePrice,
  type StripeSubscription,
  type StripeSubscriptionItem,
  stripeBillingProvider,
} from "@/adapters/stripe/billing-provider";

import {
  applyBillingSubscriptionStripeEvent,
  type BillingSubscriptionRecord,
} from "@/server/db/dal/billing";
import {
  billingPlansMatch,
  getBillingPlanByLookupKey,
  getBillingPlanDisplayName,
  normalizeBillingPlan,
} from "@/shared/billing";

type StripeSubscriptionItemWithPeriod = StripeSubscriptionItem & {
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

function getPrimarySubscriptionItem(stripeSubscription: StripeSubscription) {
  return stripeSubscription.items.data.find(
    (item): item is StripeSubscriptionItemWithPeriod =>
      Boolean(item.price.recurring),
  );
}

function resolvePlanName(stripePrice: StripePrice, fallbackPlanName: string) {
  return (
    getBillingPlanByLookupKey(stripePrice.lookup_key)?.key ??
    normalizeBillingPlan(fallbackPlanName) ??
    fallbackPlanName
  );
}

function resolvePlanDisplayName(stripePrice: StripePrice) {
  const match = getBillingPlanByLookupKey(stripePrice.lookup_key);
  return match ? match.plan.displayName : null;
}

function getInvoicePlanLine(invoice: StripeInvoice) {
  return (
    invoice.lines.data.find((line) => line.pricing?.price_details) ??
    invoice.lines.data[0]
  );
}

function getInvoicePlanName(invoice: StripeInvoice) {
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

function getInvoiceBillingInterval(invoice: StripeInvoice) {
  const price = getInvoicePlanLine(invoice)?.pricing?.price_details?.price;

  return price && typeof price !== "string"
    ? (price.recurring?.interval ?? null)
    : null;
}

function getInvoiceExpiresAt(invoice: StripeInvoice) {
  return fromStripeTimestamp(getInvoicePlanLine(invoice)?.period.end);
}

function planMatches(first: null | string | undefined, second: string) {
  return billingPlansMatch(first, second);
}

function formatSubscriptionPlanName(value: string) {
  return getBillingPlanDisplayName(value) ?? value;
}

function fromStripeTimestamp(value?: null | number) {
  return value ? new Date(value * 1000) : null;
}

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return typeof value.id === "string" ? value.id : null;
  }
  return null;
}

export async function applySubscriptionStateFromStripeEvent({
  eventCreatedAt,
  localSubscription,
  stripeSubscription,
}: {
  eventCreatedAt: number;
  localSubscription: BillingSubscriptionRecord;
  stripeSubscription: StripeSubscription;
}) {
  const subscriptionItem = getPrimarySubscriptionItem(stripeSubscription);
  if (!subscriptionItem) {
    throw new Error("Stripe subscription has no recurring subscription item.");
  }

  const eventSubscription = {
    ...localSubscription,
    billingInterval: subscriptionItem.price.recurring?.interval ?? null,
    cancelAt: fromStripeTimestamp(stripeSubscription.cancel_at),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: fromStripeTimestamp(stripeSubscription.canceled_at),
    endedAt: fromStripeTimestamp(stripeSubscription.ended_at),
    periodEnd: fromStripeTimestamp(subscriptionItem.current_period_end),
    periodStart: fromStripeTimestamp(subscriptionItem.current_period_start),
    plan: resolvePlanName(subscriptionItem.price, localSubscription.plan),
    seats: subscriptionItem.quantity ?? null,
    status: stripeSubscription.status,
    stripeCustomerId:
      stripeObjectId(stripeSubscription.customer) ??
      localSubscription.stripeCustomerId,
    stripeScheduleId: stripeObjectId(stripeSubscription.schedule),
    stripeSubscriptionId: stripeSubscription.id,
  } satisfies BillingSubscriptionRecord;

  const persisted = await applyBillingSubscriptionStripeEvent({
    eventCreatedAt,
    id: localSubscription.id,
    values: eventSubscription,
  });

  return { applied: Boolean(persisted), eventSubscription };
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

  const invoices = await stripeBillingProvider.listInvoices(customerId);

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
