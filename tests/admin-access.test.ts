import { node } from "@elysia/node";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import {
  GET as authGet,
  POST as authPost,
} from "@/app/(backend)/api/auth/[...all]/route";
import db from "@/server/db";
import { emailList, session, user } from "@/server/db/schema";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";
import { setTestEmailDeliveryHook, testEmailOutbox } from "./infra/email-fake";

const origin = "http://localhost:3000";
const app = new Elysia({ adapter: node(), prefix: "/api" }).use(adminRoutes);

describe("admin HTTP access", () => {
  it("revokes target sessions before a failed password-reset dispatch", async () => {
    const target = await createTestActor();
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const before = await db
      .select()
      .from(session)
      .where(eq(session.userId, target.id));
    expect(before.length).toBeGreaterThan(0);
    const sentBefore = testEmailOutbox.length;
    let markAttempted: () => void = () => undefined;
    const attempted = new Promise<void>((resolve) => {
      markAttempted = resolve;
    });
    setTestEmailDeliveryHook(async ({ to }) => {
      if (to === target.email) {
        markAttempted();
        throw new Error("Test reset delivery failure");
      }
    });

    const response = await app.fetch(
      new Request(`${origin}/api/admin/security/force-password-reset`, {
        method: "POST",
        headers: {
          cookie: admin.cookie,
          "content-type": "application/json",
          origin,
        },
        body: JSON.stringify({ email: target.email }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: true,
      revokedSessions: before.length,
    });
    await attempted;
    expect(
      await db.select().from(session).where(eq(session.userId, target.id)),
    ).toHaveLength(0);
    expect(testEmailOutbox).toHaveLength(sentBefore);
  });

  it.each([
    { actor: "visitor", expectedCustom: 404, expectedAuth: 401 },
    { actor: "user", expectedCustom: 404, expectedAuth: 403 },
    { actor: "unverified admin", expectedCustom: 403, expectedAuth: 403 },
    { actor: "verified admin", expectedCustom: 200, expectedAuth: 200 },
  ] as const)(
    "enforces access for $actor",
    async ({ actor, expectedCustom, expectedAuth }) => {
      const target = await createTestActor();
      const current =
        actor === "visitor"
          ? null
          : await createTestActor({
              role: actor === "user" ? "user" : "admin",
              emailVerified: actor === "verified admin",
            });
      const headers: Record<string, string> = current
        ? { cookie: current.cookie }
        : {};
      const listKey = `test-${actor.replaceAll(" ", "-")}`;

      const customRead = await app.fetch(
        new Request(`${origin}/api/admin/`, { headers }),
      );
      expect(customRead.status).toBe(expectedCustom);

      const customMutation = await app.fetch(
        new Request(`${origin}/api/admin/email-list`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json", origin },
          body: JSON.stringify({ key: listKey, name: "Test list" }),
        }),
      );
      expect(customMutation.status).toBe(expectedCustom);
      const lists = await db
        .select()
        .from(emailList)
        .where(eq(emailList.key, listKey));
      expect(lists).toHaveLength(actor === "verified admin" ? 1 : 0);

      const authRead = await authGet(
        new Request(`${origin}/api/auth/admin/list-users`, { headers }),
      );
      expect(authRead.status).toBe(expectedAuth);

      const authMutation = await authPost(
        new Request(`${origin}/api/auth/admin/set-role`, {
          method: "POST",
          headers: { ...headers, "content-type": "application/json", origin },
          body: JSON.stringify({ userId: target.id, role: "admin" }),
        }),
      );
      expect(authMutation.status).toBe(expectedAuth);
      const [updatedTarget] = await db
        .select()
        .from(user)
        .where(eq(user.id, target.id));
      expect(updatedTarget?.role).toBe(
        actor === "verified admin" ? "admin" : "user",
      );
    },
  );
});
