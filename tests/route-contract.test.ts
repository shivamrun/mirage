import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import { contactSubmission, emailList, verification } from "@/server/db/schema";
import { app } from "@/server/routes";
import { createTestActor } from "./infra/admin-actor";
import { testEmailOutbox } from "./infra/email-fake";
import { httpRequest } from "./infra/http-request";

const trustedOrigin = "http://localhost:3000";
const jsonHeaders = { "content-type": "application/json" };

const mutationRoutes = [
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
    path: "/api/account/resend-email-change-verification",
    access: "user",
  },
  {
    method: "POST",
    path: "/api/auth-actions/protected-route-verification-email",
    access: "user",
  },
  { method: "POST", path: "/api/contact/", access: "public" },
  { method: "POST", path: "/api/email-list/", access: "public" },
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
  return "{}";
}

describe("current Elysia HTTP contract", () => {
  it("keeps the composed method and path inventory", () => {
    const expected = [
      "GET /api/",
      "GET /api/health",
      "GET /api/account/",
      "GET /api/account/google-account",
      "GET /api/account/confirm-email-change",
      "GET /api/account/approve-email-change",
      "GET /api/email-list/verify",
      "GET /api/admin/",
      ...mutationRoutes.map(({ method, path }) => `${method} ${path}`),
    ].sort();
    expect(
      app.routes.map(({ method, path }) => `${method} ${path}`).sort(),
    ).toEqual(expected);
  });

  it("guards all 22 mutations with the current origin response", async () => {
    expect(mutationRoutes).toHaveLength(22);
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
    const response = await httpRequest(app, "/api/contact/", {
      method: "POST",
      headers: { ...jsonHeaders, ...headers } as Record<string, string>,
      body: "{}",
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
      const response = await httpRequest(app, "/api/admin/email-list", {
        method: "POST",
        cookie: admin.cookie,
        headers,
        body: JSON.stringify({ key, name: "x" }),
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
    expect(testEmailOutbox).toHaveLength(sentBefore);
  });

  it("validates an upload body before its in-handler origin check", async () => {
    const actor = await createTestActor();
    const response = await httpRequest(app, "/api/uploads/", {
      method: "POST",
      cookie: actor.cookie,
      headers: { ...jsonHeaders, origin: "https://evil.example" },
      body: "{}",
    });
    expect(response.status).toBe(422);
    expect(await response.text()).not.toContain("Invalid request origin.");
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
    "records malformed JSON and text bodies at $path",
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
        if (
          contentType === "application/json" &&
          path !== "/api/admin/email-list"
        ) {
          expect(response.headers.get("content-type")).toContain("text/plain");
          expect(await response.text()).toBe("Bad Request");
        } else {
          expect(response.headers.get("content-type")).toContain(
            "application/json",
          );
          expect(await response.json()).toEqual({
            message: expect.any(String),
          });
        }
      }
    },
  );

  it.each([
    { value: false, expected: false },
    { value: true, expected: true },
    { value: "false", expected: true },
    { value: "0", expected: true },
    { value: null, expected: false },
    { value: undefined, expected: false },
  ])(
    "records current admin-list boolean coercion for $value",
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
});
