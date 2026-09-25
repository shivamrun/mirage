import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccountBillingPage } from "@/features/account/components";
import { CreditLabPage } from "@/features/credits/components";
import db from "@/server/db";
import {
  creditAccounts,
  creditLedgerEntries,
  creditPeriodGrants,
  subscription,
  user,
} from "@/server/db/schema";
import { getAdminUserDetailView } from "@/server/db/services/admin/user-detail";
import {
  adjustCredits,
  CreditIdempotencyConflictError,
  getCreditBalance,
  grantCreditTopUp,
  InsufficientCreditsError,
  reconcileCreditGrantForSubscription,
  refundCreditSpend,
  spendCredits,
} from "@/server/db/services/credits/ledger";
import { setCreditTopUpStripeClientForTests } from "@/server/db/services/credits/top-up";
import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";
import { httpRequest } from "./infra/http-request";

function currentSubscriptionPeriod() {
  const now = new Date();
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );

  return { periodEnd, periodStart };
}

async function createUser(
  createdAt = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
) {
  const id = randomUUID();
  await db.insert(user).values({
    createdAt,
    email: `${id}@example.com`,
    id,
    name: "Credit Tester",
  });
  return id;
}

async function createSubscription({
  periodEnd = currentSubscriptionPeriod().periodEnd,
  periodStart = currentSubscriptionPeriod().periodStart,
  plan = "mirage pro",
  userId,
}: {
  periodEnd?: Date;
  periodStart?: Date;
  plan?: string;
  userId: string;
}) {
  const id = randomUUID();
  await db.insert(subscription).values({
    billingInterval: "month",
    id,
    periodEnd,
    periodStart,
    plan,
    referenceId: userId,
    status: "active",
    stripeSubscriptionId: `sub_${id}`,
  });

  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.id, id));
  if (!record) throw new Error("Subscription was not created.");
  return record;
}

