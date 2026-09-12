import { node } from "@elysia/node";
import { eq, like } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import { user, verification } from "@/server/db/schema";
import { accountRoutes } from "@/server/routes/account";
import { createTestActor } from "./infra/admin-actor";
import { testEmailOutbox } from "./infra/email-fake";

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
