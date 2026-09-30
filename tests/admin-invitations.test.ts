import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimitStore } from "@/adapters/rate-limit/store";
import db from "@/server/db";
import {
  claimPendingInvitationForUser,
  createInvitationRecord,
  findAcceptedInvitationForUser,
  findInvitationById,
  revokeActivePendingInvitation,
  rotateActivePendingInvitationToken,
} from "@/server/db/dal/invitations";
import { invitation, user } from "@/server/db/schema";
import { setBillingStripeClientForTests } from "@/server/db/services/billing/stripe-client";
import {
  createInvitationToken,
  hashInvitationToken,
  validateInvitationToken,
} from "@/server/db/services/invitations/service";
import { apiErrors } from "@/server/http/errors";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";
import { httpRequest } from "./infra/http-request";

const origin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json", origin };
const app = new Elysia({ prefix: "/api" }).use(apiErrors).use(adminRoutes);

beforeEach(() => {
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
      retrieve: async (id: string) => ({
        deleted: false,
        email: null,
        id,
        object: "customer",
      }),
      search: async () => ({
        data: [],
        has_more: false,
        object: "search_result",
        url: "/v1/customers/search",
      }),
      update: async (id: string) => ({ id, object: "customer" }),
    },
  } as never);
});

function invitationBody(email = `invite-${randomUUID()}@example.com`) {
  return JSON.stringify({ email, role: "admin" });
}

function invitationEmails() {
  return testEmailOutbox.filter(
    (email) => email.subject === "Accept your Mirage invitation",
  );
}

async function createInvitationFixture({
  createdAt,
  email = `fixture-${randomUUID()}@example.com`,
  expiresAt = new Date(Date.now() + 60_000),
  invitedByUserId,
  status = "pending",
  tokenHash = hashInvitationToken(createInvitationToken()),
}: {
  createdAt?: Date;
  email?: string;
  expiresAt?: Date;
  invitedByUserId: string;
  status?: "accepted" | "pending" | "revoked";
  tokenHash?: string;
}) {
  return createInvitationRecord({
    createdAt,
    email,
    expiresAt,
    invitedByUserId,
    role: "user",
    status,
    tokenHash,
    updatedAt: createdAt,
  });
}