function setStripeTopUpClient({
  checkoutUrl = "https://checkout.stripe.test/session",
  topUpUnitAmount = 5000,
} = {}) {
  setCreditTopUpStripeClientForTests({
    checkout: {
      sessions: {
        create: async () => ({
          id: "cs_test_top_up",
          object: "checkout.session",
          url: checkoutUrl,
        }),
        retrieve: async () => ({
          amount_total: 5000,
          client_reference_id: "unused",
          currency: "usd",
          id: "cs_test_top_up",
          metadata: {
            credits: "200",
            lookupKey: "one_time_credit",
            userId: "unused",
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
          url: "/v1/checkout/sessions/cs_test/line_items",
        }),
      },
    },
    prices: {
      list: async (params: { lookup_keys?: string[] }) => {
        const lookupKey = params.lookup_keys?.[0];
        const price =
          lookupKey === "mirage_hacker_yearly"
            ? {
                active: true,
                currency: "usd",
                id: "price_hacker_yearly",
                lookup_key: "mirage_hacker_yearly",
                object: "price",
                recurring: { interval: "year" },
              }
            : {
                active: true,
                currency: "usd",
                id: "price_top_up",
                lookup_key: "one_time_credit",
                object: "price",
                recurring: null,
                unit_amount: topUpUnitAmount,
              };

        return {
          data: [price],
          has_more: false,
          object: "list",
          url: "/v1/prices",
        };
      },
    },
    webhooks: {
      constructEventAsync: async () => ({
        data: {
          object: {
            amount_total: 5000,
            client_reference_id: "unused",
            currency: "usd",
            id: "cs_test_top_up",
            metadata: {
              credits: "200",
              lookupKey: "one_time_credit",
              userId: "unused",
            },
            mode: "payment",
            object: "checkout.session",
            payment_status: "paid",
          },
        },
        id: "evt_test",
        object: "event",
        type: "checkout.session.completed",
      }),
    },
  } as never);
}

describe("credit ledger", () => {
  it("creates free-period grants idempotently", async () => {
    const userId = await createUser();

    const first = await getCreditBalance(userId);
    const second = await getCreditBalance(userId);
    const ledger = await db.select().from(creditLedgerEntries);
    const grants = await db.select().from(creditPeriodGrants);

    expect(first.account.availableCredits).toBe(10);
    expect(second.account.availableCredits).toBe(10);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: 10,
      source: "period_grant",
      type: "grant",
      userId,
    });
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({
      allowance: 10,
      plan: "free",
      userId,
    });
  });

  it("creates paid-period grants from subscription periods", async () => {
    const userId = await createUser();
    await createSubscription({ userId });

    const balance = await getCreditBalance(userId);

    expect(balance.account.availableCredits).toBe(50);
    expect(balance.currentPeriod).toMatchObject({
      allowance: 50,
      plan: "pro",
    });
  });

  it("tops up upgrades and does not claw back downgrades", async () => {
    const userId = await createUser();
    const record = await createSubscription({ plan: "mirage pro", userId });

    await reconcileCreditGrantForSubscription(record);
    await db
      .update(subscription)
      .set({ plan: "mirage hacker" })
      .where(eq(subscription.id, record.id));
    const [upgraded] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, record.id));
    await reconcileCreditGrantForSubscription(upgraded);

    let [account] = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId));
    expect(account.availableCredits).toBe(100);

    await db
      .update(subscription)
      .set({ plan: "mirage pro" })
      .where(eq(subscription.id, record.id));
    const [downgraded] = await db
      .select()
      .from(subscription)
      .where(eq(subscription.id, record.id));
    await reconcileCreditGrantForSubscription(downgraded);

    [account] = await db
      .select()
      .from(creditAccounts)
      .where(eq(creditAccounts.userId, userId));
    const ledger = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, userId));
    const [grant] = await db
      .select()
      .from(creditPeriodGrants)
      .where(eq(creditPeriodGrants.userId, userId));

    expect(account.availableCredits).toBe(100);
    expect(grant.allowance).toBe(50);
    expect(ledger.map((entry) => entry.amount).sort((a, b) => a - b)).toEqual([
      50, 50,
    ]);
  });

  it("spends atomically and rejects insufficient credit", async () => {
    const userId = await createUser();

    const spend = await spendCredits({
      amount: 7,
      idempotencyKey: "spend:test:success",
      source: "test",
      sourceId: "job_1",
      userId,
    });

    await expect(
      spendCredits({
        amount: 99,
        idempotencyKey: "spend:test:too-much",
        source: "test",
        userId,
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditsError);

    const retriedSpend = await spendCredits({
      amount: 7,
      idempotencyKey: "spend:test:success",
      source: "test",
      sourceId: "job_1",
      userId,
    });
    const balance = await getCreditBalance(userId);

    expect(retriedSpend.id).toBe(spend.id);
    expect(balance.account.availableCredits).toBe(3);
    expect(balance.account.lifetimeSpent).toBe(7);
  });

  it("does not overdraw under concurrent spend attempts", async () => {
    const userId = await createUser();
    await getCreditBalance(userId);

    const results = await Promise.allSettled(
      Array.from({ length: 2 }, (_, index) =>
        spendCredits({
          amount: 7,
          idempotencyKey: `spend:concurrent:${index}`,
          source: "test",
          userId,
        }),
      ),
    );
    const balance = await getCreditBalance(userId);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(balance.account.availableCredits).toBe(3);
  });

  it("records refunds and manual adjustments append-only", async () => {
    const userId = await createUser();
    const spend = await spendCredits({
      amount: 5,
      idempotencyKey: "spend:refund",
      source: "test",
      userId,
    });

    await refundCreditSpend({
      idempotencyKey: "refund:spend",
      spendLedgerEntryId: spend.id,
      userId,
    });
    await adjustCredits({
      amount: 4,
      idempotencyKey: "manual:credit",
      sourceId: "admin_note",
      userId,
    });
    await adjustCredits({
      amount: -3,
      idempotencyKey: "manual:debit",
      sourceId: "admin_note",
      userId,
    });

    const balance = await getCreditBalance(userId);
    const ledger = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, userId));

    expect(balance.account.availableCredits).toBe(11);
    expect(ledger.map((entry) => entry.type).sort()).toEqual([
      "grant",
      "manual_credit",
      "manual_debit",
      "refund",
      "spend",
    ]);
  });

  it("top-up credits carry forward and are idempotent", async () => {
    const userId = await createUser();

    const first = await grantCreditTopUp({
      amount: 200,
      idempotencyKey: "stripe_checkout:cs_top_up",
      sourceId: "cs_top_up",
      userId,
    });
    const second = await grantCreditTopUp({
      amount: 200,
      idempotencyKey: "stripe_checkout:cs_top_up",
      sourceId: "cs_top_up",
      userId,
    });
    const balance = await getCreditBalance(userId);

    expect(second.id).toBe(first.id);
    expect(balance.account.availableCredits).toBe(210);
    expect(balance.account.carryForwardCredits).toBe(200);
    expect(balance.account.lifetimeGranted).toBe(210);
  });

  it("spends period credits before purchased carry-forward credits", async () => {
    const userId = await createUser();
    await grantCreditTopUp({
      amount: 200,
      idempotencyKey: "stripe_checkout:cs_spend_order",
      sourceId: "cs_spend_order",
      userId,
    });

    await spendCredits({
      amount: 15,
      idempotencyKey: "spend:period-first",
      source: "test",
      userId,
    });
    const balance = await getCreditBalance(userId);
    const spend = balance.recentLedger.find(
      (entry) => entry.idempotencyKey === "spend:period-first",
    );

    expect(balance.account.availableCredits).toBe(195);
    expect(balance.account.carryForwardCredits).toBe(195);
    expect(spend?.metadata).toMatchObject({
      carryForwardCreditsSpent: 5,
      periodCreditsSpent: 10,
    });
  });

  it("restores carry-forward credits on spend refunds", async () => {
    const userId = await createUser();
    await grantCreditTopUp({
      amount: 200,
      idempotencyKey: "stripe_checkout:cs_refund_bucket",
      sourceId: "cs_refund_bucket",
      userId,
    });
    const spend = await spendCredits({
      amount: 15,
      idempotencyKey: "spend:refund-bucket",
      source: "test",
      userId,
    });

    await refundCreditSpend({
      amount: 5,
      idempotencyKey: "refund:carry-forward-bucket",
      spendLedgerEntryId: spend.id,
      userId,
    });
    const balance = await getCreditBalance(userId);

    expect(balance.account.availableCredits).toBe(200);
    expect(balance.account.carryForwardCredits).toBe(200);
  });

  it("expires only period credits when purchased credits exist", async () => {
    const userId = await createUser();
    const expiredPeriodStart = new Date("2025-01-01T00:00:00.000Z");
    const expiredPeriodEnd = new Date("2025-02-01T00:00:00.000Z");
    const record = await createSubscription({
      periodEnd: expiredPeriodEnd,
      periodStart: expiredPeriodStart,
      userId,
    });

    await reconcileCreditGrantForSubscription(record);
    await grantCreditTopUp({
      amount: 200,
      idempotencyKey: "stripe_checkout:cs_period_rollover",
      sourceId: "cs_period_rollover",
      userId,
    });
    const balance = await getCreditBalance(userId);
    const expiredEntries = balance.recentLedger.filter(
      (entry) => entry.type === "expire",
    );

    expect(balance.account.availableCredits).toBe(210);
    expect(balance.account.carryForwardCredits).toBe(200);
    expect(expiredEntries).toEqual([
      expect.objectContaining({
        amount: -50,
      }),
    ]);
  });

  it("reconciles period credits before manual debit adjustments", async () => {
    const userId = await createUser();

    await adjustCredits({
      amount: -3,
      idempotencyKey: "manual:debit:fresh-user",
      sourceId: "admin_note",
      userId,
    });

    const balance = await getCreditBalance(userId);
    const ledger = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, userId));

    expect(balance.account.availableCredits).toBe(7);
    expect(ledger.map((entry) => entry.type).sort()).toEqual([
      "grant",
      "manual_debit",
    ]);
  });

  it("rejects idempotency keys reused for different credit operations", async () => {
    const firstUserId = await createUser();
    const secondUserId = await createUser();

    await adjustCredits({
      amount: 4,
      idempotencyKey: "manual:shared-conflict",
      userId: firstUserId,
    });

    await expect(
      adjustCredits({
        amount: 4,
        idempotencyKey: "manual:shared-conflict",
        userId: secondUserId,
      }),
    ).rejects.toBeInstanceOf(CreditIdempotencyConflictError);

    const secondUserLedger = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, secondUserId));

    expect(secondUserLedger).toHaveLength(0);
  });

  it("guards the balance API and returns only the current user's balance", async () => {
    const first = await createTestActor();
    const second = await createTestActor();
    await adjustCredits({
      amount: 8,
      idempotencyKey: "manual:first-only",
      userId: first.id,
    });

    const unauthenticated = await httpRequest(app, "/api/credits/balance");
    const response = await httpRequest(app, "/api/credits/balance", {
      cookie: second.cookie,
    });

    expect(unauthenticated.status).toBe(401);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      availableCredits: 10,
      currentPeriod: {
        allowance: 10,
        plan: "free",
      },
    });
  });

  it("guards credit top-up checkout and returns a Stripe checkout URL", async () => {
    const actor = await createTestActor();
    setStripeTopUpClient();

    const unauthenticated = await httpRequest(app, "/api/billing/checkout", {
      body: JSON.stringify({ type: "credit_top_up" }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });
    const wrongOrigin = await httpRequest(app, "/api/billing/checkout", {
      body: JSON.stringify({ type: "credit_top_up" }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example",
      },
      method: "POST",
    });
    const checkout = await httpRequest(app, "/api/billing/checkout", {
      body: JSON.stringify({ type: "credit_top_up" }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(unauthenticated.status).toBe(401);
    expect(wrongOrigin.status).toBe(403);
    expect(checkout.status, await checkout.clone().text()).toBe(200);
    await expect(checkout.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("rejects credit top-up checkout when the Stripe price amount is misconfigured", async () => {
    const actor = await createTestActor();
    setStripeTopUpClient({ topUpUnitAmount: 4999 });

    const checkout = await httpRequest(app, "/api/billing/checkout", {
      body: JSON.stringify({ type: "credit_top_up" }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(checkout.status).toBe(502);
    await expect(checkout.json()).resolves.toEqual({
      message: "Billing checkout could not be started.",
    });
  });

  it("starts subscription checkout through the billing API", async () => {
    const actor = await createTestActor();
    setStripeTopUpClient();

    const checkout = await httpRequest(app, "/api/billing/checkout", {
      body: JSON.stringify({
        interval: "yearly",
        plan: "hacker",
        type: "subscription",
      }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(checkout.status, await checkout.clone().text()).toBe(200);
    await expect(checkout.json()).resolves.toEqual({
      url: "https://checkout.stripe.test/session",
    });
  });

  it("creates sample items through the credit API", async () => {
    const actor = await createTestActor();
    await adjustCredits({
      amount: 120,
      idempotencyKey: "manual:sample-create-budget",
      userId: actor.id,
    });

    for (const [itemKey, credits] of [
      ["tiny-note", 10],
      ["project-idea", 30],
      ["launch-checklist", 50],
    ] as const) {
      const response = await httpRequest(app, "/api/credits/sample-create", {
        body: JSON.stringify({
          idempotencyKey: `sample-create:${itemKey}`,
          itemKey,
        }),
        cookie: actor.cookie,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      });

      expect(response.status, await response.clone().text()).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        created: {
          creditsSpent: credits,
          itemKey,
        },
      });
    }

    const balance = await getCreditBalance(actor.id);
    const ledger = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, actor.id));

    expect(balance.account.availableCredits).toBe(40);
    expect(balance.account.lifetimeSpent).toBe(90);
    expect(ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amount: -10,
          source: "sample_credit_lab",
          sourceId: "tiny-note",
          type: "spend",
        }),
        expect.objectContaining({
          amount: -30,
          source: "sample_credit_lab",
          sourceId: "project-idea",
          type: "spend",
        }),
        expect.objectContaining({
          amount: -50,
          source: "sample_credit_lab",
          sourceId: "launch-checklist",
          type: "spend",
        }),
      ]),
    );
  });

  it("guards sample credit creation inputs and balances", async () => {
    const actor = await createTestActor();

    const unauthenticated = await httpRequest(
      app,
      "/api/credits/sample-create",
      {
        body: JSON.stringify({
          idempotencyKey: "sample-create:unauthenticated",
          itemKey: "tiny-note",
        }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      },
    );
    const invalidItem = await httpRequest(app, "/api/credits/sample-create", {
      body: JSON.stringify({
        idempotencyKey: "sample-create:invalid",
        itemKey: "missing-item",
      }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });
    const tooExpensive = await httpRequest(app, "/api/credits/sample-create", {
      body: JSON.stringify({
        idempotencyKey: "sample-create:too-expensive",
        itemKey: "project-idea",
      }),
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(unauthenticated.status).toBe(401);
    expect(invalidItem.status).toBe(400);
    expect(tooExpensive.status, await tooExpensive.clone().text()).toBe(402);
    await expect(tooExpensive.json()).resolves.toEqual({
      message: "Insufficient credits. Available: 10. Required: 30.",
    });
  });

  it("keeps sample credit creation idempotent", async () => {
    const actor = await createTestActor();
    const body = JSON.stringify({
      idempotencyKey: "sample-create:idempotent",
      itemKey: "tiny-note",
    });

    const first = await httpRequest(app, "/api/credits/sample-create", {
      body,
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });
    const second = await httpRequest(app, "/api/credits/sample-create", {
      body,
      cookie: actor.cookie,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      method: "POST",
    });

    expect(first.status, await first.clone().text()).toBe(200);
    expect(second.status, await second.clone().text()).toBe(200);
    await expect(second.json()).resolves.toMatchObject({
      balance: {
        availableCredits: 0,
        lifetimeSpent: 10,
      },
      created: {
        creditsSpent: 10,
        itemKey: "tiny-note",
      },
    });
  });

  it("renders the billing credit counter for the authenticated user", async () => {
    const actor = await createTestActor();
    await adjustCredits({
      amount: 6,
      idempotencyKey: "manual:billing-counter",
      userId: actor.id,
    });
    const balance = await getCreditBalance(actor.id);
    const userProp = {
      banExpires: null,
      banReason: null,
      banned: false,
      createdAt: new Date(),
      email: actor.email,
      emailVerified: false,
      id: actor.id,
      image: null,
      name: "Credit Tester",
      role: "user",
      roles: ["user"],
      session: {
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        id: "session_test",
        ipAddress: null,
        impersonatedBy: null,
        token: "token_test",
        updatedAt: new Date(),
        userAgent: null,
        userId: actor.id,
      },
      stripeCustomerId: null,
      twoFactorEnabled: false,
      updatedAt: new Date(),
    } satisfies Parameters<typeof AccountBillingPage>[0]["user"];

    const html = renderToStaticMarkup(
      createElement(AccountBillingPage, {
        creditBalance: balance,
        subscriptions: [],
        user: userProp,
      }),
    );

    expect(html).toContain("Credits");
    expect(html).toContain("16 / 10");
    expect(html).toContain("Buy 200 credits");
    expect(html).toContain("Purchased carry-forward");
    expect(html).toContain("Purchased credits carry forward until spent");
  });

  it("renders the credit lab items and prices", async () => {
    const actor = await createTestActor();
    const balance = await getCreditBalance(actor.id);

    const html = renderToStaticMarkup(
      createElement(CreditLabPage, {
        balance,
      }),
    );

    expect(html).toContain("Credit Lab");
    expect(html).toContain("Tiny note");
    expect(html).toContain("Project idea");
    expect(html).toContain("Launch checklist");
    expect(html).toContain(">10</");
    expect(html).toContain(">30</");
    expect(html).toContain(">50</");
  });

  it("loads admin user detail credits for only the selected user", async () => {
    const selectedUserId = await createUser();
    const otherUserId = await createUser();
    await adjustCredits({
      amount: 7,
      idempotencyKey: "manual:selected-only",
      userId: selectedUserId,
    });
    await adjustCredits({
      amount: 30,
      idempotencyKey: "manual:other-user",
      userId: otherUserId,
    });

    const detail = await getAdminUserDetailView(selectedUserId);

    expect(detail?.user.id).toBe(selectedUserId);
    expect(detail?.creditBalance.account.availableCredits).toBe(17);
    expect(
      detail?.creditBalance.recentLedger.every(
        (entry) => entry.userId === selectedUserId,
      ),
    ).toBe(true);
    expect(
      detail?.creditBalance.recentLedger.some(
        (entry) => entry.sourceId === "other-user",
      ),
    ).toBe(false);
  });

  it("guards admin credit adjustments", async () => {
    const userActor = await createTestActor();
    const target = await createTestActor();

    const unauthenticated = await httpRequest(
      app,
      `/api/admin/users/${target.id}/credits/adjust`,
      {
        body: JSON.stringify({ amount: 1, reason: "test" }),
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      },
    );
    const nonAdmin = await httpRequest(
      app,
      `/api/admin/users/${target.id}/credits/adjust`,
      {
        body: JSON.stringify({ amount: 1, reason: "test" }),
        cookie: userActor.cookie,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      },
    );

    expect(unauthenticated.status).toBe(404);
    expect(nonAdmin.status).toBe(404);
  });

  it("accepts positive and negative admin adjustments append-only", async () => {
    const admin = await createTestActor({
      emailVerified: true,
      role: "admin",
    });
    const target = await createTestActor();

    const credit = await httpRequest(
      app,
      `/api/admin/users/${target.id}/credits/adjust`,
      {
        body: JSON.stringify({
          amount: 5,
          idempotencyKey: "admin:credit:test",
          reason: "test credit",
          sourceId: "ticket-1",
        }),
        cookie: admin.cookie,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      },
    );
    expect(credit.status, await credit.clone().text()).toBe(200);
    await expect(credit.json()).resolves.toMatchObject({
      availableCredits: 15,
      recentLedger: expect.arrayContaining([
        expect.objectContaining({
          amount: 5,
          source: "admin_manual_adjustment",
          sourceId: "ticket-1",
          type: "manual_credit",
        }),
      ]),
    });

    const rowsAfterCredit = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, target.id));
    const creditedRow = rowsAfterCredit.find(
      (entry) => entry.idempotencyKey === "admin:credit:test",
    );

    const debit = await httpRequest(
      app,
      `/api/admin/users/${target.id}/credits/adjust`,
      {
        body: JSON.stringify({
          amount: -3,
          idempotencyKey: "admin:debit:test",
          reason: "test debit",
          sourceId: "ticket-2",
        }),
        cookie: admin.cookie,
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        method: "POST",
      },
    );

    expect(debit.status, await debit.clone().text()).toBe(200);
    await expect(debit.json()).resolves.toMatchObject({
      availableCredits: 12,
      recentLedger: expect.arrayContaining([
        expect.objectContaining({
          amount: -3,
          source: "admin_manual_adjustment",
          sourceId: "ticket-2",
          type: "manual_debit",
        }),
      ]),
    });

    const rowsAfterDebit = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, target.id));

    expect(rowsAfterDebit).toHaveLength(rowsAfterCredit.length + 1);
    expect(
      rowsAfterDebit.find((entry) => entry.id === creditedRow?.id),
    ).toMatchObject({
      amount: 5,
      idempotencyKey: "admin:credit:test",
      type: "manual_credit",
    });
  });
});
