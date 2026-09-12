import { createOTP } from "@better-auth/utils/otp";
import { node } from "@elysia/node";
import { symmetricDecrypt } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import { env } from "@/lib/env";
import { siteConfig } from "@/lib/metadata";
import db from "@/server/db";
import { twoFactor, user, verification } from "@/server/db/schema";
import { accountRoutes } from "@/server/routes/account";
import { createTestActor } from "./infra/admin-actor";
import { testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
const app = new Elysia({ adapter: node(), prefix: "/api" }).use(accountRoutes);

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