async function createUserFixture(email = `user-${randomUUID()}@example.com`) {
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

describe("admin invitation routes", () => {
  it.each([
    { actor: "visitor", expected: 404 },
    { actor: "user", expected: 404 },
    { actor: "unverified admin", expected: 403 },
    { actor: "admin lacking required assurance", expected: 403 },
    { actor: "verified admin", expected: 200 },
  ] as const)(
    "enforces admin access for $actor",
    async ({ actor, expected }) => {
      const current =
        actor === "visitor"
          ? null
          : await createTestActor({
              role: actor === "user" ? "user" : "admin",
              emailVerified: actor !== "user" && actor !== "unverified admin",
              twoFactorEnabled: actor !== "admin lacking required assurance",
            });
      const managed =
        actor === "verified admin" && current
          ? await createInvitationFixture({ invitedByUserId: current.id })
          : { id: randomUUID() };

      const list = await httpRequest(app, "/api/admin/invitations", {
        cookie: current?.cookie,
      });
      expect(list.status).toBe(expected);

      const create = await httpRequest(app, "/api/admin/invitations", {
        body: invitationBody(),
        cookie: current?.cookie,
        headers: jsonHeaders,
        method: "POST",
      });
      expect(create.status).toBe(expected);

      for (const action of ["resend", "revoke"] as const) {
        const response = await httpRequest(
          app,
          `/api/admin/invitations/${managed.id}/${action}`,
          {
            cookie: current?.cookie,
            headers: { origin },
            method: "POST",
          },
        );
        expect(response.status).toBe(expected);
      }
    },
  );

  it("allows an admin to create an invitation without exposing token material", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const email = `created-${randomUUID()}@example.com`;

    const response = await httpRequest(app, "/api/admin/invitations", {
      body: invitationBody(email),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      status: true,
      invitation: {
        email,
        effectiveStatus: "pending",
        invitedByUserId: admin.id,
        role: "admin",
        status: "pending",
      },
    });
    expect(JSON.stringify(body)).not.toContain("tokenHash");
    expect(body.invitation).not.toHaveProperty("token");
    expect(body.invitation.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(body.invitation.expiresAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(body.invitation.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, body.invitation.id));
    expect(stored?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(body)).not.toContain(stored?.tokenHash);
    const sentInvitationEmails = invitationEmails();
    expect(sentInvitationEmails).toHaveLength(1);
    expect(sentInvitationEmails[0]).toMatchObject({
      subject: "Accept your Mirage invitation",
      to: email,
    });
    expect(sentInvitationEmails[0]?.text).toContain("/invite/accept#token=");
  });

  it("returns 503 and revokes the invite when invitation email delivery fails", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const email = `delivery-failure-${randomUUID()}@example.com`;
    setTestEmailDeliveryHook(async () => {
      throw new Error("Email delivery failed.");
    });

    const response = await httpRequest(app, "/api/admin/invitations", {
      body: invitationBody(email),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status, await response.clone().text()).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Invitation email could not be delivered.",
    });
    expect(invitationEmails()).toHaveLength(0);

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.email, email));
    expect(stored).toMatchObject({
      email,
      status: "revoked",
    });
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it.each([
    { body: { email: "not-an-email", role: "user" }, name: "invalid email" },
    {
      body: { email: `bad-role-${randomUUID()}@example.com`, role: "owner" },
      name: "invalid role",
    },
    {
      body: {
        email: `bad-role-shape-${randomUUID()}@example.com`,
        role: ["owner"],
      },
      name: "invalid role shape",
    },
  ])("rejects $name with 400", async ({ body }) => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const response = await httpRequest(app, "/api/admin/invitations", {
      body: JSON.stringify(body),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });

    expect(response.status).toBe(400);
  });

  it("rejects duplicate active invitations and existing users with 409", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const existing = await createTestActor();
    const duplicateEmail = `duplicate-${randomUUID()}@example.com`;

    const firstDuplicate = await httpRequest(app, "/api/admin/invitations", {
      body: invitationBody(duplicateEmail),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });
    expect(firstDuplicate.status).toBe(200);

    const duplicate = await httpRequest(app, "/api/admin/invitations", {
      body: invitationBody(duplicateEmail),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });
    expect(duplicate.status).toBe(409);

    const existingUser = await httpRequest(app, "/api/admin/invitations", {
      body: invitationBody(existing.email),
      cookie: admin.cookie,
      headers: jsonHeaders,
      method: "POST",
    });
    expect(existingUser.status).toBe(409);
  });

  it("lists invitations newest first with derived effective status", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const older = await createInvitationFixture({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      email: `older-${randomUUID()}@example.com`,
      invitedByUserId: admin.id,
    });
    const expired = await createInvitationFixture({
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      email: `expired-${randomUUID()}@example.com`,
      expiresAt: new Date(Date.now() - 60_000),
      invitedByUserId: admin.id,
    });
    const newest = await createInvitationFixture({
      createdAt: new Date("2026-01-05T00:00:00.000Z"),
      email: `newest-${randomUUID()}@example.com`,
      invitedByUserId: admin.id,
    });

    const response = await httpRequest(
      app,
      "/api/admin/invitations?page=1&limit=2",
      { cookie: admin.cookie },
    );

    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      firstItem: 1,
      hasNextPage: true,
      limit: 2,
      page: 1,
      total: 3,
    });
    expect(body.invitations.map(({ id }: { id: string }) => id)).toEqual([
      newest.id,
      expired.id,
    ]);
    expect(body.invitations[1]).toMatchObject({
      id: expired.id,
      effectiveStatus: "expired",
      status: "pending",
    });
    expect(body.invitations[0].createdAt).toBe(newest.createdAt.toISOString());
    expect(body.invitations[1].expiresAt).toBe(expired.expiresAt.toISOString());
    expect(JSON.stringify(body)).not.toContain("tokenHash");
    expect(JSON.stringify(body)).not.toContain(older.tokenHash);
    expect(JSON.stringify(body)).not.toContain(expired.tokenHash);
    expect(JSON.stringify(body)).not.toContain(newest.tokenHash);
  });

  it("filters effective pending and expired invitations before pagination", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const pendingOlder = await createInvitationFixture({
      createdAt: new Date("2026-02-01T00:00:00.000Z"),
      email: `pending-older-${randomUUID()}@example.com`,
      invitedByUserId: admin.id,
    });
    const expired = await createInvitationFixture({
      createdAt: new Date("2026-02-02T00:00:00.000Z"),
      email: `expired-filter-${randomUUID()}@example.com`,
      expiresAt: new Date(Date.now() - 60_000),
      invitedByUserId: admin.id,
    });
    const pendingNewest = await createInvitationFixture({
      createdAt: new Date("2026-02-03T00:00:00.000Z"),
      email: `pending-newest-${randomUUID()}@example.com`,
      invitedByUserId: admin.id,
    });

    const pendingResponse = await httpRequest(
      app,
      "/api/admin/invitations?effectiveStatus=pending&page=1&limit=1",
      { cookie: admin.cookie },
    );
    expect(pendingResponse.status, await pendingResponse.clone().text()).toBe(
      200,
    );
    const pendingBody = await pendingResponse.json();
    expect(pendingBody).toMatchObject({
      hasNextPage: true,
      limit: 1,
      page: 1,
      total: 2,
      totalPages: 2,
    });
    expect(pendingBody.invitations.map(({ id }: { id: string }) => id)).toEqual(
      [pendingNewest.id],
    );

    const expiredResponse = await httpRequest(
      app,
      "/api/admin/invitations?effectiveStatus=expired&page=1&limit=1",
      { cookie: admin.cookie },
    );
    expect(expiredResponse.status, await expiredResponse.clone().text()).toBe(
      200,
    );
    const expiredBody = await expiredResponse.json();
    expect(expiredBody).toMatchObject({
      hasNextPage: false,
      limit: 1,
      page: 1,
      total: 1,
      totalPages: 1,
    });
    expect(expiredBody.invitations).toHaveLength(1);
    expect(expiredBody.invitations[0]).toMatchObject({
      effectiveStatus: "expired",
      id: expired.id,
    });
    expect(JSON.stringify(pendingBody)).not.toContain(expired.id);
    expect(JSON.stringify(expiredBody)).not.toContain(pendingOlder.id);
  });

  it("resends an active pending invitation from the existing admin route tree", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const originalToken = createInvitationToken();
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
      tokenHash: hashInvitationToken(originalToken),
    });

    const response = await httpRequest(
      app,
      `/api/admin/invitations/${created.id}/resend`,
      {
        cookie: admin.cookie,
        headers: { origin },
        method: "POST",
      },
    );

    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      invitation: {
        effectiveStatus: "pending",
        id: created.id,
        status: "pending",
      },
      status: true,
    });
    expect(body.invitation).not.toHaveProperty("tokenHash");

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.id));
    expect(stored?.tokenHash).not.toBe(hashInvitationToken(originalToken));
    expect(invitationEmails()).toHaveLength(1);
    await expect(validateInvitationToken(originalToken)).resolves.toEqual({
      status: "invalid",
      valid: false,
    });
  });

  it("sends exactly one email for concurrent resend requests", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
    });

    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        httpRequest(app, `/api/admin/invitations/${created.id}/resend`, {
          cookie: admin.cookie,
          headers: { origin },
          method: "POST",
        }),
      ),
    );

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    expect(invitationEmails()).toHaveLength(1);
  });

  it("revokes instead of resending after the email registers independently", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const existing = await createUserFixture();
    const created = await createInvitationFixture({
      email: existing.email,
      invitedByUserId: admin.id,
    });

    const response = await httpRequest(
      app,
      `/api/admin/invitations/${created.id}/resend`,
      { cookie: admin.cookie, headers: { origin }, method: "POST" },
    );

    expect(response.status).toBe(409);
    expect(invitationEmails()).toHaveLength(0);
    await expect(findInvitationById(created.id)).resolves.toMatchObject({
      status: "revoked",
    });
  });

  it("restores the previous token and expiry when resend delivery fails", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const originalToken = createInvitationToken();
    const created = await createInvitationFixture({
      expiresAt: new Date(Date.now() + 60_000),
      invitedByUserId: admin.id,
      tokenHash: hashInvitationToken(originalToken),
    });
    setTestEmailDeliveryHook(async () => {
      throw new Error("Email delivery failed.");
    });

    const response = await httpRequest(
      app,
      `/api/admin/invitations/${created.id}/resend`,
      {
        cookie: admin.cookie,
        headers: { origin },
        method: "POST",
      },
    );

    expect(response.status, await response.clone().text()).toBe(503);
    await expect(response.json()).resolves.toEqual({
      message: "Invitation email could not be delivered.",
    });

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.id));
    expect(stored).toMatchObject({
      id: created.id,
      status: "pending",
      revokedAt: null,
    });
    expect(stored?.tokenHash).toBe(hashInvitationToken(originalToken));
    expect(stored?.expiresAt).toEqual(created.expiresAt);

    setTestEmailDeliveryHook(null);
    const retry = await httpRequest(
      app,
      `/api/admin/invitations/${created.id}/resend`,
      {
        cookie: admin.cookie,
        headers: { origin },
        method: "POST",
      },
    );
    expect(retry.status, await retry.clone().text()).toBe(200);
  });

  it("revokes an active pending invitation from the existing admin route tree", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
    });

    const response = await httpRequest(
      app,
      `/api/admin/invitations/${created.id}/revoke`,
      {
        cookie: admin.cookie,
        headers: { origin },
        method: "POST",
      },
    );

    expect(response.status, await response.clone().text()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      invitation: {
        effectiveStatus: "revoked",
        id: created.id,
        status: "revoked",
      },
      status: true,
    });

    const [stored] = await db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.id));
    expect(stored?.revokedAt).toBeInstanceOf(Date);
  });

  it("prevents stale resend from winning against accept", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const invited = await createUserFixture();
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const created = await createInvitationFixture({
      email: invited.email,
      invitedByUserId: admin.id,
      tokenHash,
    });

    await db.transaction(async (tx) => {
      const claimed = await claimPendingInvitationForUser({
        email: invited.email,
        executor: tx,
        tokenHash,
        userId: invited.id,
      });
      expect(claimed?.status).toBe("accepted");
    });

    const rotated = await rotateActivePendingInvitationToken({
      expectedTokenHash: tokenHash,
      expiresAt: new Date(Date.now() + 120_000),
      id: created.id,
      tokenHash: hashInvitationToken(createInvitationToken()),
    });

    expect(rotated).toBeNull();
  });

  it("prevents stale revoke from winning against accept", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const invited = await createUserFixture();
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const created = await createInvitationFixture({
      email: invited.email,
      invitedByUserId: admin.id,
      tokenHash,
    });

    await db.transaction(async (tx) => {
      const claimed = await claimPendingInvitationForUser({
        email: invited.email,
        executor: tx,
        tokenHash,
        userId: invited.id,
      });
      expect(claimed?.status).toBe("accepted");
    });

    const revoked = await revokeActivePendingInvitation({
      expectedTokenHash: tokenHash,
      id: created.id,
    });

    expect(revoked).toBeNull();
  });

  it("allows only one stale operation to win in resend vs revoke", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
      tokenHash,
    });

    const [rotated, revoked] = await Promise.all([
      rotateActivePendingInvitationToken({
        expectedTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 120_000),
        id: created.id,
        tokenHash: hashInvitationToken(createInvitationToken()),
      }),
      revokeActivePendingInvitation({
        expectedTokenHash: tokenHash,
        id: created.id,
      }),
    ]);

    expect([rotated, revoked].filter(Boolean)).toHaveLength(1);
  });

  it("allows only one concurrent resend to rotate a pending invitation", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
      tokenHash,
    });

    const results = await Promise.all([
      rotateActivePendingInvitationToken({
        expectedTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 120_000),
        id: created.id,
        tokenHash: hashInvitationToken(createInvitationToken()),
      }),
      rotateActivePendingInvitationToken({
        expectedTokenHash: tokenHash,
        expiresAt: new Date(Date.now() + 120_000),
        id: created.id,
        tokenHash: hashInvitationToken(createInvitationToken()),
      }),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("loads inviter details only for the user who accepted the invitation", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const invited = await createUserFixture();
    const otherUser = await createUserFixture();
    const tokenHash = hashInvitationToken(createInvitationToken());
    const created = await createInvitationFixture({
      email: invited.email,
      invitedByUserId: admin.id,
      tokenHash,
    });

    expect(await findAcceptedInvitationForUser(invited.id)).toBeNull();

    await db.transaction(async (tx) => {
      await claimPendingInvitationForUser({
        email: invited.email,
        executor: tx,
        tokenHash,
        userId: invited.id,
      });
    });

    expect(await findAcceptedInvitationForUser(otherUser.id)).toBeNull();
    expect(await findAcceptedInvitationForUser(invited.id)).toMatchObject({
      email: invited.email,
      id: created.id,
      invitedBy: {
        email: admin.email,
        id: admin.id,
      },
      role: "user",
    });
  });

  it("rejects missing or invalid same-origin headers on every mutation", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const created = await createInvitationFixture({
      invitedByUserId: admin.id,
    });

    const headerCases: Record<string, string>[] = [
      { "content-type": "application/json" },
      { "content-type": "application/json", origin: "https://evil.example" },
    ];

    for (const headers of headerCases) {
      const response = await httpRequest(app, "/api/admin/invitations", {
        body: invitationBody(),
        cookie: admin.cookie,
        headers,
        method: "POST",
      });
      expect(response.status).toBe(403);

      for (const action of ["resend", "revoke"] as const) {
        const mutation = await httpRequest(
          app,
          `/api/admin/invitations/${created.id}/${action}`,
          { cookie: admin.cookie, headers, method: "POST" },
        );
        expect(mutation.status).toBe(403);
      }
    }

    const list = await httpRequest(app, "/api/admin/invitations", {
      cookie: admin.cookie,
    });
    expect(list.status).toBe(200);
  });

  it("returns 429 when the invitation mutation policy is exhausted", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const spy = vi
      .spyOn(rateLimitStore, "consumePolicy")
      .mockResolvedValueOnce({
        allowed: false,
        retryAfterSeconds: 30,
      });

    try {
      const response = await httpRequest(app, "/api/admin/invitations", {
        body: invitationBody(),
        cookie: admin.cookie,
        headers: jsonHeaders,
        method: "POST",
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBe("30");
      expect(await response.json()).toEqual({
        message: "Too many admin invitation requests. Please try again later.",
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("keeps DAL list selections admin-safe", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    await createInvitationFixture({ invitedByUserId: admin.id });

    const [stored] = await db
      .select()
      .from(invitation)
      .orderBy(desc(invitation.createdAt))
      .limit(1);
    expect(stored?.tokenHash).toBeTruthy();

    const response = await httpRequest(app, "/api/admin/invitations", {
      cookie: admin.cookie,
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.invitations[0]).not.toHaveProperty("tokenHash");
  });
});
