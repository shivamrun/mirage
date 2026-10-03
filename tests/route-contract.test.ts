import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import {
  contactSubmission,
  emailList,
  invitation,
  verification,
} from "@/server/db/schema";
import {
  resetNotificationRealtimeBrokerForTests,
  subscribe,
} from "@/server/db/services/notifications/realtime-broker";
import { app } from "@/server/routes";
import {
  notificationRealtimeEventNames,
  notificationRealtimeRetryMs,
} from "@/shared/schemas/notifications";
import { createTestActor } from "./infra/admin-actor";
import { testEmailOutbox } from "./infra/email-fake";
import { httpRequest } from "./infra/http-request";

const trustedOrigin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json" };

const mutationRoutes = [
  {
    method: "POST",
    path: "/api/account/admin-step-up/totp",
    access: "user",
  },
  { method: "POST", path: "/api/account/two-factor/send-code", access: "user" },
  {
    method: "POST",
    path: "/api/account/two-factor/start-setup",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/account/two-factor/verify-setup",
    access: "user",
  },
  { method: "POST", path: "/api/account/two-factor/disable", access: "user" },
  {
    method: "POST",
    path: "/api/account/confirm-email-change",
    access: "public",
  },
  {
    method: "POST",
    path: "/api/account/approve-email-change",
    access: "public",
  },
  { method: "POST", path: "/api/account/change-email", access: "user" },
  { method: "POST", path: "/api/account/cancel-email-change", access: "user" },
  { method: "POST", path: "/api/account/resend-verification", access: "user" },
  {
    method: "POST",
    path: "/api/account/notifications/:id/read",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/account/notifications/:id/unread",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/account/notifications/read-all",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/account/notifications/test",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/account/resend-email-change-verification",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/auth-actions/protected-route-verification-email",
    access: "user",
  },
  { method: "POST", path: "/api/contact/", access: "public" },
  { method: "POST", path: "/api/billing/checkout", access: "user" },
  { method: "POST", path: "/api/credits/sample-create", access: "user" },
  { method: "POST", path: "/api/email-list/", access: "public" },
  { method: "POST", path: "/api/invitations/validate", access: "public" },
  {
    method: "POST",
    path: "/api/invitations/accept-signup",
    access: "public",
  },
  { method: "POST", path: "/api/uploads/", access: "user" },
  {
    method: "DELETE",
    path: "/api/admin/users/:userId/accounts/:accountRowId",
    access: "admin",
  },
  {
    method: "DELETE",
    path: "/api/admin/users/:userId/sessions/:sessionId",
    access: "admin",
  },
  {
    method: "POST",
    path: "/api/admin/users/:userId/credits/adjust",
    access: "admin",
  },
  { method: "POST", path: "/api/admin/invitations", access: "admin" },
  {
    method: "POST",
    path: "/api/admin/invitations/:id/resend",
    access: "admin",
  },
  {
    method: "POST",
    path: "/api/admin/invitations/:id/revoke",
    access: "admin",
  },
  { method: "POST", path: "/api/admin/email-list", access: "admin" },
  { method: "PATCH", path: "/api/admin/email-list/:key", access: "admin" },
  {
    method: "PATCH",
    path: "/api/admin/email-list/:key/status",
    access: "admin",
  },
  { method: "DELETE", path: "/api/admin/email-list/:key", access: "admin" },
  {
    method: "POST",
    path: "/api/admin/security/force-password-reset",
    access: "admin",
  },
  {
    method: "POST",
    path: "/api/admin/security/revoke-all-sessions",
    access: "admin",
  },
] as const;

function concretePath(path: string) {
  return path
    .replace(":userId", randomUUID())
    .replace(":id", randomUUID())
    .replace(":accountRowId", randomUUID())
    .replace(":sessionId", randomUUID())
    .replace(":key", "phase-zero-missing");
}

