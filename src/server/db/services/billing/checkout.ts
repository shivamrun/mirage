import type { AnalyticsAttribution } from "@/adapters/analytics/events";
import { compactAnalyticsAttribution } from "@/adapters/analytics/events";
import { stripeBillingProvider } from "@/adapters/stripe/billing-provider";
import {
  createOrGetCreditPurchase,
  markCreditPurchaseCheckoutCreated,
} from "@/server/db/dal/billing-purchases";
import { billingCatalog } from "@/shared/billing";
import { env } from "@/shared/env";

type CreateBillingCheckoutSessionInput = {
  attribution?: AnalyticsAttribution;
  customerEmail: string;
  requestId: string;
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
  const price = await stripeBillingProvider.getPriceByLookupKey(lookupKey);

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

function attributionMetadata(attribution: AnalyticsAttribution | undefined) {
  const compacted = compactAnalyticsAttribution(attribution);

  if (!compacted) {
    return {};
  }

  return Object.fromEntries(
    Object.entries({
      analytics_creator: compacted.creator,
      analytics_landing_path: compacted.landingPath,
      analytics_referrer_domain: compacted.referrerDomain,
      analytics_utm_campaign: compacted.utmCampaign,
      analytics_utm_content: compacted.utmContent,
      analytics_utm_medium: compacted.utmMedium,
      analytics_utm_source: compacted.utmSource,
      analytics_utm_term: compacted.utmTerm,
    }).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;
}

export async function createBillingCheckoutSession(
  input: CreateBillingCheckoutSessionInput,
) {
  const baseUrl = env.NEXT_PUBLIC_BASE_URL;
  const purchase = await createOrGetCreditPurchase({
    amount: billingCatalog.creditTopUp.amount,
    credits: billingCatalog.creditTopUp.credits,
    currency: billingCatalog.creditTopUp.currency,
    packageKey: billingCatalog.creditTopUp.key,
    requestId: input.requestId,
    userId: input.userId,
  });

  if (purchase.stripeCheckoutSessionId) {
    const session = await stripeBillingProvider.retrieveCheckoutSession(
      purchase.stripeCheckoutSessionId,
    );
    return session;
  }

  const price = await resolvePrice({
    amount: billingCatalog.creditTopUp.amount,
    currency: billingCatalog.creditTopUp.currency,
    lookupKey: billingCatalog.creditTopUp.lookupKey,
  });
  const metadata = {
    credits: String(billingCatalog.creditTopUp.credits),
    lookupKey: billingCatalog.creditTopUp.lookupKey,
    purchaseType: "credit_top_up",
    purchaseId: purchase.id,
    userId: input.userId,
    ...attributionMetadata(input.attribution),
  };

  const session = await stripeBillingProvider.createCreditCheckout({
    cancelUrl: `${baseUrl}/billing?checkout=cancelled`,
    customerEmail: input.customerEmail,
    idempotencyKey: `credit-top-up:${input.requestId}`,
    metadata,
    priceId: price.id,
    stripeCustomerId: input.stripeCustomerId,
    successUrl: `${baseUrl}/billing?checkout=credit_top_up_success`,
    userId: input.userId,
  });

  await markCreditPurchaseCheckoutCreated({
    purchaseId: purchase.id,
    sessionId: session.id,
  });
  return session;
}
