import { createOTP } from "@better-auth/utils/otp";
import { symmetricDecrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import db from "@/server/db";
import {
  applicationRateLimit,
  twoFactor,
  user,
  verification,
} from "@/server/db/schema";
import { accountRoutes } from "@/server/routes/account";
import { createTestActor } from "./infra/admin-actor";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
const app = new Elysia({ prefix: "/api" }).use(accountRoutes);

async function post(path: string, body: object, cookie: string) {
  const response = await app.fetch(
    new Request(`${origin}/api/account/two-factor${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    retryAfter: response.headers.get("retry-after"),
    body: (await response.json()) as Record<string, unknown>,
  };
}

function latestEmailCode(email: string) {
  const message = testEmailOutbox.findLast(
    (entry) => entry.to === email && entry.text.includes("Your code is:"),
  );
  const code = message?.text.match(/Your code is: (\d{6})/)?.[1];
  if (!code) throw new Error(`No two-factor email code for ${email}`);
  return code;
}

function wrongCode(code: string) {
  return code === "000000" ? "000001" : "000000";
}

async function codeRecord(userId: string, action: "enable" | "disable") {
  const [record] = await db
    .select()
    .from(verification)
    .where(
      eq(
        verification.identifier,
        `account-two-factor-email-code:${userId}:${action}`,
      ),
    );
  return record;
}

describe("two-factor authentication", () => {
  it("reports replacement-code delivery uncertainty and a retry path", async () => {
    const actor = await createTestActor();
    expect(
      (await post("/send-code", { action: "enable" }, actor.cookie)).status,
    ).toBe(200);
    const oldCode = latestEmailCode(actor.email);
    const firstRecord = await codeRecord(actor.id, "enable");
    await db
      .update(applicationRateLimit)
      .set({ resetAt: new Date(Date.now() - 1000) });
    setTestEmailDeliveryHook(async () => {
      throw new Error("Test delivery failure");
    });

    const failed = await app.fetch(
      new Request(`${origin}/api/account/two-factor/send-code`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin,
          cookie: actor.cookie,
        },
        body: JSON.stringify({ action: "enable" }),
      }),
    );
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({
      message: expect.stringContaining("previous code is no longer valid"),
      recovery: "try-delivered-code",
    });
    const replacement = await codeRecord(actor.id, "enable");
    expect(replacement).toBeDefined();
    expect(replacement?.id).not.toBe(firstRecord?.id);
    expect(
      testEmailOutbox.filter(
        (entry) =>
          entry.to === actor.email && entry.text.includes("Your code is:"),
      ),
    ).toHaveLength(1);
    expect(
      (await post("/start-setup", { code: oldCode }, actor.cookie)).status,
    ).toBe(400);
    const retry = await post("/send-code", { action: "enable" }, actor.cookie);
    expect(retry.status).toBe(429);
    expect(Number(retry.retryAfter)).toBeGreaterThan(0);

    setTestEmailDeliveryHook(null);
    await db
      .update(applicationRateLimit)
      .set({ resetAt: new Date(Date.now() - 1000) });
    expect(
      (await post("/send-code", { action: "enable" }, actor.cookie)).status,
    ).toBe(200);
    expect(
      (
        await post(
          "/start-setup",
          { code: latestEmailCode(actor.email) },
          actor.cookie,
        )
      ).status,
    ).toBe(200);
  });

  it("accepts a code that may have been delivered before a timeout", async () => {
    const actor = await createTestActor();
    setTestEmailDeliveryHook(async (options) => {
      testEmailOutbox.push(options);
      throw new Error("Provider timed out after acceptance");
    });

    const requested = await post(
      "/send-code",
      { action: "enable" },
      actor.cookie,
    );
    expect(requested.status).toBe(503);
    expect(requested.body).toMatchObject({
      recovery: "try-delivered-code",
    });
    setTestEmailDeliveryHook(null);
    const setup = await post(
      "/start-setup",
      { code: latestEmailCode(actor.email) },
      actor.cookie,
    );
    expect(setup.status).toBe(200);
  });

  it("throttles repeated email-code sends", async () => {
    const actor = await createTestActor();
    expect(
      (await post("/send-code", { action: "enable" }, actor.cookie)).status,
    ).toBe(200);

    const limited = await post(
      "/send-code",
      { action: "enable" },
      actor.cookie,
    );
    expect(limited.status).toBe(429);
    expect(Number(limited.retryAfter)).toBeGreaterThan(0);
    expect(
      testEmailOutbox.filter(
        (entry) =>
          entry.to === actor.email && entry.text.includes("Your code is:"),
      ),
    ).toHaveLength(1);
  });

  it("counts wrong email codes and locks out the fifth failure", async () => {
    const actor = await createTestActor();
    expect(
      (await post("/send-code", { action: "enable" }, actor.cookie)).status,
    ).toBe(200);
    const code = latestEmailCode(actor.email);

    for (let attempt = 1; attempt <= 5; attempt++) {
      expect(
        (await post("/start-setup", { code: wrongCode(code) }, actor.cookie))
          .status,
      ).toBe(400);
      const record = await codeRecord(actor.id, "enable");
      if (attempt < 5) {
        expect(JSON.parse(record?.value ?? "{}").failedAttempts).toBe(attempt);
      } else {
        expect(record).toBeUndefined();
      }
    }

    expect((await post("/start-setup", { code }, actor.cookie)).status).toBe(
      400,
    );
  });

  it("rejects expired and already-used email codes", async () => {
    const actor = await createTestActor();
    await post("/send-code", { action: "enable" }, actor.cookie);
    const expiredCode = latestEmailCode(actor.email);
    const record = await codeRecord(actor.id, "enable");
    if (!record) throw new Error("Expected email code row");
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(verification.id, record.id));
    expect(
      (await post("/start-setup", { code: expiredCode }, actor.cookie)).status,
    ).toBe(400);
    expect(await codeRecord(actor.id, "enable")).toBeUndefined();

    await db
      .update(applicationRateLimit)
      .set({ resetAt: new Date(Date.now() - 1000) });
    await post("/send-code", { action: "enable" }, actor.cookie);
    const code = latestEmailCode(actor.email);
    expect((await post("/start-setup", { code }, actor.cookie)).status).toBe(
      200,
    );
    expect((await post("/start-setup", { code }, actor.cookie)).status).toBe(
      400,
    );
    expect(await codeRecord(actor.id, "enable")).toBeUndefined();
  });

  it("serializes simultaneous wrong requests at the attempt limit", async () => {
    const actor = await createTestActor();
    await post("/send-code", { action: "enable" }, actor.cookie);
    const code = latestEmailCode(actor.email);
    for (let attempt = 0; attempt < 3; attempt++) {
      await post("/start-setup", { code: wrongCode(code) }, actor.cookie);
    }

    const results = await Promise.all([
      post("/start-setup", { code: wrongCode(code) }, actor.cookie),
      post("/start-setup", { code: wrongCode(code) }, actor.cookie),
    ]);
    expect(results.map(({ status }) => status)).toEqual([400, 400]);
    expect(await codeRecord(actor.id, "enable")).toBeUndefined();
    expect((await post("/start-setup", { code }, actor.cookie)).status).toBe(
      400,
    );
  });

  it("keeps the two-factor row and user flag aligned through setup and disable", async () => {
    const actor = await createTestActor();
    await post("/send-code", { action: "enable" }, actor.cookie);
    const setup = await post(
      "/start-setup",
      { code: latestEmailCode(actor.email) },
      actor.cookie,
    );
    expect(setup.status).toBe(200);
    const secret = new URL(String(setup.body.totpURI)).searchParams.get(
      "secret",
    );
    if (!secret) throw new Error("Setup URI has no secret");

    const [pending] = await db
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, actor.id));
    const [beforeEnable] = await db
      .select()
      .from(user)
      .where(eq(user.id, actor.id));
    expect(pending?.verified).toBe(false);
    expect(beforeEnable?.twoFactorEnabled).toBe(false);
    if (!pending) throw new Error("No pending two-factor setup");
    const rawSecret = await symmetricDecrypt({
      data: pending.secret,
      key: env.BETTER_AUTH_SECRET,
    });
    expect(
      new URL(
        createOTP(rawSecret, { digits: 6, period: 30 }).url(
          siteConfig.name,
          actor.email,
        ),
      ).searchParams.get("secret"),
    ).toBe(secret);

    const totpCode = await createOTP(rawSecret, {
      digits: 6,
      period: 30,
    }).totp();
    const verified = await post(
      "/verify-setup",
      { code: totpCode },
      actor.cookie,
    );
    expect(verified.status, JSON.stringify(verified.body)).toBe(200);
    const [enabledRow] = await db
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, actor.id));
    const [enabledUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, actor.id));
    expect(enabledRow?.verified).toBe(true);
    expect(enabledUser?.twoFactorEnabled).toBe(true);

    expect(
      (await post("/send-code", { action: "disable" }, actor.cookie)).status,
    ).toBe(200);
    const disableCode = latestEmailCode(actor.email);
    expect(
      (await post("/disable", { code: disableCode }, actor.cookie)).status,
    ).toBe(200);
    const disabledRows = await db
      .select()
      .from(twoFactor)
      .where(eq(twoFactor.userId, actor.id));
    const [disabledUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, actor.id));
    expect(disabledRows).toHaveLength(0);
    expect(disabledUser?.twoFactorEnabled).toBe(false);
  });
});
