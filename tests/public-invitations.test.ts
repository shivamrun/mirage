import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimitStore } from "@/adapters/rate-limit/store";
import { auth } from "@/features/auth/better-auth/server";
import db from "@/server/db";
import { invitation, session, user } from "@/server/db/schema";
import { setBillingStripeClientForTests } from "@/server/db/services/billing/stripe-client";
import {
  createInvitation,
  resendInvitationEmail,
} from "@/server/db/services/invitations/service";
import { invitationRoutes } from "@/server/routes/invitations";
import { setTestEmailDeliveryHook } from "./infra/email-fake";
import { httpRequest } from "./infra/http-request";

const origin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json", origin };
const app = new Elysia({ prefix: "/api" }).use(invitationRoutes);

function installStripeCustomerStub(
  deleteCustomer: (id: string) => Promise<unknown> = async (id) => ({
    deleted: true,
    id,
    object: "customer",
  }),
) {
  setBillingStripeClientForTests({
    customers: {
      create: async () => ({
        id: `cus_${randomUUID().replaceAll("-", "")}`,
        object: "customer",
      }),
      list: async () => ({
        data: [],
        has_more: false,
        object: "list",
        url: "/v1/customers",
      }),
      search: async () => ({
        data: [],
        has_more: false,
        object: "search_result",
        url: "/v1/customers/search",
      }),
      del: deleteCustomer,
      retrieve: async (id: string) => ({
        deleted: false,
        email: null,
        id,
        object: "customer",
      }),
      update: async (id: string) => ({ id, object: "customer" }),
    },
  } as never);
}

async function createUser(email = `user-${randomUUID()}@example.com`) {
  const [record] = await db
    .insert(user)
    .values({
      email,
      id: randomUUID(),
      name: "Test User",
    })
    .returning();

  if (!record) {
    throw new Error("Test user could not be created.");
  }

  return record;
}

async function createInvite({
  email = `invite-${randomUUID()}@example.com`,
  role = "admin",
}: {
  email?: string;
  role?: "admin" | "user";
} = {}) {
  const inviter = await createUser();
  const result = await createInvitation({
    email,
    invitedByUserId: inviter.id,
    role,
  });

  if (result.status !== "success") {
    throw new Error(`Invitation fixture failed: ${result.status}`);
  }

  return result;
}

beforeEach(() => {
  installStripeCustomerStub();
});

