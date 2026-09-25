import Stripe from "stripe";

import { grantCreditTopUp } from "@/server/db/services/credits/ledger";
import { env } from "@/shared/env";

export const creditTopUpProduct = {
  amount: 5000,
  checkoutLookupKey: "one_time_credit",
  credits: 200,
  currency: "usd",
} as const;

type CreditTopUpStripeClient = Pick<Stripe, "checkout" | "prices" | "webhooks">;

let stripeClient: CreditTopUpStripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
});

export function setCreditTopUpStripeClientForTests(
  client: CreditTopUpStripeClient,
) {
  if (env.NODE_ENV !== "test") {
    throw new Error("Stripe test client override is only available in tests.");
  }

  stripeClient = client;
}

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  return metadata?.[key] ?? null;
}

async function resolveCreditTopUpPrice() {
  const prices = await stripeClient.prices.list({
    active: true,
    expand: ["data.product"],
    limit: 1,
    lookup_keys: [creditTopUpProduct.checkoutLookupKey],
  });
  const price = prices.data[0];

  if (
    !price ||
    price.lookup_key !== creditTopUpProduct.checkoutLookupKey ||
    price.unit_amount !== creditTopUpProduct.amount ||
    price.currency !== creditTopUpProduct.currency ||
    price.recurring
  ) {
    throw new Error("Stripe credit top-up price is not configured correctly.");
  }

  return price;
}

export async function createCreditTopUpCheckoutSession({
  cancelUrl,
  customerEmail,
  stripeCustomerId,
  successUrl,
  userId,
}: {
  cancelUrl: string;
  customerEmail: string;
  stripeCustomerId?: null | string;
  successUrl: string;
  userId: string;
}) {
  const price = await resolveCreditTopUpPrice();

  return stripeClient.checkout.sessions.create({
    cancel_url: cancelUrl,
    client_reference_id: userId,
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : customerEmail,
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    metadata: {
      credits: String(creditTopUpProduct.credits),
      lookupKey: creditTopUpProduct.checkoutLookupKey,
      userId,
    },
    mode: "payment",
    success_url: successUrl,
  });
}

async function assertCheckoutSessionUsesTopUpPrice(sessionId: string) {
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

export async function grantCreditTopUpForCheckoutSessionId({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  const session = await stripeClient.checkout.sessions.retrieve(sessionId);
  const sessionUserId =
    metadataValue(session.metadata, "userId") ?? session.client_reference_id;

  if (sessionUserId !== userId) {
    throw new Error("Stripe checkout session does not belong to this user.");
  }

  return grantCreditTopUpForCheckoutSession(session);
}

export async function constructCreditTopUpStripeEvent({
  body,
  signature,
}: {
  body: string;
  signature: string;
}) {
  return stripeClient.webhooks.constructEventAsync(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}
