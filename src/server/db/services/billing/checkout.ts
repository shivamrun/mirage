import { billingCatalog } from "@/server/db/services/billing/catalog";
import { getBillingStripeClient } from "@/server/db/services/billing/stripe-client";
import { env } from "@/shared/env";

type CreateBillingCheckoutSessionInput = {
  customerEmail: string;
  stripeCustomerId?: null | string;
  type: "credit_top_up";
  userId: string;
};

async function resolvePrice({
  amount,
  currency,
  interval,
  lookupKey,
}: {
  amount?: number;
  currency?: string;
  interval?: "month" | "year";
  lookupKey: string;
}) {
  const prices = await getBillingStripeClient().prices.list({
    active: true,
    expand: ["data.product"],
    limit: 1,
    lookup_keys: [lookupKey],
  });
  const price = prices.data[0];

  if (
    !price ||
    price.lookup_key !== lookupKey ||
    (typeof amount === "number" && price.unit_amount !== amount) ||
    (currency && price.currency !== currency) ||
    (interval
      ? price.recurring?.interval !== interval
      : Boolean(price.recurring))
  ) {
    throw new Error("Stripe billing price is not configured correctly.");
  }

  return price;
}

function customerFields({
  customerEmail,
  stripeCustomerId,
}: {
  customerEmail: string;
  stripeCustomerId?: null | string;
}) {
  return {
    customer: stripeCustomerId ?? undefined,
    customer_email: stripeCustomerId ? undefined : customerEmail,
  };
}

export async function createBillingCheckoutSession(
  input: CreateBillingCheckoutSessionInput,
) {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL;

  const price = await resolvePrice({
    amount: billingCatalog.creditTopUp.amount,
    currency: billingCatalog.creditTopUp.currency,
    lookupKey: billingCatalog.creditTopUp.lookupKey,
  });

  return getBillingStripeClient().checkout.sessions.create({
    cancel_url: `${baseUrl}/billing?checkout=cancelled`,
    client_reference_id: input.userId,
    ...customerFields(input),
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      credits: String(billingCatalog.creditTopUp.credits),
      lookupKey: billingCatalog.creditTopUp.lookupKey,
      purchaseType: "credit_top_up",
      userId: input.userId,
    },
    mode: "payment",
    success_url: `${baseUrl}/billing?checkout=success`,
  });
}