describe("public invitation routes", () => {
  it("validates a pending invitation without exposing token material", async () => {
    const created = await createInvite();

    const response = await httpRequest(app, "/api/invitations/validate", {
      body: JSON.stringify({ token: created.token }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      email: created.invitation.email,
      status: "valid",
      valid: true,
    });
    expect(JSON.stringify(body)).not.toContain(created.token);
    expect(JSON.stringify(body)).not.toContain(created.invitation.tokenHash);
  });

  it.each([
    {
      mutation: () => ({
        expiresAt: new Date(Date.now() - 60_000),
      }),
      status: "expired",
    },
    {
      mutation: () => ({
        revokedAt: new Date(),
        status: "revoked" as const,
      }),
      status: "revoked",
    },
    {
      mutation: () => ({
        acceptedAt: new Date(),
        status: "accepted" as const,
      }),
      status: "accepted",
    },
  ])("validates $status invitations safely", async ({ mutation, status }) => {
    const created = await createInvite();
    await db
      .update(invitation)
      .set(mutation())
      .where(eq(invitation.id, created.invitation.id));

    const response = await httpRequest(app, "/api/invitations/validate", {
      body: JSON.stringify({ token: created.token }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status,
      valid: false,
    });
  });

  it("does not reveal when the invited email became an existing user", async () => {
    const created = await createInvite();
    await createUser(created.invitation.email);

    const response = await httpRequest(app, "/api/invitations/validate", {
      body: JSON.stringify({ token: created.token }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "invalid",
      valid: false,
    });
    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.invitation.id));
    expect(stored?.status).toBe("revoked");
  });

  it("accepts an invitation signup, grants role, marks accepted, and forwards auth cookies", async () => {
    const created = await createInvite();
    const signup = vi.spyOn(auth.api, "signUpEmail");

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        callbackURL: "/admin",
        email: created.invitation.email,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: { ...jsonHeaders, "x-captcha-response": "captcha-token" },
      method: "POST",
    });

    expect(response.status, await response.clone().text()).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirectTo: "/admin",
      status: true,
    });
    expect(response.headers.getSetCookie().join("\n")).toContain(
      "better-auth.session_token=",
    );
    const signupCall = signup.mock.calls[0]?.[0];
    expect(signupCall).toBeDefined();
    expect(new Headers(signupCall?.headers).get("x-captcha-response")).toBe(
      "captcha-token",
    );
    expect(response.headers.getSetCookie().join("\n")).not.toContain(
      created.token,
    );

    const [accepted] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.invitation.id));
    expect(accepted).toMatchObject({
      acceptedByUserId: expect.any(String),
      status: "accepted",
    });
    expect(accepted?.acceptedAt).toBeInstanceOf(Date);

    const [acceptedUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, created.invitation.email));
    expect(acceptedUser).toMatchObject({
      id: accepted?.acceptedByUserId,
      role: "user,admin",
    });
  });

  it("requires same-origin validation and acceptance requests", async () => {
    const created = await createInvite();

    for (const path of [
      "/api/invitations/validate",
      "/api/invitations/accept-signup",
    ]) {
      const response = await httpRequest(app, path, {
        body: path.endsWith("validate")
          ? JSON.stringify({ token: created.token })
          : JSON.stringify({
              agreeToTerms: true,
              email: created.invitation.email,
              password: "TestPassword123!",
              token: created.token,
            }),
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        method: "POST",
      });
      expect(response.status).toBe(403);
      expect(response.headers.getSetCookie()).toEqual([]);
    }
  });

  it("rate limits invitation validation with Retry-After", async () => {
    const spy = vi
      .spyOn(rateLimitStore, "consumePolicy")
      .mockResolvedValueOnce({
        allowed: false,
        retryAfterSeconds: 20,
      });

    try {
      const response = await httpRequest(app, "/api/invitations/validate", {
        body: JSON.stringify({ token: "a".repeat(64) }),
        headers: jsonHeaders,
        method: "POST",
      });
      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("20");
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects replay after an invitation has been accepted", async () => {
    const created = await createInvite();
    const body = {
      agreeToTerms: true,
      email: created.invitation.email,
      password: "TestPassword123!",
      token: created.token,
    };

    const first = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify(body),
      headers: jsonHeaders,
      method: "POST",
    });
    expect(first.status, await first.clone().text()).toBe(200);

    const replay = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        ...body,
        password: "AnotherPassword123!",
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(replay.status).toBe(400);
    expect(replay.headers.getSetCookie()).toEqual([]);
  });

  it("allows only one concurrent acceptance to create and elevate a user", async () => {
    const created = await createInvite();
    const body = JSON.stringify({
      agreeToTerms: true,
      email: created.invitation.email,
      password: "TestPassword123!",
      token: created.token,
    });

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        httpRequest(app, "/api/invitations/accept-signup", {
          body,
          headers: jsonHeaders,
          method: "POST",
        }),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const users = await db
      .select()
      .from(user)
      .where(eq(user.email, created.invitation.email));
    expect(users).toHaveLength(1);
    expect(users[0]?.role).toBe("user,admin");
  });

  it("lets resend revoke when it observes the signup user before claim", async () => {
    const created = await createInvite();
    let resent = false;
    setTestEmailDeliveryHook(async (options) => {
      if (
        !resent &&
        options.to === created.invitation.email &&
        options.subject.includes("Verify")
      ) {
        resent = true;
        const result = await resendInvitationEmail({
          id: created.invitation.id,
        });
        expect(result.status).toBe("existing-user");
      }
    });

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        email: created.invitation.email,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(response.headers.getSetCookie()).toEqual([]);
    await expect(
      db.select().from(user).where(eq(user.email, created.invitation.email)),
    ).resolves.toEqual([]);
    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.invitation.id));
    expect(stored?.status).toBe("revoked");
    expect(stored?.tokenHash).toBe(created.invitation.tokenHash);
  });

  it("rejects mismatched invited email without creating a user or forwarding cookies", async () => {
    const created = await createInvite();
    const mismatchedEmail = `mismatch-${randomUUID()}@example.com`;

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        email: mismatchedEmail,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(response.headers.getSetCookie()).toEqual([]);
    await expect(
      db.select().from(user).where(eq(user.email, mismatchedEmail)),
    ).resolves.toEqual([]);
  });

  it("rejects a non-canonical stored role without granting privileges", async () => {
    const created = await createInvite();
    await db
      .update(invitation)
      .set({ role: "admin,user" })
      .where(eq(invitation.id, created.invitation.id));

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        email: created.invitation.email,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toEqual([]);
    await expect(
      db.select().from(user).where(eq(user.email, created.invitation.email)),
    ).resolves.toEqual([]);
  });

  it("does not expose Better Auth signup error details", async () => {
    const created = await createInvite();
    vi.spyOn(auth.api, "signUpEmail").mockRejectedValueOnce(
      new Error("User already exists. Use another email."),
    );

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        email: created.invitation.email,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      message: "Invitation signup failed.",
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("fails closed and recovers when the invite is no longer claimable after signup", async () => {
    const created = await createInvite();

    setTestEmailDeliveryHook(async (options) => {
      if (
        options.to === created.invitation.email &&
        options.subject.includes("Verify")
      ) {
        await db
          .update(invitation)
          .set({
            revokedAt: new Date(),
            status: "revoked",
          })
          .where(eq(invitation.id, created.invitation.id));
      }
    });

    const response = await httpRequest(app, "/api/invitations/accept-signup", {
      body: JSON.stringify({
        agreeToTerms: true,
        email: created.invitation.email,
        password: "TestPassword123!",
        token: created.token,
      }),
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(409);
    expect(response.headers.getSetCookie()).toEqual([]);

    const createdUsers = await db
      .select()
      .from(user)
      .where(eq(user.email, created.invitation.email));
    expect(createdUsers).toEqual([]);

    const [storedInvitation] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.invitation.id));
    expect(storedInvitation).toMatchObject({
      acceptedAt: null,
      acceptedByUserId: null,
      status: "revoked",
    });
  });

  it("locks down the partial user when Stripe cleanup fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    installStripeCustomerStub(async () => {
      throw new Error("Stripe cleanup failed.");
    });
    const created = await createInvite();
    setTestEmailDeliveryHook(async (options) => {
      if (
        options.to === created.invitation.email &&
        options.subject.includes("Verify")
      ) {
        await db
          .update(invitation)
          .set({ revokedAt: new Date(), status: "revoked" })
          .where(eq(invitation.id, created.invitation.id));
      }
    });

    try {
      const response = await httpRequest(
        app,
        "/api/invitations/accept-signup",
        {
          body: JSON.stringify({
            agreeToTerms: true,
            email: created.invitation.email,
            password: "TestPassword123!",
            token: created.token,
          }),
          headers: jsonHeaders,
          method: "POST",
        },
      );

      expect(response.status).toBe(500);
      expect(response.headers.getSetCookie()).toEqual([]);
      const [partialUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, created.invitation.email));
      expect(partialUser).toMatchObject({ role: "user" });
      if (!partialUser) throw new Error("Partial user was not retained.");
      await expect(
        db.select().from(session).where(eq(session.userId, partialUser.id)),
      ).resolves.toEqual([]);
    } finally {
      log.mockRestore();
    }
  });
});
