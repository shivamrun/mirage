import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";

import db from "@/server/db";
import { account, session } from "@/server/db/schema";
import { adminRoutes } from "@/server/routes/admin";
import { createTestActor } from "./infra/admin-actor";

const origin = "http://localhost:3000";
const app = new Elysia({ prefix: "/api" }).use(adminRoutes);

async function remove(path: string, cookie: string) {
  return app.fetch(
    new Request(`${origin}/api/admin${path}`, {
      method: "DELETE",
      headers: { cookie, origin },
    }),
  );
}

describe("admin account and session deletion", () => {
  it("does not delete another user's account or session when IDs are paired", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const first = await createTestActor();
    const second = await createTestActor();
    const [otherAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, second.id));
    const [otherSession] = await db
      .select()
      .from(session)
      .where(eq(session.userId, second.id));

    expect(
      (
        await remove(
          `/users/${first.id}/accounts/${otherAccount.id}`,
          admin.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await remove(
          `/users/${first.id}/sessions/${otherSession.id}`,
          admin.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      await db.select().from(account).where(eq(account.id, otherAccount.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(session).where(eq(session.id, otherSession.id)),
    ).toHaveLength(1);
  });

  it("rejects unlinking password credentials and reports missing rows", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const target = await createTestActor();
    const [credential] = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, target.id),
          eq(account.providerId, "credential"),
        ),
      );
    expect(credential).toBeDefined();

    expect(
      (
        await remove(
          `/users/${target.id}/accounts/${credential.id}`,
          admin.cookie,
        )
      ).status,
    ).toBe(400);
    expect(
      await db.select().from(account).where(eq(account.id, credential.id)),
    ).toHaveLength(1);
    expect(
      (
        await remove(
          `/users/${target.id}/accounts/${randomUUID()}`,
          admin.cookie,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await remove(
          `/users/${target.id}/sessions/${randomUUID()}`,
          admin.cookie,
        )
      ).status,
    ).toBe(404);
  });

  it("deletes a matching linked account and session", async () => {
    const admin = await createTestActor({ role: "admin", emailVerified: true });
    const target = await createTestActor();
    const linkedId = randomUUID();
    await db.insert(account).values({
      id: linkedId,
      accountId: "linked-google-account",
      providerId: "google",
      userId: target.id,
    });
    const [targetSession] = await db
      .select()
      .from(session)
      .where(eq(session.userId, target.id));

    expect(
      (await remove(`/users/${target.id}/accounts/${linkedId}`, admin.cookie))
        .status,
    ).toBe(200);
    expect(
      (
        await remove(
          `/users/${target.id}/sessions/${targetSession.id}`,
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      await db.select().from(account).where(eq(account.id, linkedId)),
    ).toHaveLength(0);
    expect(
      await db.select().from(session).where(eq(session.id, targetSession.id)),
    ).toHaveLength(0);
  });
});
