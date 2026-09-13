import { randomUUID } from "node:crypto";

import { node } from "@elysia/node";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import {
  applicationRateLimit,
  contactSubmission,
  emailContact,
  emailSubscription,
  verification,
} from "@/server/db/schema";
import { apiErrors } from "@/server/http/errors";
import { contactRoutes } from "@/server/routes/contact";
import { emailListRoutes } from "@/server/routes/email-list";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
function createApp() {
  return new Elysia({ adapter: node(), prefix: "/api" })
    .use(apiErrors)
    .use(contactRoutes)
    .use(emailListRoutes);
}

const app = createApp();

function email() {
  return `test-${randomUUID()}@example.com`;
}

function formRequest(
  path: string,
  body: object,
  extraHeaders: Record<string, string> = {},
  target = app,
) {
  return target.fetch(
    new Request(`${origin}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, ...extraHeaders },
      body: JSON.stringify(body),
    }),
  );
}

function contactBody(address: string) {
  return {
    name: "Test Person",
    email: address,
    message: "A valid contact message.",
  };
}

function signupBody(address: string) {
  return { email: address, listKey: "waitlist" };
}

function latestSignupToken(address: string) {
  const message = testEmailOutbox.findLast((entry) => entry.to === address);
  const link = message?.text.match(/https?:\/\/\S+/)?.[0];
  const token = link && new URL(link).searchParams.get("token");
  if (!token) throw new Error(`No signup token for ${address}`);
  return token;
}

async function verify(token: string) {
  const response = await app.fetch(
    new Request(`${origin}/api/email-list/verify?token=${token}`),
  );
  return new URL(response.headers.get("location") ?? origin).searchParams.get(
    "emailListVerification",
  );
}

async function subscriptionFor(address: string) {
  const [contact] = await db
    .select()
    .from(emailContact)
    .where(eq(emailContact.email, address));
  if (!contact) return null;
  const [subscription] = await db
    .select()
    .from(emailSubscription)
    .where(eq(emailSubscription.contactId, contact.id));
  return subscription ?? null;
}

describe("public contact and email signup", () => {
  it("rejects untrusted origins and malformed form data", async () => {
    const address = email();
    expect(
      (
        await formRequest("/contact/", contactBody(address), {
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await formRequest("/email-list/", signupBody(address), {
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect((await formRequest("/contact/", { email: address })).status).toBe(
      400,
    );
    expect(
      (
        await formRequest("/email-list/", {
          email: "not-an-email",
          listKey: "waitlist",
        })
      ).status,
    ).toBe(400);
    expect(await db.select().from(contactSubmission)).toHaveLength(0);
    expect(await subscriptionFor(address)).toBeNull();
  });

  it("rate-limits repeated requests despite changing client IP headers", async () => {
    const secondAppInstance = createApp();
    const contactEmail = email();
    for (let index = 0; index < 5; index++) {
      const response = await formRequest(
        "/contact/",
        contactBody(contactEmail),
        {
          "x-forwarded-for": `192.0.2.${index}`,
        },
        index % 2 === 0 ? app : secondAppInstance,
      );
      expect(response.status, await response.clone().text()).toBe(200);
    }
    const limitedContact = await formRequest(
      "/contact/",
      contactBody(contactEmail),
      { "x-real-ip": "198.51.100.1" },
      secondAppInstance,
    );
    expect(limitedContact.status).toBe(429);
    expect(Number(limitedContact.headers.get("retry-after"))).toBeGreaterThan(
      0,
    );
    const signupEmail = email();
    for (let index = 0; index < 8; index++) {
      expect(
        (
          await formRequest("/email-list/", signupBody(signupEmail), {
            "x-forwarded-for": `192.0.2.${index}`,
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await formRequest(
          "/email-list/",
          signupBody(signupEmail),
          { "cf-connecting-ip": "198.51.100.2" },
          secondAppInstance,
        )
      ).status,
    ).toBe(429);
  });

  it("enforces one shared budget for parallel requests", async () => {
    const address = email();
    const secondAppInstance = createApp();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        formRequest(
          "/contact/",
          contactBody(address),
          { "x-forwarded-for": `203.0.113.${index}` },
          index % 2 === 0 ? app : secondAppInstance,
        ),
      ),
    );

    expect(responses.filter(({ status }) => status === 200)).toHaveLength(5);
    expect(responses.filter(({ status }) => status === 429)).toHaveLength(3);
  });

  it("prunes expired limiter rows without removing active rows", async () => {
    await db.insert(applicationRateLimit).values([
      {
        count: 1,
        identifierHash: "expired",
        resetAt: new Date(Date.now() - 1000),
        scope: "cleanup-test",
      },
      {
        count: 1,
        identifierHash: "active",
        resetAt: new Date(Date.now() + 60_000),
        scope: "cleanup-test",
      },
    ]);

    expect((await formRequest("/contact/", contactBody(email()))).status).toBe(
      200,
    );

    const remaining = await db
      .select({ identifierHash: applicationRateLimit.identifierHash })
      .from(applicationRateLimit)
      .where(eq(applicationRateLimit.scope, "cleanup-test"));
    expect(remaining).toEqual([{ identifierHash: "active" }]);
  });

  it("consumes a verification token once, including simultaneous requests", async () => {
    const firstEmail = email();
    expect(
      (await formRequest("/email-list/", signupBody(firstEmail))).status,
    ).toBe(200);
    const firstToken = latestSignupToken(firstEmail);
    expect(await verify(firstToken)).toBe("success");
    expect(await verify(firstToken)).toBe("invalid");
    expect((await subscriptionFor(firstEmail))?.status).toBe("subscribed");

    const secondEmail = email();
    expect(
      (await formRequest("/email-list/", signupBody(secondEmail))).status,
    ).toBe(200);
    const secondToken = latestSignupToken(secondEmail);
    expect(
      (await Promise.all([verify(secondToken), verify(secondToken)])).sort(),
    ).toEqual(["invalid", "success"]);
    expect((await subscriptionFor(secondEmail))?.status).toBe("subscribed");
  });

  it("keeps a pending signup after failed delivery so retry can succeed", async () => {
    const address = email();
    setTestEmailDeliveryHook(async () => {
      throw new Error("Test delivery failure");
    });
    const failed = await formRequest("/email-list/", signupBody(address));
    expect(failed.status).toBe(503);
    expect((await failed.json()).message).toMatch(/try signing up again/i);
    expect((await subscriptionFor(address))?.status).toBe("pending");
    expect(await db.select().from(verification)).toHaveLength(0);

    setTestEmailDeliveryHook(null);
    expect(
      (await formRequest("/email-list/", signupBody(address))).status,
    ).toBe(200);
    expect(await verify(latestSignupToken(address))).toBe("success");
    expect((await subscriptionFor(address))?.status).toBe("subscribed");
  });

  it("does not delete another request's pending signup when one email send fails", async () => {
    const address = email();
    let enteredFirst: () => void = () => undefined;
    const firstEntered = new Promise<void>((resolve) => {
      enteredFirst = resolve;
    });
    let rejectFirst: () => void = () => undefined;
    const firstRelease = new Promise<void>((_resolve, reject) => {
      rejectFirst = () => reject(new Error("Test delivery failure"));
    });
    let sends = 0;
    setTestEmailDeliveryHook(async () => {
      sends += 1;
      if (sends === 1) {
        enteredFirst();
        await firstRelease;
      }
    });

    const first = formRequest("/email-list/", signupBody(address));
    await firstEntered;
    const second = await formRequest("/email-list/", signupBody(address));
    expect(second.status).toBe(200);
    rejectFirst();
    expect((await first).status).toBe(503);
    expect((await subscriptionFor(address))?.status).toBe("pending");
    expect(await verify(latestSignupToken(address))).toBe("success");
    expect((await subscriptionFor(address))?.status).toBe("subscribed");
  });
});
