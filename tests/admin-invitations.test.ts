import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

import { rateLimitStore } from "@/adapters/rate-limit/store";
import db from "@/server/db";
import { createInvitationRecord } from "@/server/db/dal/invitations";
import { invitation } from "@/server/db/schema";
import {
  createInvitationToken,
  hashInvitationToken,
} from "@/server/db/services/invitations/service";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";
import { httpRequest } from "./infra/http-request";

const origin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json", origin };
const app = new Elysia({ prefix: "/api" }).use(adminRoutes);

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
}: {
  createdAt?: Date;
  email?: string;
  expiresAt?: Date;
  invitedByUserId: string;
}) {
  return createInvitationRecord({
    createdAt,
    email,
    expiresAt,
    invitedByUserId,
    role: "user",
    status: "pending",
    tokenHash: hashInvitationToken(createInvitationToken()),
    updatedAt: createdAt,
  });
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
    expect(sentInvitationEmails[0]?.text).toContain("/invite/accept?token=");
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

  it("rejects missing or invalid same-origin headers on create only", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });

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
