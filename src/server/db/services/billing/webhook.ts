import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import db from "@/server/db";
import { subscription, user } from "@/server/db/schema";
import {
  billingCatalog,
  getSubscriptionPlanByLookupKey,
} from "@/server/db/services/billing/catalog";
import { getBillingStripeClient } from "@/server/db/services/billing/stripe-client";
import { reconcileCreditGrantForSubscription } from "@/server/db/services/credits/ledger";
import { grantCreditTopUpForCheckoutSession } from "@/server/db/services/credits/top-up";
import { env } from "@/shared/env";

type StripeSubscriptionItemWithPeriod = Stripe.SubscriptionItem & {
  current_period_end?: number;
  current_period_start?: number;
};

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string,
) {
  return metadata?.[key] ?? null;
}

function fromStripeTimestamp(value?: null | number) {
  return value ? new Date(value * 1000) : null;
}

function getPrimarySubscriptionItem(stripeSubscription: Stripe.Subscription) {
  return stripeSubscription.items.data.find(
    (item): item is StripeSubscriptionItemWithPeriod =>
      Boolean(item.price.recurring),
  );
}

async function rememberStripeCustomer({
  stripeCustomerId,
  userId,
}: {
  stripeCustomerId?: null | string;
  userId?: null | string;
}) {
  if (!stripeCustomerId || !userId) {
    return;
  }

  await db.update(user).set({ stripeCustomerId }).where(eq(user.id, userId));
}

function getCustomerId(value: Stripe.Checkout.Session | Stripe.Subscription) {
  return typeof value.customer === "string"
    ? value.customer
    : value.customer?.id;
}

export async function reconcileStripeSubscription(
  stripeSubscription: Stripe.Subscription,
) {
  const subscriptionItem = getPrimarySubscriptionItem(stripeSubscription);
  const price = subscriptionItem?.price;
  const plan = getSubscriptionPlanByLookupKey(price?.lookup_key);
  const userId = metadataValue(stripeSubscription.metadata, "userId");
  const stripeCustomerId = getCustomerId(stripeSubscription);

  if (!subscriptionItem || !price || !plan || !userId) {
    throw new Error("Stripe subscription is missing Mirage billing metadata.");
  }

  await rememberStripeCustomer({ stripeCustomerId, userId });

  const values = {
    billingInterval: price.recurring?.interval ?? plan.interval,
    cancelAt: fromStripeTimestamp(stripeSubscription.cancel_at),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: fromStripeTimestamp(stripeSubscription.canceled_at),
    endedAt: fromStripeTimestamp(stripeSubscription.ended_at),
    periodEnd: fromStripeTimestamp(subscriptionItem.current_period_end),
    periodStart: fromStripeTimestamp(subscriptionItem.current_period_start),
    plan: plan.plan,
    referenceId: userId,
    seats: subscriptionItem.quantity,
    status: stripeSubscription.status,
    stripeCustomerId,
    stripeScheduleId:
      typeof stripeSubscription.schedule === "string"
        ? stripeSubscription.schedule
        : (stripeSubscription.schedule?.id ?? null),
    stripeSubscriptionId: stripeSubscription.id,
  };

  const [existingSubscription] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, stripeSubscription.id));

  const [record] = existingSubscription
    ? await db
        .update(subscription)
        .set(values)
        .where(eq(subscription.id, existingSubscription.id))
        .returning()
    : await db
        .insert(subscription)
        .values({ id: randomUUID(), ...values })
        .returning();

  if (!record) {
    throw new Error("Stripe subscription could not be reconciled.");
  }

  await reconcileCreditGrantForSubscription(record);

  return record;
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  const stripeCustomerId = getCustomerId(session);
  const userId =
    metadataValue(session.metadata, "userId") ?? session.client_reference_id;

  await rememberStripeCustomer({ stripeCustomerId, userId });

  if (session.mode === "payment") {
    if (
      metadataValue(session.metadata, "lookupKey") !==
      billingCatalog.creditTopUp.lookupKey
    ) {
      return;
    }

    await grantCreditTopUpForCheckoutSession(session);
    return;
  }

  if (session.mode === "subscription" && session.subscription) {
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;
    const stripeSubscription =
      await getBillingStripeClient().subscriptions.retrieve(subscriptionId);

    await reconcileStripeSubscription(stripeSubscription);
  }
}

export async function constructBillingStripeEvent({
  body,
  signature,
}: {
  body: string;
  signature: string;
}) {
  return getBillingStripeClient().webhooks.constructEventAsync(
    body,
    signature,
    env.STRIPE_WEBHOOK_SECRET,
  );
}

export async function handleBillingStripeEvent(event: Stripe.Event) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    await reconcileStripeSubscription(event.data.object as Stripe.Subscription);
  }
}
