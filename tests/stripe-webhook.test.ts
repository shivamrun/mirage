import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as analyticsConfig from "@/adapters/analytics/config";
import { analytics } from "@/adapters/analytics/server";
import {
  getBillingStripeClient,
  setBillingStripeClientForTests,
} from "@/adapters/stripe/client";
import db from "@/server/db";
import {
  createOrGetCreditPurchase,
  markCreditPurchaseCheckoutCreated,
} from "@/server/db/dal/billing-purchases";
import {
  claimStripeWebhookEvent,
  createOrGetStripeWebhookEvent,
  markStripeWebhookEventCompleted,
  markStripeWebhookEventFailed,
  markStripeWebhookEventRetrying,
} from "@/server/db/dal/stripe-webhook-events";
import {
  billingAnalytics,
  notification,
  stripeWebhookEvents,
  subscription,
  user,
} from "@/server/db/schema";
import { drainBillingAnalytics } from "@/server/db/services/billing/analytics";
import { processStoredStripeWebhook } from "@/server/db/services/billing/stripe-webhooks";
import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { setCreditTopUpStripeClientForTests } from "@/server/db/services/credits/top-up";
import { app } from "@/server/routes";
import { billingCatalog } from "@/shared/billing";
import { createTestActor } from "./infra/admin-actor";

const topUpSession = (userId: string, purchaseId?: string) => ({
  amount_total: 5000,
  client_reference_id: userId,
  currency: "usd",
  id: "cs_test_top_up",
  metadata: {
    credits: "200",
    lookupKey: "one_time_credit",
    purchaseType: "credit_top_up",
    ...(purchaseId ? { purchaseId } : {}),
    userId,
  },
  mode: "payment",
  object: "checkout.session",
  payment_status: "paid",
});

