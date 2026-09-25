import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { POST } from "@/app/(backend)/api/auth/[...all]/route";
import { POST as STRIPE_WEBHOOK_POST } from "@/app/(backend)/api/stripe/webhook/route";
import db from "@/server/db";
import { subscription } from "@/server/db/schema";
import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { setCreditTopUpStripeClientForTests } from "@/server/db/services/credits/top-up";
import { createTestActor } from "./infra/admin-actor";

function setCreditTopUpWebhookStripeClient({
  throwOnConstruct = false,
  userId,
}: {
  throwOnConstruct?: boolean;
  userId: string;
}) {
  setCreditTopUpStripeClientForTests({
    checkout: {
      sessions: {
        create: async () => ({ id: "cs_test", object: "checkout.session" }),
        retrieve: async () => ({
          amount_total: 5000,
          client_reference_id: userId,
          currency: "usd",
          id: "cs_test_top_up",
          metadata: {
            credits: "200",
            lookupKey: "one_time_credit",
            userId,
          },
          mode: "payment",
          object: "checkout.session",
          payment_status: "paid",
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
      },
    },
    prices: {
      list: async () => ({
        data: [],
        has_more: false,
        object: "list",
        url: "/v1/prices",
      }),
    },
    webhooks: {
      constructEventAsync: async () => {
        if (throwOnConstruct) {
          throw new Error("invalid signature");
        }

        return {
          data: {
            object: {
              amount_total: 5000,
              client_reference_id: userId,
              currency: "usd",
              id: "cs_test_top_up",
              metadata: {
                credits: "200",
                lookupKey: "one_time_credit",
                userId,
              },
              mode: "payment",
              object: "checkout.session",
              payment_status: "paid",
            },
          },
          id: "evt_test_top_up",
          object: "event",
          type: "checkout.session.completed",
        };
      },
    },
  } as never);
}

function setSubscriptionWebhookStripeClient({ userId }: { userId: string }) {
  const periodStart = Math.floor(Date.now() / 1000) - 60;
  const periodEnd = periodStart + 60 * 60 * 24 * 30;

  setCreditTopUpStripeClientForTests({
    checkout: {
      sessions: {
        create: async () => ({ id: "cs_test", object: "checkout.session" }),
        listLineItems: async () => ({
          data: [],
          has_more: false,
          object: "list",
          url: "/v1/checkout/sessions/cs_test/line_items",
        }),
        retrieve: async () => ({ id: "cs_test", object: "checkout.session" }),
      },
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
      retrieve: async () => ({ id: "sub_test", object: "subscription" }),
    },
    webhooks: {
      constructEventAsync: async () => ({
        data: {
          object: {
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
                    id: "price_pro_monthly",
                    lookup_key: "mirage_pro_2_monthly",
                    object: "price",
                    recurring: {
                      interval: "month",
                    },
                  },
                  quantity: 1,
                },
              ],
              object: "list",
            },
            metadata: {
              lookupKey: "mirage_pro_2_monthly",
              plan: "pro",
              userId,
            },
            object: "subscription",
            schedule: null,
            status: "active",
          },
        },
        id: "evt_test_subscription",
        object: "event",
        type: "customer.subscription.created",
      }),
    },
  } as never);
}

describe("Stripe webhook route", () => {
  it("is mounted through the Better Auth handler", async () => {
    const response = await POST(
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

  it("rejects missing and invalid credit top-up webhook signatures", async () => {
    const actor = await createTestActor();
    setCreditTopUpWebhookStripeClient({
      throwOnConstruct: true,
      userId: actor.id,
    });

    const missingSignature = await STRIPE_WEBHOOK_POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        body: "{}",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );
    const invalidSignature = await STRIPE_WEBHOOK_POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        body: "{}",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "bad_signature",
        },
        method: "POST",
      }),
    );

    expect(missingSignature.status).toBe(400);
    expect(invalidSignature.status).toBe(400);
  });

  it("grants one-time top-up credits idempotently from Stripe checkout", async () => {
    const actor = await createTestActor();
    setCreditTopUpWebhookStripeClient({ userId: actor.id });

    for (const attempt of [1, 2]) {
      const response = await STRIPE_WEBHOOK_POST(
        new Request("http://localhost:3000/api/stripe/webhook", {
          body: JSON.stringify({ attempt }),
          headers: {
            "content-type": "application/json",
            "stripe-signature": "valid_signature",
          },
          method: "POST",
        }),
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
  });

  it("reconciles subscription state and period credits from Stripe events", async () => {
    const actor = await createTestActor();
    setSubscriptionWebhookStripeClient({ userId: actor.id });

    const response = await STRIPE_WEBHOOK_POST(
      new Request("http://localhost:3000/api/stripe/webhook", {
        body: "{}",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "valid_signature",
        },
        method: "POST",
      }),
    );

    expect(response.status, await response.clone().text()).toBe(200);

    const [record] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.stripeSubscriptionId, "sub_test"));
    const balance = await getCreditBalance(actor.id);

    expect(record).toMatchObject({
      billingInterval: "month",
      plan: "pro",
      referenceId: actor.id,
      status: "active",
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
    });
    expect(balance.currentPeriod).toMatchObject({
      allowance: 50,
      plan: "pro",
    });
  });
});