function requestBody(path: string) {
  if (path === "/api/uploads/") {
    return JSON.stringify({
      contentType: "image/png",
      filename: "avatar.png",
      key: "avatar",
      size: 10,
    });
  }
  if (path === "/api/account/two-factor/send-code") {
    return JSON.stringify({ action: "enable" });
  }
  if (
    path === "/api/account/admin-step-up/totp" ||
    path === "/api/account/two-factor/start-setup" ||
    path === "/api/account/two-factor/verify-setup" ||
    path === "/api/account/two-factor/disable"
  ) {
    return JSON.stringify({ code: "123456" });
  }
  if (
    path === "/api/account/confirm-email-change" ||
    path === "/api/account/approve-email-change"
  ) {
    return JSON.stringify({ token: "a".repeat(64) });
  }
  if (path === "/api/account/change-email") {
    return JSON.stringify({
      newEmail: `phase-zero-${randomUUID()}@example.com`,
    });
  }
  if (path === "/api/auth-actions/protected-route-verification-email") {
    return JSON.stringify({ callbackURL: "/admin" });
  }
  if (path === "/api/contact/") {
    return JSON.stringify({
      email: "phase-zero-contact@example.com",
      message: "A valid contact message.",
      name: "Phase Zero",
    });
  }
  if (path === "/api/credits/sample-create") {
    return JSON.stringify({
      idempotencyKey: `phase-zero-${randomUUID()}`,
      itemKey: "tiny-note",
    });
  }
  if (path === "/api/billing/checkout") {
    return JSON.stringify({ requestId: randomUUID(), type: "credit_top_up" });
  }
  if (path === "/api/email-list/") {
    return JSON.stringify({
      email: "phase-zero-list@example.com",
      listKey: "phase-zero-list",
    });
  }
  if (path === "/api/admin/email-list") {
    return JSON.stringify({
      key: `phase-zero-${randomUUID()}`,
      name: "Phase zero list",
    });
  }
  if (path === "/api/admin/email-list/:key") {
    return JSON.stringify({
      name: "Phase zero list",
    });
  }
  if (path === "/api/admin/email-list/:key/status") {
    return JSON.stringify({ status: "active" });
  }
  if (path === "/api/admin/security/force-password-reset") {
    return JSON.stringify({ email: "phase-zero-reset@example.com" });
  }
  if (path === "/api/admin/users/:userId/credits/adjust") {
    return JSON.stringify({ amount: 1, reason: "Phase zero adjustment" });
  }
  if (path === "/api/admin/invitations") {
    return JSON.stringify({
      email: `phase-zero-invite-${randomUUID()}@example.com`,
      role: "user",
    });
  }
  if (path === "/api/invitations/validate") {
    return JSON.stringify({ token: "a".repeat(64) });
  }
  if (path === "/api/invitations/accept-signup") {
    return JSON.stringify({
      agreeToTerms: true,
      email: "phase-zero-invite-accept@example.com",
      password: "TestPassword123!",
      token: "a".repeat(64),
    });
  }
  return "{}";
}

async function readFirstStreamChunk(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response did not include a readable body.");

  const { value } = await reader.read();
  await reader.cancel();

  if (typeof value === "string") {
    return value;
  }

  return new TextDecoder().decode(value);
}

