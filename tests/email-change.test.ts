import { randomUUID } from "node:crypto";

import { node } from "@elysia/node";
import { eq, like } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import { applicationRateLimit, user, verification } from "@/server/db/schema";
import { accountRoutes } from "@/server/routes/account";
import { createTestActor } from "./infra/admin-actor";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
const app = new Elysia({ adapter: node(), prefix: "/api" }).use(accountRoutes);

async function post(path: string, body: object, cookie?: string) {
  const response = await postResponse(path, body, cookie);
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    redirectURL?: string;
    pendingEmailStep?: string;
  }>;
}

function postResponse(path: string, body: object, cookie?: string) {
  return app.fetch(
    new Request(`${origin}/api/account${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

function tokenFromEmail(recipient: string, path: string) {
  const email = testEmailOutbox.findLast(
    (entry) => entry.to === recipient && entry.text.includes(path),
  );
  if (!email) throw new Error(`No ${path} email for ${recipient}`);
  const link = email.text.match(/https?:\/\/\S+/)?.[0];
  const token = link && new URL(link).searchParams.get("token");
  if (!token) throw new Error(`No token in ${path} email`);
  return token;
}

async function storedUser(id: string) {
  const [record] = await db.select().from(user).where(eq(user.id, id));
  return record;
}

function redirectStatus(redirectURL?: string) {
  return redirectURL && new URL(redirectURL).searchParams.get("emailChange");
}

describe("email-change tokens", () => {
  it.each([
    { emailVerified: false, step: "verify-new", recipient: "new" },
    { emailVerified: true, step: "approve-current", recipient: "current" },
  ] as const)(
    "reports a recoverable $step challenge and cooldown after a failed send",
    async ({ emailVerified, step, recipient }) => {
      const actor = await createTestActor({ emailVerified });
      const newEmail = `failed-${randomUUID()}@example.com`;
      setTestEmailDeliveryHook(async () => {
        throw new Error("Test delivery failure");
      });

      const failed = await postResponse(
        "/change-email",
        { newEmail },
        actor.cookie,
      );
      expect(failed.status).toBe(503);
      const failure = (await failed.json()) as { message: string };
      expect(failure.message).toContain("could not confirm email delivery");
      expect(failure.message).not.toContain("Test delivery failure");
      expect((await storedUser(actor.id))?.email).toBe(actor.email);
      const records = await db
        .select()
        .from(verification)
        .where(
          like(verification.identifier, `account-email-change%:${actor.id}:%`),
        );
      expect(records).toHaveLength(1);
      expect(
        records[0]?.identifier.startsWith(
          step === "verify-new"
            ? "account-email-change:"
            : "account-email-change-approval:",
        ),
      ).toBe(true);
      expect(
        testEmailOutbox.some(
          (entry) =>
            entry.to === (recipient === "new" ? newEmail : actor.email) &&
            entry.text.includes("email change"),
        ),
      ).toBe(false);

      const state = await app.fetch(
        new Request(`${origin}/api/account/`, {
          headers: { cookie: actor.cookie },
        }),
      );
      expect(state.status).toBe(200);
      expect(await state.json()).toMatchObject({
        pendingEmail: newEmail,
        pendingEmailStep: step,
      });
      const retry = await postResponse(
        "/change-email",
        { newEmail },
        actor.cookie,
      );
      expect(retry.status).toBe(429);
      expect(Number(retry.headers.get("retry-after"))).toBeGreaterThan(0);

      setTestEmailDeliveryHook(null);
      await db
        .update(applicationRateLimit)
        .set({ resetAt: new Date(Date.now() - 1000) });
      const recovered = await postResponse(
        step === "verify-new"
          ? "/resend-email-change-verification"
          : "/change-email",
        step === "verify-new" ? {} : { newEmail },
        actor.cookie,
      );
      expect(recovered.status).toBe(200);
      expect(
        testEmailOutbox.some(
          (entry) =>
            entry.to === (recipient === "new" ? newEmail : actor.email) &&
            entry.text.includes("email change"),
        ),
      ).toBe(true);
    },
  );

  it("consumes approval and leaves an undelivered confirmation after send failure", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const newEmail = `failed-confirmation-${randomUUID()}@example.com`;
    await post("/change-email", { newEmail }, actor.cookie);
    const approvalToken = tokenFromEmail(actor.email, "/approve-email-change");
    setTestEmailDeliveryHook(async () => {
      throw new Error("Test delivery failure");
    });

    const failed = await postResponse("/approve-email-change", {
      token: approvalToken,
    });
    expect(failed.status).toBe(503);
    expect(await failed.json()).toMatchObject({
      recovery: "resend-from-account",
      message: expect.stringContaining("approval was saved"),
    });
    expect((await storedUser(actor.id))?.email).toBe(actor.email);
    const records = await db
      .select()
      .from(verification)
      .where(
        like(verification.identifier, `account-email-change%:${actor.id}:%`),
      );
    expect(records).toHaveLength(1);
    expect(records[0]?.identifier).toMatch(/^account-email-change:/);
    expect(
      testEmailOutbox.some(
        (entry) =>
          entry.to === newEmail && entry.text.includes("/confirm-email-change"),
      ),
    ).toBe(false);

    setTestEmailDeliveryHook(null);
    const replay = await post("/approve-email-change", {
      token: approvalToken,
    });
    expect(redirectStatus(replay.redirectURL)).toBe("invalid");
    const resend = await postResponse(
      "/resend-email-change-verification",
      {},
      actor.cookie,
    );
    expect(resend.status).toBe(429);
    expect(Number(resend.headers.get("retry-after"))).toBeGreaterThan(0);

    await db
      .update(applicationRateLimit)
      .set({ resetAt: new Date(Date.now() - 1000) });
    const recovered = await postResponse(
      "/resend-email-change-verification",
      {},
      actor.cookie,
    );
    expect(recovered.status).toBe(200);
    expect(tokenFromEmail(newEmail, "/confirm-email-change")).toBeTruthy();
  });

  it("keeps a possibly delivered link valid after an ambiguous send failure", async () => {
    const actor = await createTestActor();
    const newEmail = `timeout-${randomUUID()}@example.com`;
    setTestEmailDeliveryHook(async (options) => {
      testEmailOutbox.push(options);
      throw new Error("Provider timed out after acceptance");
    });

    const response = await postResponse(
      "/change-email",
      { newEmail },
      actor.cookie,
    );
    expect(response.status).toBe(503);
    const token = tokenFromEmail(newEmail, "/confirm-email-change");
    setTestEmailDeliveryHook(null);
    const confirmed = await post("/confirm-email-change", { token });
    expect(redirectStatus(confirmed.redirectURL)).toBe("success");
    expect((await storedUser(actor.id))?.email).toBe(newEmail);
  });

  it("keeps a possibly delivered confirmation valid after approval is consumed", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const newEmail = `approval-timeout-${randomUUID()}@example.com`;
    await post("/change-email", { newEmail }, actor.cookie);
    const approvalToken = tokenFromEmail(actor.email, "/approve-email-change");
    setTestEmailDeliveryHook(async (options) => {
      testEmailOutbox.push(options);
      throw new Error("Provider timed out after acceptance");
    });

    const response = await postResponse("/approve-email-change", {
      token: approvalToken,
    });
    expect(response.status).toBe(503);
    const confirmationToken = tokenFromEmail(newEmail, "/confirm-email-change");
    setTestEmailDeliveryHook(null);
    const confirmed = await post("/confirm-email-change", {
      token: confirmationToken,
    });
    expect(redirectStatus(confirmed.redirectURL)).toBe("success");
    expect((await storedUser(actor.id))?.email).toBe(newEmail);
  });

  it("keeps only the latest active challenge across delayed sends at a cooldown boundary", async () => {
    const actor = await createTestActor();
    const firstEmail = `first-${randomUUID()}@example.com`;
    const secondEmail = `second-${randomUUID()}@example.com`;
    let releaseFirst: () => void = () => undefined;
    let firstEntered: () => void = () => undefined;
    const entered = new Promise<void>((resolve) => {
      firstEntered = resolve;
    });
    const released = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    setTestEmailDeliveryHook(async ({ to }) => {
      if (to === firstEmail) {
        firstEntered();
        await released;
      }
    });

    const first = postResponse(
      "/change-email",
      { newEmail: firstEmail },
      actor.cookie,
    );
    await entered;
    await db
      .update(applicationRateLimit)
      .set({ resetAt: new Date(Date.now() - 1000) });
    const second = await postResponse(
      "/change-email",
      { newEmail: secondEmail },
      actor.cookie,
    );
    releaseFirst();
    expect(second.status).toBe(200);
    expect((await first).status).toBe(200);

    const records = await db
      .select()
      .from(verification)
      .where(
        like(verification.identifier, `account-email-change:${actor.id}:%`),
      );
    expect(records).toHaveLength(1);
    expect(JSON.parse(records[0]?.value ?? "{}").newEmail).toBe(secondEmail);
    expect(testEmailOutbox.some((entry) => entry.to === firstEmail)).toBe(true);
    expect(testEmailOutbox.some((entry) => entry.to === secondEmail)).toBe(
      true,
    );
    const staleToken = tokenFromEmail(firstEmail, "/confirm-email-change");
    const staleResult = await post("/confirm-email-change", {
      token: staleToken,
    });
    expect(redirectStatus(staleResult.redirectURL)).toBe("invalid");
  });
  it("throttles a destination across accounts and returns a retry hint", async () => {
    const firstActor = await createTestActor();
    const secondActor = await createTestActor();
    const newEmail = "shared-destination@example.com";

    const responses = await Promise.all([
      postResponse("/change-email", { newEmail }, firstActor.cookie),
      postResponse("/change-email", { newEmail }, secondActor.cookie),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 429]);
    const limited = responses.find(({ status }) => status === 429);
    expect(Number(limited?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      testEmailOutbox.filter((entry) => entry.to === newEmail),
    ).toHaveLength(1);
  });

  it("throttles confirmation delivery from verified accounts to one destination", async () => {
    const firstActor = await createTestActor({ emailVerified: true });
    const secondActor = await createTestActor({ emailVerified: true });
    const newEmail = "shared-verified-destination@example.com";

    await post("/change-email", { newEmail }, firstActor.cookie);
    await post("/change-email", { newEmail }, secondActor.cookie);
    const firstToken = tokenFromEmail(
      firstActor.email,
      "/approve-email-change",
    );
    const secondToken = tokenFromEmail(
      secondActor.email,
      "/approve-email-change",
    );

    const responses = await Promise.all([
      postResponse("/approve-email-change", { token: firstToken }),
      postResponse("/approve-email-change", { token: secondToken }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 429]);
    const limited = responses.find(({ status }) => status === 429);
    expect(Number(limited?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(
      testEmailOutbox.filter(
        (entry) =>
          entry.to === newEmail && entry.text.includes("/confirm-email-change"),
      ),
    ).toHaveLength(1);
  });

  it("rejects malformed and expired approval tokens without issuing a confirmation", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const newEmail = "expired-approval@example.com";
    await post("/change-email", { newEmail }, actor.cookie);
    const token = tokenFromEmail(actor.email, "/approve-email-change");

    const invalid = await post("/approve-email-change", { token: "bad-token" });
    expect(redirectStatus(invalid.redirectURL)).toBe("invalid");

    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verification.identifier, `%:${token}`));
    const expired = await post("/approve-email-change", { token });
    expect(redirectStatus(expired.redirectURL)).toBe("expired");
    expect((await storedUser(actor.id))?.email).toBe(actor.email);
    expect(testEmailOutbox.some((entry) => entry.to === newEmail)).toBe(false);
  });

  it("rejects malformed and expired confirmation tokens without changing the email", async () => {
    const actor = await createTestActor();
    const newEmail = "new@example.com";
    await post("/change-email", { newEmail }, actor.cookie);
    const token = tokenFromEmail(newEmail, "/confirm-email-change");

    const invalid = await post("/confirm-email-change", { token: "bad-token" });
    expect(redirectStatus(invalid.redirectURL)).toBe("invalid");

    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(like(verification.identifier, `%:${token}`));
    const expired = await post("/confirm-email-change", { token });
    expect(redirectStatus(expired.redirectURL)).toBe("expired");
    expect((await storedUser(actor.id))?.email).toBe(actor.email);
  });

  it("requires approval and confirmation tokens for their own steps and rejects replays", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const newEmail = "approved@example.com";
    await post("/change-email", { newEmail }, actor.cookie);
    const approvalToken = tokenFromEmail(actor.email, "/approve-email-change");

    const wrongStep = await post("/confirm-email-change", {
      token: approvalToken,
    });
    expect(redirectStatus(wrongStep.redirectURL)).toBe("invalid");
    expect((await storedUser(actor.id))?.email).toBe(actor.email);

    const approved = await post("/approve-email-change", {
      token: approvalToken,
    });
    expect(redirectStatus(approved.redirectURL)).toBe("pending");
    expect((await storedUser(actor.id))?.email).toBe(actor.email);
    const replayApproval = await post("/approve-email-change", {
      token: approvalToken,
    });
    expect(redirectStatus(replayApproval.redirectURL)).toBe("invalid");

    const confirmationToken = tokenFromEmail(newEmail, "/confirm-email-change");
    const wrongApproval = await post("/approve-email-change", {
      token: confirmationToken,
    });
    expect(redirectStatus(wrongApproval.redirectURL)).toBe("invalid");

    const confirmed = await post("/confirm-email-change", {
      token: confirmationToken,
    });
    expect(redirectStatus(confirmed.redirectURL)).toBe("success");
    const replayConfirmation = await post("/confirm-email-change", {
      token: confirmationToken,
    });
    expect(redirectStatus(replayConfirmation.redirectURL)).toBe("invalid");
    expect((await storedUser(actor.id))?.email).toBe(newEmail);
    expect((await storedUser(actor.id))?.emailVerified).toBe(true);
  });

  it("allows only one simultaneous confirmation to update the email", async () => {
    const actor = await createTestActor();
    const newEmail = "concurrent@example.com";
    await post("/change-email", { newEmail }, actor.cookie);
    const token = tokenFromEmail(newEmail, "/confirm-email-change");

    const results = await Promise.all([
      post("/confirm-email-change", { token }),
      post("/confirm-email-change", { token }),
    ]);
    expect(
      results.map((result) => redirectStatus(result.redirectURL)).sort(),
    ).toEqual(["invalid", "success"]);
    expect((await storedUser(actor.id))?.email).toBe(newEmail);
  });

  it("allows only one simultaneous approval to issue a new token", async () => {
    const actor = await createTestActor({ emailVerified: true });
    const newEmail = "concurrent-approval@example.com";
    await post("/change-email", { newEmail }, actor.cookie);
    const token = tokenFromEmail(actor.email, "/approve-email-change");

    const responses = await Promise.all([
      postResponse("/approve-email-change", { token }),
      postResponse("/approve-email-change", { token }),
    ]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 429]);
    const successful = responses.find(({ status }) => status === 200);
    const result = (await successful?.json()) as { redirectURL?: string };
    expect(redirectStatus(result.redirectURL)).toBe("pending");
    expect((await storedUser(actor.id))?.email).toBe(actor.email);
    const pending = await db
      .select()
      .from(verification)
      .where(
        like(verification.identifier, `account-email-change:${actor.id}:%`),
      );
    expect(pending).toHaveLength(1);
    expect(
      testEmailOutbox.filter(
        (entry) =>
          entry.to === newEmail && entry.text.includes("/confirm-email-change"),
      ),
    ).toHaveLength(1);
  });
});
