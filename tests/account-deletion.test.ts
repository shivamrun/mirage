import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/adapters/uploads/storage", () => ({
  createStorageProfiles: () => ({
    s3: { deletePrefix: async () => undefined },
  }),
}));

import db from "@/server/db";
import {
  accountDeletionRequests,
  session,
  user,
  userDataExports,
} from "@/server/db/schema";
import {
  requestUserDataExport,
  startAccountDeletion,
} from "@/server/db/services/account-deletion/lifecycle";
import { createTestActor } from "./infra/admin-actor";

describe("account deletion lifecycle", () => {
  it("completes provider cleanup and removes access", async () => {
    const actor = await createTestActor();

    const result = await startAccountDeletion(actor.id);

    expect(result.deleted).toBe(true);
    if (!result.deleted) throw new Error("Account deletion did not start.");
    expect(
      await db.select().from(session).where(eq(session.userId, actor.id)),
    ).toHaveLength(0);
    const [deletion] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.id, result.auditId));
    expect(deletion).toMatchObject({ state: "completed", userId: null });
    expect(
      await db.select().from(user).where(eq(user.id, actor.id)),
    ).toHaveLength(0);
  });

  it("expires overdue exports before allowing a replacement request", async () => {
    const actor = await createTestActor();
    const [overdue] = await db
      .insert(userDataExports)
      .values({
        deliveryDueAt: new Date(Date.now() - 60_000),
        status: "failed",
        userId: actor.id,
      })
      .returning();

    const replacement = await requestUserDataExport(actor.id);

    expect(replacement.id).not.toBe(overdue.id);
    expect(replacement.status).toBe("pending");
    const [expired] = await db
      .select()
      .from(userDataExports)
      .where(eq(userDataExports.id, overdue.id));
    expect(expired).toMatchObject({
      failureKind: "DeliveryWindowExpired",
      status: "expired",
    });
  });
});