describe("Stripe subscription checkout analytics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("counts a subscription Checkout Session returned by the shared endpoint", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const track = vi.spyOn(analytics, "track");
    const createSession = vi.fn(
      async (params: Stripe.Checkout.SessionCreateParams) => ({
        client_reference_id: params.client_reference_id,
        id: "cs_test_subscription",
        metadata: params.metadata,
        mode: params.mode,
        object: "checkout.session",
        url: "https://checkout.stripe.test/session",
      }),
    );
    const fakeStripe = getBillingStripeClient();
    setBillingStripeClientForTests({
      ...fakeStripe,
      checkout: { sessions: { create: createSession } },
      prices: { list: async () => ({ data: [{ id: "price_pro" }] }) },
      subscriptions: { list: async () => ({ data: [] }) },
    } as never);

    const origin = "http://localhost:3000";
    const response = await app.fetch(
      new Request(`${origin}/api/auth/subscription/upgrade`, {
        body: JSON.stringify({
          disableRedirect: true,
          metadata: { analytics_utm_source: "youtube" },
          plan: billingCatalog.plans.pro.checkoutName,
        }),
        headers: {
          "content-type": "application/json",
          cookie: actor.cookie,
          origin,
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(createSession).toHaveBeenCalledOnce();
    expect(track).toHaveBeenCalledExactlyOnceWith(
      "subscription_checkout_started",
      {
        attribution: { utmSource: "youtube" },
        billingInterval: "monthly",
        plan: "pro",
      },
      { context: { distinctId: actor.id, url: "/checkout" } },
    );
  });
});

function subscriptionObject({
  lookupKey = "mirage_pro_2_monthly",
  plan = "pro",
  status = "active",
}: {
  lookupKey?: string;
  plan?: string;
  status?: string;
} = {}) {
  const periodStart = Math.floor(Date.now() / 1000) - 60;
  const periodEnd = periodStart + 60 * 60 * 24 * 30;

  return {
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    customer: "cus_test",
    ended_at: null,
    id: "sub_test",
    items: {
      data: [
        {
          current_period_end: periodEnd,
          current_period_start: periodStart,
          id: "si_test",
          object: "subscription_item",
          price: {
            id: `price_${lookupKey}`,
            lookup_key: lookupKey,
            object: "price",
            recurring: {
              interval: lookupKey.endsWith("_yearly") ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
      object: "list",
    },
    metadata: {
      analytics_utm_source: "youtube",
      lookupKey,
      plan,
    },
    object: "subscription",
    schedule: null,
    status,
  };
}

function setBetterAuthWebhookStripeClient({
  eventType,
  invoiceMetadata,
  invoiceSubscriptionId,
  throwOnConstruct = false,
  userId,
  purchaseId,
  subscriptionStatus,
  localSubscriptionId,
}: {
  eventType:
    | "checkout.session.completed"
    | "customer.subscription.created"
    | "invoice.paid"
    | "invoice.payment_failed";
  invoiceMetadata?: Record<string, string>;
  invoiceSubscriptionId?: string;
  throwOnConstruct?: boolean;
  userId: string;
  purchaseId?: string;
  subscriptionStatus?: string;
  localSubscriptionId?: string;
}) {
  const stripeSubscription = subscriptionObject({ status: subscriptionStatus });
  const stripeRecord = {
    ...stripeSubscription,
    metadata: {
      ...stripeSubscription.metadata,
      subscriptionId: localSubscriptionId,
    },
  };
  const event = {
    created: Math.floor(Date.now() / 1000),
    data: {
      object:
        eventType === "checkout.session.completed"
          ? topUpSession(userId, purchaseId)
          : eventType === "invoice.payment_failed"
            ? {
                customer: "cus_test",
                id: "in_test_failed",
                metadata: invoiceMetadata ?? {
                  plan: "Mirage Pro",
                  userId,
                },
                object: "invoice",
                parent: invoiceSubscriptionId
                  ? {
                      subscription_details: {
                        subscription: invoiceSubscriptionId,
                      },
                    }
                  : undefined,
              }
            : eventType === "invoice.paid"
              ? {
                  amount_paid: 2000,
                  billing_reason: "subscription_create",
                  currency: "usd",
                  id: "in_test_paid",
                  object: "invoice",
                  parent: {
                    subscription_details: { subscription: "sub_test" },
                  },
                  status: "paid",
                }
              : stripeRecord,
    },
    id: `evt_test_${eventType.replaceAll(".", "_")}_${randomUUID()}`,
    object: "event",
    type: eventType,
  };
  const invoice =
    eventType === "invoice.payment_failed" || eventType === "invoice.paid"
      ? event.data.object
      : null;
  setCreditTopUpStripeClientForTests({
    checkout: {
      sessions: {
        create: async () => ({
          id: "cs_test_top_up",
          object: "checkout.session",
          url: "https://checkout.stripe.test/session",
        }),
        listLineItems: async () => ({
          data: [
            {
              id: "li_test",
              object: "item",
              price: {
                id: "price_top_up",
                lookup_key: "one_time_credit",
                object: "price",
              },
            },
          ],
          has_more: false,
          object: "list",
          url: "/v1/checkout/sessions/cs_test_top_up/line_items",
        }),
        retrieve: async () => topUpSession(userId, purchaseId),
      },
    },
    customers: {
      create: async () => ({
        id: "cus_test",
        object: "customer",
      }),
    },
    prices: {
      list: async () => ({
        data: [],
        has_more: false,
        object: "list",
        url: "/v1/prices",
      }),
    },
    events: {
      retrieve: async () => event,
    },
    invoices: {
      retrieve: async () => invoice,
    },
    subscriptions: {
      retrieve: async () => stripeRecord,
    },
    webhooks: {
      constructEventAsync: async () => {
        if (throwOnConstruct) {
          throw new Error("invalid signature");
        }

        return event;
      },
    },
  } as never);
}

async function createTopUpPurchase(userId: string) {
  const purchase = await createOrGetCreditPurchase({
    amount: 5000,
    credits: 200,
    currency: "usd",
    packageKey: "standard",
    requestId: randomUUID(),
    userId,
  });
  await markCreditPurchaseCheckoutCreated({
    purchaseId: purchase.id,
    sessionId: "cs_test_top_up",
  });
  return purchase;
}

async function postBetterAuthStripeWebhook(body = "{}") {
  return app.fetch(
    new Request("http://localhost:3000/api/auth/stripe/webhook", {
      body,
      headers: {
        "content-type": "application/json",
        "stripe-signature": "valid_signature",
      },
      method: "POST",
    }),
  );
}

describe("Stripe webhook route", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is mounted through the Better Auth handler", async () => {
    const response = await app.fetch(
      new Request("http://localhost:3000/api/auth/stripe/webhook", {
        body: "{}",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "STRIPE_SIGNATURE_NOT_FOUND",
    });
  });

  it("rejects invalid Better Auth Stripe webhook signatures", async () => {
    const actor = await createTestActor();
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
      throwOnConstruct: true,
      userId: actor.id,
    });

    const invalidSignature = await postBetterAuthStripeWebhook();

    expect(invalidSignature.status).toBe(400);
  });

  it("grants one-time top-up credits idempotently through Better Auth onEvent", async () => {
    const actor = await createTestActor();
    const purchase = await createTopUpPurchase(actor.id);
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
      purchaseId: purchase.id,
      userId: actor.id,
    });

    for (const attempt of [1, 2]) {
      const response = await postBetterAuthStripeWebhook(
        JSON.stringify({ attempt }),
      );

      expect(response.status, await response.clone().text()).toBe(200);
    }

    const balance = await getCreditBalance(actor.id);

    expect(balance.account.availableCredits).toBe(210);
    expect(balance.account.carryForwardCredits).toBe(200);
    expect(
      balance.recentLedger.filter(
        (entry) => entry.idempotencyKey === "stripe_checkout:cs_test_top_up",
      ),
    ).toHaveLength(1);

    const notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientId, actor.id));

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "billing",
      idempotencyKey: "billing:credit_top_up:cs_test_top_up",
      subjectId: "cs_test_top_up",
      subjectType: "stripe_checkout_session",
      type: "billing.credit_top_up_completed",
    });
  });

  it("does not grant a top-up without its matching purchase", async () => {
    const actor = await createTestActor();
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
      purchaseId: randomUUID(),
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();
    expect(response.status).toBe(400);
    expect((await getCreditBalance(actor.id)).account.availableCredits).toBe(
      10,
    );
  });

  it("fulfills a top-up during webhook processing", async () => {
    const actor = await createTestActor();
    const purchase = await createTopUpPurchase(actor.id);
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
      purchaseId: purchase.id,
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();
    expect(response.status, await response.clone().text()).toBe(200);

    const balance = await getCreditBalance(actor.id);
    expect(balance.account.availableCredits).toBe(210);
  });

  it("grants no plan credits on an incomplete subscription", async () => {
    const actor = await createTestActor();
    vi.spyOn(analyticsConfig, "getServerAnalyticsConfig").mockReturnValue({
      enabled: true,
      hostUrl: "https://umami.test",
      websiteId: "test-site",
    });
    await db
      .update(user)
      .set({ stripeCustomerId: "cus_test" })
      .where(eq(user.id, actor.id));
    setBetterAuthWebhookStripeClient({
      eventType: "customer.subscription.created",
      subscriptionStatus: "incomplete",
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();
    expect(response.status, await response.clone().text()).toBe(200);
    expect((await getCreditBalance(actor.id)).account.availableCredits).toBe(
      10,
    );
    expect(await db.select().from(billingAnalytics)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(notification)
        .where(eq(notification.type, "billing.subscription_started")),
    ).toHaveLength(0);
  });

  it("queues initial payment before subscription creation and retries Umami independently", async () => {
    const actor = await createTestActor();
    const localSubscriptionId = randomUUID();
    await db.insert(subscription).values({
      id: localSubscriptionId,
      plan: "pro",
      referenceId: actor.id,
      status: "incomplete",
      stripeCustomerId: "cus_test",
    });
    vi.spyOn(analyticsConfig, "getServerAnalyticsConfig").mockReturnValue({
      enabled: true,
      hostUrl: "https://umami.test",
      websiteId: "test-site",
    });
    setBetterAuthWebhookStripeClient({
      eventType: "invoice.paid",
      localSubscriptionId,
      userId: actor.id,
    });
    const response = await postBetterAuthStripeWebhook();
    expect(response.status, await response.clone().text()).toBe(200);
    // Replay the same event, then send a distinct event for the same invoice.
    expect((await postBetterAuthStripeWebhook()).status).toBe(200);
    setBetterAuthWebhookStripeClient({
      eventType: "invoice.paid",
      localSubscriptionId,
      userId: actor.id,
    });
    expect((await postBetterAuthStripeWebhook()).status).toBe(200);
    const queued = await db.select().from(billingAnalytics);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.event).toMatchObject({
      event: "subscription_started",
      properties: {
        attribution: { utmSource: "youtube" },
        billingInterval: "monthly",
        currency: "USD",
        plan: "pro",
        revenue: 20,
      },
      context: { distinctId: actor.id },
    });

    const delivery = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", delivery);
    await drainBillingAnalytics();
    expect(delivery).toHaveBeenCalledTimes(1);
    expect(
      (await db.select().from(billingAnalytics))[0]?.deliveredAt,
    ).toBeNull();
    await db.update(billingAnalytics).set({ availableAt: new Date(0) });
    await drainBillingAnalytics();
    expect(delivery).toHaveBeenCalledTimes(2);
    const [delivered] = await db.select().from(billingAnalytics);
    expect(delivered?.deliveredAt).toBeInstanceOf(Date);
    expect(delivered?.event).toBeNull();

    const records = await db
      .select()
      .from(subscription)
      .where(eq(subscription.stripeSubscriptionId, "sub_test"));
    const balance = await getCreditBalance(actor.id);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      billingInterval: "month",
      plan: "pro",
      status: "active",
    });
    expect(balance.account.availableCredits).toBe(60);
    expect(balance.currentPeriod).toMatchObject({
      allowance: 50,
      plan: "pro",
    });

    const notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientId, actor.id));

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "billing",
      idempotencyKey: expect.stringMatching(
        /^billing:subscription:.+:started$/,
      ),
      subjectId: "sub_test",
      subjectType: "stripe_subscription",
      type: "billing.subscription_started",
    });
    expect(notifications[0].data).toEqual({
      interval: "monthly",
      plan: "Pro",
    });
  });

  it("notifies users when Stripe reports payment failure metadata", async () => {
    const actor = await createTestActor();
    setBetterAuthWebhookStripeClient({
      eventType: "invoice.payment_failed",
      userId: actor.id,
    });

    for (const attempt of [1, 2]) {
      const response = await postBetterAuthStripeWebhook(
        JSON.stringify({ attempt }),
      );

      expect(response.status, await response.clone().text()).toBe(200);
    }

    const notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientId, actor.id));

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "billing",
      idempotencyKey: "billing:payment_failed:in_test_failed",
      subjectId: "in_test_failed",
      subjectType: "stripe_invoice",
      type: "billing.payment_failed",
    });
    expect(notifications[0].data).toEqual({
      invoiceId: "in_test_failed",
      plan: "Mirage Pro",
    });
  });

  it("resolves payment failure notifications from stored subscription data", async () => {
    const actor = await createTestActor();
    await db.insert(subscription).values({
      id: "sub_record_payment_failed",
      billingInterval: "month",
      plan: "mirage pro",
      referenceId: actor.id,
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    });
    setBetterAuthWebhookStripeClient({
      eventType: "invoice.payment_failed",
      invoiceMetadata: {},
      invoiceSubscriptionId: "sub_test",
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();

    expect(response.status, await response.clone().text()).toBe(200);

    const notifications = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientId, actor.id));

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "billing",
      idempotencyKey: "billing:payment_failed:in_test_failed",
      type: "billing.payment_failed",
    });
    expect(notifications[0].data).toEqual({
      invoiceId: "in_test_failed",
      plan: "mirage pro",
    });
  });

  it("keeps webhook completion and retries scoped to the current lease", async () => {
    const eventId = `evt_lease_${randomUUID()}`;
    await createOrGetStripeWebhookEvent({
      eventType: "invoice.payment_failed",
      objectId: "in_lease_test",
      stripeEventId: eventId,
    });
    const firstClaim = await claimStripeWebhookEvent(eventId);
    expect(firstClaim?.processingToken).toBeTruthy();

    await db
      .update(stripeWebhookEvents)
      .set({ processingStartedAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(stripeWebhookEvents.stripeEventId, eventId));
    const secondClaim = await claimStripeWebhookEvent(eventId);
    expect(secondClaim?.processingToken).not.toBe(firstClaim?.processingToken);

    await expect(
      markStripeWebhookEventRetrying({
        errorKind: "StaleWorker",
        errorMessage: "stale",
        processingToken: firstClaim?.processingToken ?? "",
        stripeEventId: eventId,
      }),
    ).resolves.toBeNull();
    await expect(
      markStripeWebhookEventFailed({
        errorKind: "StaleWorker",
        errorMessage: "stale",
        processingToken: firstClaim?.processingToken ?? "",
        stripeEventId: eventId,
      }),
    ).resolves.toBeNull();
    await expect(
      markStripeWebhookEventCompleted({
        processingToken: secondClaim?.processingToken ?? "",
        stripeEventId: eventId,
      }),
    ).resolves.toMatchObject({ status: "completed" });
  });

  it("allows Stripe redelivery to retry a failed inline webhook", async () => {
    const eventId = `evt_retry_${randomUUID()}`;
    await createOrGetStripeWebhookEvent({
      eventType: "invoice.payment_failed",
      objectId: "in_retry_test",
      stripeEventId: eventId,
    });
    const firstClaim = await claimStripeWebhookEvent(eventId);
    expect(firstClaim?.processingToken).toBeTruthy();

    await markStripeWebhookEventFailed({
      errorKind: "TestError",
      errorMessage: "retry me",
      processingToken: firstClaim?.processingToken ?? "",
      stripeEventId: eventId,
    });

    const retryClaim = await claimStripeWebhookEvent(eventId);
    expect(retryClaim).toMatchObject({ status: "processing" });
    expect(retryClaim?.processingToken).not.toBe(firstClaim?.processingToken);
  });

  it("does not acknowledge a redelivery while inline processing is active", async () => {
    const eventId = `evt_processing_${randomUUID()}`;
    const payload = {
      eventId,
      eventType: "invoice.payment_failed" as const,
      objectId: "in_processing_test",
    };
    await createOrGetStripeWebhookEvent({
      eventType: payload.eventType,
      objectId: payload.objectId,
      stripeEventId: eventId,
    });
    await claimStripeWebhookEvent(eventId);

    await expect(processStoredStripeWebhook(payload)).rejects.toThrow(
      "already being processed",
    );
  });

  it("persists event subscription state without regressing on stale events", async () => {
    const actor = await createTestActor();
    await db.insert(subscription).values({
      id: "sub_record_transition",
      billingInterval: "month",
      plan: "pro",
      referenceId: actor.id,
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    });

    const eventObjects = new Map([
      [
        "evt_cancel_scheduled",
        {
          created: 200,
          data: {
            object: {
              ...subscriptionObject(),
              cancel_at_period_end: true,
            },
            previous_attributes: { cancel_at_period_end: false },
          },
          id: "evt_cancel_scheduled",
          object: "event",
          type: "customer.subscription.updated",
        },
      ],
      [
        "evt_cancel_stale",
        {
          created: 100,
          data: {
            object: subscriptionObject(),
            previous_attributes: { cancel_at_period_end: true },
          },
          id: "evt_cancel_stale",
          object: "event",
          type: "customer.subscription.updated",
        },
      ],
      [
        "evt_cancel_unchanged",
        {
          created: 300,
          data: {
            object: {
              ...subscriptionObject(),
              cancel_at_period_end: true,
            },
            previous_attributes: { cancel_at_period_end: true },
          },
          id: "evt_cancel_unchanged",
          object: "event",
          type: "customer.subscription.updated",
        },
      ],
    ]);
    setCreditTopUpStripeClientForTests({
      events: {
        retrieve: async (eventId: string) => eventObjects.get(eventId),
      },
    } as never);

    for (const eventId of eventObjects.keys()) {
      await createOrGetStripeWebhookEvent({
        eventType: "customer.subscription.updated",
        objectId: "sub_test",
        stripeEventId: eventId,
      });
      await processStoredStripeWebhook({
        eventId,
        eventType: "customer.subscription.updated",
        objectId: "sub_test",
      });
    }

    const [record] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, "sub_record_transition"));
    expect(record).toMatchObject({
      cancelAtPeriodEnd: true,
      stripeEventCreatedAt: 300,
    });

    const cancellationNotifications = await db
      .select()
      .from(notification)
      .where(eq(notification.type, "billing.subscription_canceled"));
    expect(cancellationNotifications).toHaveLength(1);
  });
});
