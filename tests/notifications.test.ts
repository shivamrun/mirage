import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  notificationsPageHref,
  parseNotificationsSearchParams,
} from "@/features/notifications/query/notifications-query";
import { getNotificationDefinition } from "@/features/notifications/registry/registry";
import db from "@/server/db";
import { notification, user } from "@/server/db/schema";
import {
  getUnreadNotificationCount,
  listNotificationsView,
  markUserNotificationRead,
  markUserNotificationsRead,
  markUserNotificationUnread,
  notify,
} from "@/server/db/services/notifications/service";

async function createUser(name: string) {
  const id = randomUUID();

  await db.insert(user).values({
    email: `${id}@example.com`,
    emailVerified: true,
    id,
    name,
  });

  return id;
}

describe("notifications", () => {
  it("validates registry payloads and creates typed in-app notifications", async () => {
    const recipientId = await createUser("Recipient");
    const actorId = await createUser("Actor");

    expect(getNotificationDefinition("system.announcement").category).toBe(
      "system",
    );
    await expect(
      notify({
        data: { message: "", title: "" },
        recipientId,
        type: "system.announcement",
      }),
    ).rejects.toThrow();

    const created = await notify({
      actorId,
      data: {
        message: "Phase 1 is live.",
        title: "Notifications ready",
      },
      idempotencyKey: `system:${recipientId}`,
      recipientId,
      subject: {
        id: "phase-1",
        type: "release",
      },
      type: "system.announcement",
    });

    expect(created).toMatchObject({
      actorId,
      category: "system",
      recipientId,
      subjectId: "phase-1",
      subjectType: "release",
      type: "system.announcement",
    });
    expect(created.data).toEqual({
      message: "Phase 1 is live.",
      title: "Notifications ready",
    });
  });

  it("uses idempotency keys to avoid duplicate rows", async () => {
    const recipientId = await createUser("Recipient");
    const idempotencyKey = `low-credits:${recipientId}`;

    const [first, second] = await Promise.all([
      notify({
        data: { balance: 2, threshold: 5 },
        idempotencyKey,
        recipientId,
        type: "credits.low_balance",
      }),
      notify({
        data: { balance: 2, threshold: 5 },
        idempotencyKey,
        recipientId,
        type: "credits.low_balance",
      }),
    ]);

    expect(second.id).toBe(first.id);
    expect(await db.select().from(notification)).toHaveLength(1);
  });

  it("scopes reads, unread counts, and mutations to the recipient", async () => {
    const ownerId = await createUser("Owner");
    const otherId = await createUser("Other");
    const owned = await notify({
      data: { action: "New sign-in detected" },
      recipientId: ownerId,
      type: "security.account_alert",
    });
    await notify({
      data: { action: "Other sign-in detected" },
      recipientId: otherId,
      type: "security.account_alert",
    });

    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(1);
    expect(
      await markUserNotificationRead({
        id: owned.id,
        recipientId: otherId,
      }),
    ).toBeNull();
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(1);

    const read = await markUserNotificationRead({
      id: owned.id,
      recipientId: ownerId,
    });
    expect(read?.readAt).toBeInstanceOf(Date);
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(0);

    const unread = await markUserNotificationUnread({
      id: owned.id,
      recipientId: ownerId,
    });
    expect(unread?.readAt).toBeNull();
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(1);

    await markUserNotificationsRead({ recipientId: ownerId });
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(0);
    expect(await getUnreadNotificationCount({ recipientId: otherId })).toBe(1);
  });

  it("uses page/limit pagination with filtered counts and stable ordering", async () => {
    const recipientId = await createUser("Recipient");
    const otherId = await createUser("Other");
    const createdAt = new Date("2026-01-01T00:00:00.000Z");

    const rows = await Promise.all(
      Array.from({ length: 13 }, (_, index) =>
        notify({
          data: {
            message: `Message ${index}`,
            title: `Notice ${index}`,
          },
          recipientId,
          type: "system.announcement",
        }),
      ),
    );
    await notify({
      data: { message: "Not yours", title: "Hidden" },
      recipientId: otherId,
      type: "system.announcement",
    });
    await db
      .update(notification)
      .set({ createdAt })
      .where(eq(notification.recipientId, recipientId));

    const { page } = parseNotificationsSearchParams({ page: "2" });
    const result = await listNotificationsView({
      limit: 10,
      page,
      recipientId,
    });
    const expectedIds = rows.map((row) => row.id).sort();

    expect(result.total).toBe(13);
    expect(result.totalPages).toBe(2);
    expect(result.notifications.map((row) => row.id)).toEqual(
      expectedIds.slice(10),
    );
    expect(notificationsPageHref({ page: 1 })).toBe("/account/notifications");
    expect(notificationsPageHref({ page: 2 })).toBe(
      "/account/notifications?page=2",
    );
    expect(parseNotificationsSearchParams({ page: "bad" }).page).toBe(1);

    const emptyPage = await listNotificationsView({
      limit: 10,
      page: 99,
      recipientId,
    });
    expect(emptyPage.page).toBe(2);
    expect(emptyPage.notifications).toHaveLength(0);
  });
});
