import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { POST as AUTH_WEBHOOK_POST } from "@/app/(backend)/api/auth/[...all]/route";
import db from "@/server/db";
import { notification, subscription, user } from "@/server/db/schema";
import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { setCreditTopUpStripeClientForTests } from "@/server/db/services/credits/top-up";
import { setJobEnqueueHandlerForTests } from "@/server/jobs/enqueue";
import { createJobWorkers } from "@/server/jobs/worker";
import { createTestActor } from "./infra/admin-actor";

const topUpSession = (userId: string) => ({
  amount_total: 5000,
  client_reference_id: userId,
  currency: "usd",
  id: "cs_test_top_up",
  metadata: {
    credits: "200",
    lookupKey: "one_time_credit",
    purchaseType: "credit_top_up",
    userId,
  },
  mode: "payment",
  object: "checkout.session",
  payment_status: "paid",
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
}: {
  eventType:
    | "checkout.session.completed"
    | "customer.subscription.created"
    | "invoice.payment_failed";
  invoiceMetadata?: Record<string, string>;
  invoiceSubscriptionId?: string;
  throwOnConstruct?: boolean;
  userId: string;
}) {
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
        retrieve: async () => topUpSession(userId),
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
    subscriptions: {
      retrieve: async () => subscriptionObject(),
    },
    webhooks: {
      constructEventAsync: async () => {
        if (throwOnConstruct) {
          throw new Error("invalid signature");
        }

        return {
          data: {
            object:
              eventType === "checkout.session.completed"
                ? topUpSession(userId)
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
                  : subscriptionObject(),
          },
          id: `evt_test_${eventType.replaceAll(".", "_")}`,
          object: "event",
          type: eventType,
        };
      },
    },
  } as never);
}

async function postBetterAuthStripeWebhook(body = "{}") {
  return AUTH_WEBHOOK_POST(
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
  it("is mounted through the Better Auth handler", async () => {
    const response = await AUTH_WEBHOOK_POST(
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
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
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

  it("returns before a durable top-up worker fulfills the checkout", async () => {
    setJobEnqueueHandlerForTests(null);
    const actor = await createTestActor();
    setBetterAuthWebhookStripeClient({
      eventType: "checkout.session.completed",
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();
    expect(response.status, await response.clone().text()).toBe(200);

    const beforeWorker = await getCreditBalance(actor.id);
    expect(beforeWorker.account.availableCredits).toBe(10);

    const workers = createJobWorkers();
    try {
      await expect
        .poll(async () => {
          const balance = await getCreditBalance(actor.id);
          return balance.account.availableCredits;
        })
        .toBe(210);
    } finally {
      await Promise.all(workers.map((worker) => worker.close()));
    }
  });

  it("creates subscription records and grants credits through Better Auth lifecycle hooks", async () => {
    const actor = await createTestActor();
    await db
      .update(user)
      .set({ stripeCustomerId: "cus_test" })
      .where(eq(user.id, actor.id));
    setBetterAuthWebhookStripeClient({
      eventType: "customer.subscription.created",
      userId: actor.id,
    });

    const response = await postBetterAuthStripeWebhook();

    expect(response.status, await response.clone().text()).toBe(200);

    const records = await db
      .select()
      .from(subscription)
      .where(eq(subscription.stripeSubscriptionId, "sub_test"));
    const balance = await getCreditBalance(actor.id);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      billingInterval: "month",
      plan: "mirage pro",
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
      plan: "Mirage Pro",
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
});
