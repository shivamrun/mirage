import type Stripe from "stripe";

import { billingCatalog } from "@/server/db/services/billing/catalog";
import {
  type BillingStripeClient,
  getBillingStripeClient,
  setBillingStripeClientForTests,
} from "@/server/db/services/billing/stripe-client";
import { grantCreditTopUp } from "@/server/db/services/credits/ledger";

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
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  return metadata?.[key] ?? null;
}

async function assertCheckoutSessionUsesTopUpPrice(sessionId: string) {
  const stripeClient = getBillingStripeClient();
  const lineItems = await stripeClient.checkout.sessions.listLineItems(
    sessionId,
    {
      expand: ["data.price"],
      limit: 1,
    },
  );
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
  session: Stripe.Checkout.Session,
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

  return grantCreditTopUp({
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
}
