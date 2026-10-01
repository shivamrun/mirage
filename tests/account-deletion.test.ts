import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import db from "@/server/db";
import {
  account,
  accountDeletionRequests,
  session,
  user,
  userDataExports,
} from "@/server/db/schema";
import {
  requestUserDataExport,
  startAccountDeletion,
} from "@/server/db/services/account-deletion/lifecycle";
import { setJobEnqueueHandlerForTests } from "@/server/jobs/enqueue";
import { createTestActor } from "./infra/admin-actor";

afterEach(() => {
  setJobEnqueueHandlerForTests(null);
});

describe("account deletion lifecycle", () => {
  it("durably blocks access before asynchronous provider cleanup", async () => {
    const actor = await createTestActor();
    const jobs: { name: string; payload: unknown }[] = [];
    setJobEnqueueHandlerForTests(async (name, payload) => {
      jobs.push({ name, payload });
      return { id: `test-${jobs.length}` };
    });

    const result = await startAccountDeletion(actor.id);

    expect(result.deleted).toBe(true);
    expect(
      await db.select().from(session).where(eq(session.userId, actor.id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(account).where(eq(account.userId, actor.id)),
    ).not.toHaveLength(0);
    const [blockedUser] = await db
      .select({ banned: user.banned, banReason: user.banReason })
      .from(user)
      .where(eq(user.id, actor.id));
    expect(blockedUser).toEqual({
      banned: true,
      banReason: "Account deletion in progress",
    });
    const [deletion] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.userId, actor.id));
    expect(deletion?.cleanupPhase).toBe("sessions_and_grants");
    expect(jobs).toEqual([
      {
        name: "account.deletion.process.v1",
        payload: { deletionId: deletion?.id },
      },
    ]);
  });

  it("expires overdue exports before allowing a replacement request", async () => {
    const actor = await createTestActor();
    setJobEnqueueHandlerForTests(async () => ({ id: "test-export" }));
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