describe("current Elysia HTTP contract", () => {
  it("keeps the composed method and path inventory", () => {
    const expected = [
      "ALL /api/auth/*",
      "GET /api/",
      "GET /api/health",
      "GET /api/account/",
      "GET /api/account/data-export",
      "GET /api/account/google-account",
      "GET /api/account/notifications",
      "GET /api/account/notifications/events",
      "GET /api/account/notifications/unread-count",
      "GET /api/account/confirm-email-change",
      "GET /api/account/approve-email-change",
      "GET /api/credits/balance",
      "GET /api/email-list/verify",
      "GET /api/admin/",
      "GET /api/admin/invitations",
      "GET /api/admin/metrics",
      "POST /api/account/data-export",
      "POST /api/account/deletion",
      "POST /api/admin/schedules/trigger",
      ...mutationRoutes.map(({ method, path }) => `${method} ${path}`),
    ].sort();
    expect(
      app.routes.map(({ method, path }) => `${method} ${path}`).sort(),
    ).toEqual(expected);
    expect(
      app.routes.map(({ method, path }) => `${method} ${path}`),
    ).not.toEqual(
      expect.arrayContaining([
        "POST /api/credits/spend",
        "POST /api/credits/adjust",
      ]),
    );
  });

  it("guards all 35 mutations with the current origin response", async () => {
    expect(mutationRoutes).toHaveLength(35);
    const user = await createTestActor();
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const sentBefore = testEmailOutbox.length;

    for (const route of mutationRoutes) {
      const cookie =
        route.access === "admin"
          ? admin.cookie
          : route.access === "user"
            ? user.cookie
            : undefined;
      const response = await httpRequest(app, concretePath(route.path), {
        method: route.method,
        cookie,
        headers: { ...jsonHeaders, origin: "https://evil.example" },
        ...(route.method === "DELETE" ? {} : { body: requestBody(route.path) }),
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(403);
      expect(await response.json(), `${route.method} ${route.path}`).toEqual({
        message: "Invalid request origin.",
      });
    }

    expect(await db.select().from(contactSubmission)).toHaveLength(0);
    expect(await db.select().from(emailList)).toHaveLength(0);
    expect(await db.select().from(invitation)).toHaveLength(0);
    expect(await db.select().from(verification)).toHaveLength(0);
    expect(testEmailOutbox).toHaveLength(sentBefore);
  });

  it.each([
    {
      name: "matching Origin",
      headers: { origin: trustedOrigin },
      status: 400,
    },
    {
      name: "trusted Referer",
      headers: { referer: `${trustedOrigin}/form` },
      status: 400,
    },
    {
      name: "wrong Origin overrides Referer",
      headers: {
        origin: "https://evil.example",
        referer: `${trustedOrigin}/form`,
      },
      status: 403,
    },
    {
      name: "malformed Referer",
      headers: { referer: "not a URL" },
      status: 403,
    },
    { name: "missing both", headers: {}, status: 403 },
    {
      name: "different scheme",
      headers: { origin: "https://localhost:3000" },
      status: 403,
    },
    {
      name: "different host",
      headers: { origin: "http://127.0.0.1:3000" },
      status: 403,
    },
    {
      name: "different port",
      headers: { origin: "http://localhost:3001" },
      status: 403,
    },
  ])("preserves $name origin semantics", async ({ headers, status }) => {
    const body =
      status === 403 ? requestBody("/api/contact/") : JSON.stringify({});
    const response = await httpRequest(app, "/api/contact/", {
      method: "POST",
      headers: { ...jsonHeaders, ...headers } as Record<string, string>,
      body,
    });
    expect(response.status).toBe(status);
    if (status === 403) {
      expect(await response.json()).toEqual({
        message: "Invalid request origin.",
      });
    }
    expect(await db.select().from(contactSubmission)).toHaveLength(0);
  });

  it("leaves verification redirects outside the origin policy", async () => {
    for (const path of [
      "/api/account/confirm-email-change",
      "/api/account/approve-email-change",
      "/api/email-list/verify",
    ]) {
      const response = await httpRequest(app, path);
      expect(response.status, path).toBe(302);
      expect(response.headers.get("location"), path).toContain("invalid");
    }
  });

  it("does not create an email list after origin or validation rejection", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const key = "phase-zero-list";
    for (const headers of [
      { ...jsonHeaders, origin: "https://evil.example" },
      { ...jsonHeaders, origin: trustedOrigin },
    ]) {
      const invalidBody = headers.origin === trustedOrigin;
      const response = await httpRequest(app, "/api/admin/email-list", {
        method: "POST",
        cookie: admin.cookie,
        headers,
        body: JSON.stringify({
          key,
          name: invalidBody ? "x" : "Phase zero list",
        }),
      });
      expect(response.status).toBe(
        headers.origin === trustedOrigin ? 400 : 403,
      );
    }
    expect(
      await db.select().from(emailList).where(eq(emailList.key, key)),
    ).toHaveLength(0);
  });

  it("preserves auth-before-origin precedence on protected mutations", async () => {
    for (const route of mutationRoutes.filter(
      ({ access }) => access !== "public",
    )) {
      const response = await httpRequest(app, concretePath(route.path), {
        method: route.method,
        headers: { ...jsonHeaders, origin: "https://evil.example" },
        ...(route.method === "DELETE" ? {} : { body: requestBody(route.path) }),
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(
        route.access === "admin" ? 404 : 401,
      );
    }
  });

  it("blocks unverified admins on every admin mutation before handler work", async () => {
    const actor = await createTestActor({
      role: "admin",
      emailVerified: false,
    });
    const sentBefore = testEmailOutbox.length;
    for (const route of mutationRoutes.filter(
      ({ access }) => access === "admin",
    )) {
      const response = await httpRequest(app, concretePath(route.path), {
        method: route.method,
        cookie: actor.cookie,
        headers: { ...jsonHeaders, origin: trustedOrigin },
        ...(route.method === "DELETE" ? {} : { body: requestBody(route.path) }),
      });
      expect(response.status, `${route.method} ${route.path}`).toBe(403);
      expect(await response.json()).toEqual({
        message: "Email verification required",
      });
    }
    expect(await db.select().from(emailList)).toHaveLength(0);
    expect(await db.select().from(invitation)).toHaveLength(0);
    expect(testEmailOutbox).toHaveLength(sentBefore);
  });

  it("validates an upload body before its in-handler origin check", async () => {
    const actor = await createTestActor();
    const response = await httpRequest(app, "/api/uploads/", {
      method: "POST",
      cookie: actor.cookie,
      headers: { ...jsonHeaders, origin: "https://evil.example" },
      body: JSON.stringify({
        contentType: "image/png",
        filename: "",
        key: "avatar",
        size: 10,
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: "Filename is required.",
    });
  });

  it("returns a JSON 404 for an unmatched API path", async () => {
    const response = await httpRequest(app, "/api/phase-one-missing");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({ message: "Not Found" });
  });

  it("rejects unauthenticated notification SSE requests", async () => {
    const response = await httpRequest(
      app,
      "/api/account/notifications/events",
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: "Unauthorized" });
  });

  it("starts authenticated notification SSE with the connected event", async () => {
    const actor = await createTestActor();
    const response = await httpRequest(
      app,
      "/api/account/notifications/events",
      {
        cookie: actor.cookie,
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const chunk = await readFirstStreamChunk(response);
    expect(chunk).toContain(
      `event: ${notificationRealtimeEventNames.connected}`,
    );
    expect(chunk).toContain(`retry: ${notificationRealtimeRetryMs}`);
    expect(chunk).toContain('data: {"unreadCount":0}');
  });

  it("creates a realtime test notification for the authenticated owner", async () => {
    resetNotificationRealtimeBrokerForTests();
    const actor = await createTestActor();
    const subscription = subscribe(actor.id);

    const response = await httpRequest(app, "/api/account/notifications/test", {
      cookie: actor.cookie,
      headers: { origin: trustedOrigin },
      method: "POST",
    });

    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({
      notification: {
        recipientId: actor.id,
        type: "security.account_alert",
      },
    });
    expect(await subscription.next()).toMatchObject({
      data: {
        notification: {
          recipientId: actor.id,
          type: "security.account_alert",
        },
        unreadCount: 1,
      },
      event: notificationRealtimeEventNames.created,
    });
    subscription.close();
  });

  it.each([
    {
      path: "/api/contact/",
      body: {
        name: "x",
        email: "valid@example.com",
        message: "A valid message.",
      },
      message: "Name must be at least 2 characters.",
      access: "public",
    },
    {
      path: "/api/email-list/",
      body: { email: "valid@example.com", listKey: "x" },
      message: "List key must be at least 2 characters.",
      access: "public",
    },
    {
      path: "/api/account/two-factor/start-setup",
      body: { code: "" },
      message: "Too small: expected string to have >=1 characters",
      access: "user",
    },
    {
      path: "/api/account/confirm-email-change",
      body: { token: "" },
      message: "Email change token is required.",
      access: "public",
    },
    {
      path: "/api/auth-actions/protected-route-verification-email",
      body: { callbackURL: null },
      message: "Invalid verification request.",
      access: "user",
    },
    {
      path: "/api/admin/email-list",
      body: { key: "phase-zero", name: "x" },
      message: "Name must be at least 2 characters.",
      access: "admin",
    },
  ] as const)(
    "preserves first validation message at $path",
    async ({ path, body, message, access }) => {
      const actor =
        access === "public"
          ? null
          : await createTestActor({
              role: access === "admin" ? "admin" : "user",
              emailVerified: access === "admin",
            });
      const response = await httpRequest(app, path, {
        method: "POST",
        cookie: actor?.cookie,
        headers: { ...jsonHeaders, origin: trustedOrigin },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ message });
    },
  );

  it.each([
    { path: "/api/contact/", access: "public" },
    { path: "/api/email-list/", access: "public" },
    { path: "/api/account/two-factor/send-code", access: "user" },
    { path: "/api/admin/email-list", access: "admin" },
  ] as const)(
    "handles malformed JSON and text bodies at $path",
    async ({ path, access }) => {
      const actor =
        access === "public"
          ? null
          : await createTestActor({
              role: access === "admin" ? "admin" : "user",
              emailVerified: access === "admin",
            });
      for (const [contentType, body] of [
        ["application/json", "{"],
        ["text/plain", "not json"],
      ]) {
        const response = await httpRequest(app, path, {
          method: "POST",
          cookie: actor?.cookie,
          headers: { "content-type": contentType, origin: trustedOrigin },
          body,
        });
        expect(response.status, `${path} ${contentType}`).toBe(400);
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        expect(await response.json()).toEqual({
          message:
            contentType === "application/json" &&
            path !== "/api/admin/email-list"
              ? "Invalid request body."
              : expect.any(String),
        });
      }
    },
  );

  it.each([
    { value: false, expected: false },
    { value: true, expected: true },
    { value: undefined, expected: false },
  ])(
    "records strict admin-list boolean acceptance for $value",
    async ({ value, expected }) => {
      const admin = await createTestActor({
        role: "admin",
        emailVerified: true,
      });
      const key = `phase-zero-${randomUUID()}`;
      const response = await httpRequest(app, "/api/admin/email-list", {
        method: "POST",
        cookie: admin.cookie,
        headers: { ...jsonHeaders, origin: trustedOrigin },
        body: JSON.stringify({
          key,
          name: "Phase zero list",
          ...(value === undefined ? {} : { emailVerificationRequired: value }),
        }),
      });
      expect(response.status, await response.clone().text()).toBe(200);
      const [list] = await db
        .select()
        .from(emailList)
        .where(eq(emailList.key, key));
      expect(list?.emailVerificationRequired).toBe(expected);
    },
  );

  it.each(["false", "0", null])(
    "rejects misleading admin-list boolean value $value",
    async (value) => {
      const admin = await createTestActor({
        role: "admin",
        emailVerified: true,
      });
      const key = `phase-zero-${randomUUID()}`;
      const response = await httpRequest(app, "/api/admin/email-list", {
        method: "POST",
        cookie: admin.cookie,
        headers: { ...jsonHeaders, origin: trustedOrigin },
        body: JSON.stringify({
          emailVerificationRequired: value,
          key,
          name: "Phase zero list",
        }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: expect.stringContaining("expected boolean"),
      });
      expect(
        await db.select().from(emailList).where(eq(emailList.key, key)),
      ).toHaveLength(0);
    },
  );
});
