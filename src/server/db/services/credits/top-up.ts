import {
  analyticsAttributionFromMetadata,
  normalizeAnalyticsCurrency,
} from "@/adapters/analytics/events";
import {
  type StripeCheckoutSession,
  type StripeMetadata,
  stripeBillingProvider,
} from "@/adapters/stripe/billing-provider";
import {
  getCreditPurchaseByCheckoutSessionId,
  markCreditPurchaseFulfilled,
  markCreditPurchasePaid,
} from "@/server/db/dal/billing-purchases";
import { queueBillingAnalytics } from "@/server/db/services/billing/analytics";
import {
  type BillingStripeClient,
  setBillingStripeClientForTests,
} from "@/server/db/services/billing/stripe-client";
import { grantCreditTopUp } from "@/server/db/services/credits/ledger";
import { notifyBestEffort } from "@/server/db/services/notifications/service";
import { billingCatalog } from "@/shared/billing";

export const creditTopUpProduct = {
  amount: billingCatalog.creditTopUp.amount,
  checkoutLookupKey: billingCatalog.creditTopUp.lookupKey,
  credits: billingCatalog.creditTopUp.credits,
  currency: billingCatalog.creditTopUp.currency,
} as const;

export function setCreditTopUpStripeClientForTests(
  client: BillingStripeClient,
) {
  setBillingStripeClientForTests(client);
}

function metadataValue(
  metadata: StripeMetadata | null | undefined,
  key: string,
) {
  return metadata?.[key] ?? null;
}

async function assertCheckoutSessionUsesTopUpPrice(sessionId: string) {
  const lineItems =
    await stripeBillingProvider.listCheckoutLineItems(sessionId);
  const price = lineItems.data[0]?.price;

  if (
    !price ||
    typeof price === "string" ||
    price.lookup_key !== creditTopUpProduct.checkoutLookupKey
  ) {
    throw new Error("Stripe checkout session is not for credit top-up.");
  }
}

export async function grantCreditTopUpForCheckoutSession(
  session: StripeCheckoutSession,
  occurredAt: Date,
) {
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return null;
  }

  const lookupKey = metadataValue(session.metadata, "lookupKey");
  const userId =
    metadataValue(session.metadata, "userId") ?? session.client_reference_id;
  const credits = Number(metadataValue(session.metadata, "credits"));

  if (
    lookupKey !== creditTopUpProduct.checkoutLookupKey ||
    userId === null ||
    credits !== creditTopUpProduct.credits ||
    session.amount_total !== creditTopUpProduct.amount ||
    session.currency !== creditTopUpProduct.currency
  ) {
    throw new Error("Stripe credit top-up checkout session is invalid.");
  }

  await assertCheckoutSessionUsesTopUpPrice(session.id);
  const purchase = await getCreditPurchaseByCheckoutSessionId(session.id);
  if (
    !purchase ||
    metadataValue(session.metadata, "purchaseId") !== purchase.id ||
    purchase.userId !== userId ||
    purchase.packageKey !== billingCatalog.creditTopUp.key ||
    purchase.amount !== creditTopUpProduct.amount ||
    purchase.currency !== creditTopUpProduct.currency ||
    purchase.credits !== creditTopUpProduct.credits
  ) {
    throw new Error("Stripe credit top-up purchase does not match checkout.");
  }
  await markCreditPurchasePaid({
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id,
    purchaseId: purchase.id,
  });

  const result = await grantCreditTopUp({
    amount: creditTopUpProduct.credits,
    idempotencyKey: `stripe_checkout:${session.id}`,
    metadata: {
      amountTotal: session.amount_total,
      currency: session.currency,
      lookupKey,
      stripeCheckoutSessionId: session.id,
    },
    sourceId: session.id,
    userId,
  });

  await markCreditPurchaseFulfilled(purchase.id);

  await notifyBestEffort(
    {
      data: { amount: creditTopUpProduct.credits },
      idempotencyKey: `billing:credit_top_up:${session.id}`,
      recipientId: userId,
      subject: {
        id: session.id,
        type: "stripe_checkout_session",
      },
      type: "billing.credit_top_up_completed",
    },
    "billing.credit_top_up_completed",
  );

  await queueBillingAnalytics(
    `credits_purchased:${session.id}`,
    {
      event: "credits_purchased",
      properties: {
        attribution: analyticsAttributionFromMetadata(session.metadata),
        credits: creditTopUpProduct.credits,
        currency: normalizeAnalyticsCurrency(creditTopUpProduct.currency),
        revenue: creditTopUpProduct.amount / 100,
      },
      context: { distinctId: userId, url: "/billing" },
    },
    occurredAt,
  );

  return result;
}
