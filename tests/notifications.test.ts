import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  notificationsPageHref,
  parseNotificationsSearchParams,
} from "@/features/notifications/query/notifications-query";
import { getNotificationDefinition } from "@/features/notifications/registry/registry";
import db from "@/server/db";
import { notification, user } from "@/server/db/schema";
import {
  getSubscriberCount,
  MAX_PENDING_EVENTS,
  publish,
  resetNotificationRealtimeBrokerForTests,
  subscribe,
} from "@/server/db/services/notifications/realtime-broker";
import {
  getUnreadNotificationCount,
  listNotificationsView,
  markUserNotificationRead,
  markUserNotificationsRead,
  markUserNotificationUnread,
  notify,
} from "@/server/db/services/notifications/service";
import {
  type NotificationRealtimeEvent,
  notificationRealtimeEventNames,
} from "@/shared/schemas/notifications";
import { testEmailOutbox } from "./infra/email-fake";

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

function expectNotificationRecord(
  value: Awaited<ReturnType<typeof notify>>["notification"],
) {
  expect(value).not.toBeNull();

  return value as NonNullable<typeof value>;
}

function realtimeEvent(
  event: (typeof notificationRealtimeEventNames)[keyof typeof notificationRealtimeEventNames] = notificationRealtimeEventNames.unreadCountChanged,
): NotificationRealtimeEvent {
  if (event === notificationRealtimeEventNames.resync) {
    return { data: {}, event };
  }
  if (event === notificationRealtimeEventNames.ping) {
    return { data: {}, event };
  }
  if (event === notificationRealtimeEventNames.connected) {
    return { data: { unreadCount: 1 }, event };
  }
  if (event === notificationRealtimeEventNames.created) {
    throw new Error("Use a real notification response for created events.");
  }
  return { data: { unreadCount: 1 }, event };
}

async function expectNoRealtimeEvent(
  subscription: ReturnType<typeof subscribe>,
) {
  const waiter = subscription.next();
  const marker = Symbol("no-event");
  const result = await Promise.race([
    waiter,
    new Promise<typeof marker>((resolve) => {
      setTimeout(() => resolve(marker), 10);
    }),
  ]);
  subscription.cancelNext();
  await waiter;
  expect(result).toBe(marker);
}

async function waitForMicrotasks() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

type MockRedisBrokerOptions = {
  configured?: boolean;
  publishSucceeds?: boolean;
};

async function importBrokerWithMockRedis({
  configured = true,
  publishSucceeds = true,
}: MockRedisBrokerOptions = {}) {
  vi.resetModules();

  const listeners = new Map<string, (message: string) => void>();
  const eventHandlers = new Map<string, () => void>();
  const published: { channel: string; payload: string }[] = [];
  const subscriberClient: {
    close: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    isOpen: boolean;
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = {
    close: vi.fn(async () => {
      subscriberClient.isOpen = false;
    }),
    connect: vi.fn(async () => {
      subscriberClient.isOpen = true;
      return subscriberClient;
    }),
    isOpen: false,
    on: vi.fn((event: string, listener: () => void) => {
      eventHandlers.set(event, listener);
      return subscriberClient;
    }),
    subscribe: vi.fn(
      async (channel: string, listener: (message: string) => void) => {
        listeners.set(channel, listener);
      },
    ),
    unsubscribe: vi.fn(async (channel: string) => {
      listeners.delete(channel);
    }),
  };
  const commandClient = {
    publish: vi.fn(async (channel: string, payload: string) => {
      if (!publishSucceeds) {
        throw new Error("Redis publish failed.");
      }

      published.push({ channel, payload });
      listeners.get(channel)?.(payload);
      return 1;
    }),
  };

  vi.doMock("redis", () => ({
    createClient: vi.fn(() => subscriberClient),
  }));
  vi.doMock("@/adapters/redis/client", () => ({
    isRedisConfigured: () => configured,
    RedisUnavailableError: class RedisUnavailableError extends Error {},
    runRedisCommand: vi.fn(
      async (command: (client: typeof commandClient) => Promise<unknown>) =>
        command(commandClient),
    ),
  }));

  const broker = await import(
    "@/server/db/services/notifications/realtime-broker"
  );

  return {
    broker,
    commandClient,
    eventHandlers,
    listeners,
    published,
    subscriberClient,
  };
}

beforeEach(() => {
  resetNotificationRealtimeBrokerForTests();
  vi.doUnmock("redis");
  vi.doUnmock("@/adapters/redis/client");
});

describe("notification realtime broker", () => {
  it("delivers matching-recipient events only", async () => {
    const owner = subscribe("owner");
    const other = subscribe("other");

    publish("owner", realtimeEvent());

    expect(await owner.next()).toEqual(realtimeEvent());
    await expectNoRealtimeEvent(other);
  });

  it("delivers to multiple subscribers for the same recipient", async () => {
    const first = subscribe("owner");
    const second = subscribe("owner");

    publish("owner", realtimeEvent());

    expect(await first.next()).toEqual(realtimeEvent());
    expect(await second.next()).toEqual(realtimeEvent());
  });

  it("removes disconnected subscribers on cleanup", () => {
    const subscription = subscribe("owner");

    expect(getSubscriberCount("owner")).toBe(1);
    subscription.close();
    expect(getSubscriberCount("owner")).toBe(0);
  });

  it("close removes the subscriber and cancels an active waiter", async () => {
    const subscription = subscribe("owner");
    const waiter = subscription.next();

    subscription.close();

    await expect(waiter).resolves.toBeNull();
    expect(getSubscriberCount("owner")).toBe(0);
    expect(subscription.getDebugState()).toEqual({
      closed: true,
      pendingEvents: 0,
      waiting: false,
    });
  });

  it("close is idempotent and clears waiter references", async () => {
    const subscription = subscribe("owner");
    const waiter = subscription.next();

    subscription.close();
    subscription.close();

    await expect(waiter).resolves.toBeNull();
    expect(subscription.getDebugState().waiting).toBe(false);
  });

  it("keeps the queue bounded and emits a resync event on overflow", async () => {
    const subscription = subscribe("owner");

    for (let index = 0; index <= MAX_PENDING_EVENTS; index += 1) {
      publish("owner", realtimeEvent());
    }

    expect(subscription.getDebugState().pendingEvents).toBe(1);
    expect(await subscription.next()).toEqual({
      data: {},
      event: notificationRealtimeEventNames.resync,
    });
  });

  it("does not retain stale waiters across heartbeat cancellations", async () => {
    const subscription = subscribe("owner");

    for (let index = 0; index < 3; index += 1) {
      const waiter = subscription.next();
      subscription.cancelNext();
      expect(await waiter).toBeNull();
    }

    const waiter = subscription.next();
    publish("owner", realtimeEvent());

    expect(await waiter).toEqual(realtimeEvent());
    expect(subscription.getDebugState()).toEqual({
      closed: false,
      pendingEvents: 0,
      waiting: false,
    });
  });
});

describe("notification realtime broker Redis pub/sub", () => {
  it("does not duplicate same-process delivery when Redis publish succeeds", async () => {
    const { broker, commandClient, subscriberClient } =
      await importBrokerWithMockRedis();
    const subscription = broker.subscribe("owner");
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(1);
    });

    broker.publish("owner", realtimeEvent());

    expect(await subscription.next()).toEqual(realtimeEvent());
    await expectNoRealtimeEvent(subscription);
    expect(commandClient.publish).toHaveBeenCalledTimes(1);
  });

  it("isolates recipients across Redis channels", async () => {
    const { broker, subscriberClient } = await importBrokerWithMockRedis();
    const owner = broker.subscribe("owner");
    const other = broker.subscribe("other");
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(2);
    });

    broker.publish("owner", realtimeEvent());

    expect(await owner.next()).toEqual(realtimeEvent());
    await expectNoRealtimeEvent(other);
  });

  it("turns malformed Redis payloads into resync events", async () => {
    const { broker, listeners, subscriberClient } =
      await importBrokerWithMockRedis();
    const subscription = broker.subscribe("owner");
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(1);
    });
    const [[channel]] = subscriberClient.subscribe.mock.calls;

    expect(() => listeners.get(channel)?.("{malformed-json")).not.toThrow();
    expect(await subscription.next()).toEqual({
      data: {},
      event: notificationRealtimeEventNames.resync,
    });
  });

  it("falls back to local fanout when Redis is disabled", async () => {
    const { broker, commandClient, subscriberClient } =
      await importBrokerWithMockRedis({ configured: false });
    const subscription = broker.subscribe("owner");

    broker.publish("owner", realtimeEvent());

    expect(await subscription.next()).toEqual(realtimeEvent());
    expect(subscriberClient.subscribe).not.toHaveBeenCalled();
    expect(commandClient.publish).not.toHaveBeenCalled();
  });

  it("falls back to local fanout when Redis publish fails", async () => {
    const { broker } = await importBrokerWithMockRedis({
      publishSucceeds: false,
    });
    const subscription = broker.subscribe("owner");

    broker.publish("owner", realtimeEvent());
    await waitForMicrotasks();

    expect(await subscription.next()).toEqual(realtimeEvent());
  });

  it("clears stale Redis subscription state after subscriber outages", async () => {
    const { broker, commandClient, eventHandlers, subscriberClient } =
      await importBrokerWithMockRedis();
    const subscription = broker.subscribe("owner");
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(1);
    });

    subscriberClient.isOpen = false;
    eventHandlers.get("end")?.();

    expect(await subscription.next()).toEqual({
      data: {},
      event: notificationRealtimeEventNames.resync,
    });

    broker.publish("owner", realtimeEvent());
    await waitForMicrotasks();

    expect(commandClient.publish).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(2);
    });
  });

  it("subscribes on the first local subscriber and unsubscribes on the last close", async () => {
    const { broker, subscriberClient } = await importBrokerWithMockRedis();
    const first = broker.subscribe("owner");
    const second = broker.subscribe("owner");
    await vi.waitFor(() => {
      expect(subscriberClient.subscribe).toHaveBeenCalledTimes(1);
    });

    first.close();
    await waitForMicrotasks();
    expect(subscriberClient.unsubscribe).not.toHaveBeenCalled();

    second.close();
    await vi.waitFor(() => {
      expect(subscriberClient.unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  it("reports local-process subscriber counts only", async () => {
    const { broker } = await importBrokerWithMockRedis();
    const first = broker.subscribe("owner");
    const second = broker.subscribe("owner");

    expect(broker.getSubscriberCount("owner")).toBe(2);

    first.close();
    expect(broker.getSubscriberCount("owner")).toBe(1);
    second.close();
    expect(broker.getSubscriberCount("owner")).toBe(0);
  });
});

describe("notifications", () => {
  it("validates registry payloads and creates typed in-app notifications", async () => {
    const recipientId = await createUser("Recipient");
    const actorId = await createUser("Actor");

    expect(getNotificationDefinition("security.account_alert").category).toBe(
      "security",
    );
    await expect(
      notify({
        data: { action: "" },
        recipientId,
        type: "security.account_alert",
      }),
    ).rejects.toThrow();

    const result = await notify({
      actorId,
      data: {
        action: "New sign-in detected",
        ipAddress: "127.0.0.1",
      },
      idempotencyKey: `security:${recipientId}`,
      recipientId,
      subject: {
        id: "sign-in",
        type: "security-event",
      },
      type: "security.account_alert",
    });
    const created = result.notification;

    expect(created).toMatchObject({
      actorId,
      category: "security",
      recipientId,
      subjectId: "sign-in",
      subjectType: "security-event",
      type: "security.account_alert",
    });
    expect(created?.data).toEqual({
      action: "New sign-in detected",
      ipAddress: "127.0.0.1",
    });
    expect(result.created).toBe(true);
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

    expect(second.notification?.id).toBe(first.notification?.id);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(await db.select().from(notification)).toHaveLength(1);
  });

  it("sends email-only notifications without creating in-app rows", async () => {
    const result = await notify({
      data: {
        email: "recipient@example.com",
        name: "Recipient",
        verificationUrl: "http://localhost:3000/verify",
      },
      type: "auth.email_verification",
    });

    expect(result.notification).toBeNull();
    expect(result.created).toBe(false);
    expect(result.deliveries.email).toMatchObject({
      id: "test-email-1",
      skipped: false,
    });
    expect(testEmailOutbox).toHaveLength(1);
    expect(testEmailOutbox[0]).toMatchObject({
      subject: "Verify your Mirage email",
      to: "recipient@example.com",
    });
    expect(await db.select().from(notification)).toHaveLength(0);
  });

  it("emits one created event for a fresh in-app notification", async () => {
    const recipientId = await createUser("Recipient");
    const subscription = subscribe(recipientId);

    const result = await notify({
      data: { action: "New sign-in detected" },
      recipientId,
      type: "security.account_alert",
    });
    const created = expectNotificationRecord(result.notification);

    expect(await subscription.next()).toMatchObject({
      data: {
        notification: {
          id: created.id,
          recipientId,
          type: "security.account_alert",
        },
        unreadCount: 1,
      },
      event: notificationRealtimeEventNames.created,
    });
  });

  it("does not emit duplicate created events on idempotency conflicts", async () => {
    const recipientId = await createUser("Recipient");
    const subscription = subscribe(recipientId);
    const idempotencyKey = `security:${recipientId}`;

    await notify({
      data: { action: "New sign-in detected" },
      idempotencyKey,
      recipientId,
      type: "security.account_alert",
    });
    expect(await subscription.next()).toMatchObject({
      event: notificationRealtimeEventNames.created,
    });

    await notify({
      data: { action: "New sign-in detected" },
      idempotencyKey,
      recipientId,
      type: "security.account_alert",
    });
    await expectNoRealtimeEvent(subscription);
  });

  it("emits read state changes only to the owner", async () => {
    const ownerId = await createUser("Owner");
    const otherId = await createUser("Other");
    const ownerSubscription = subscribe(ownerId);
    const otherSubscription = subscribe(otherId);
    const owned = await notify({
      data: { action: "New sign-in detected" },
      recipientId: ownerId,
      type: "security.account_alert",
    });
    const ownedNotification = expectNotificationRecord(owned.notification);
    await ownerSubscription.next();

    await markUserNotificationRead({
      id: ownedNotification.id,
      recipientId: otherId,
    });
    await expectNoRealtimeEvent(ownerSubscription);
    await expectNoRealtimeEvent(otherSubscription);

    await markUserNotificationRead({
      id: ownedNotification.id,
      recipientId: ownerId,
    });

    expect(await ownerSubscription.next()).toEqual({
      data: { unreadCount: 0 },
      event: notificationRealtimeEventNames.unreadCountChanged,
    });
    await expectNoRealtimeEvent(otherSubscription);
  });

  it("avoids realtime events for practical read state no-ops", async () => {
    const recipientId = await createUser("Recipient");
    const subscription = subscribe(recipientId);
    const result = await notify({
      data: { action: "New sign-in detected" },
      recipientId,
      type: "security.account_alert",
    });
    const created = expectNotificationRecord(result.notification);
    await subscription.next();

    await markUserNotificationUnread({ id: created.id, recipientId });
    await expectNoRealtimeEvent(subscription);

    await markUserNotificationRead({ id: created.id, recipientId });
    expect(await subscription.next()).toEqual({
      data: { unreadCount: 0 },
      event: notificationRealtimeEventNames.unreadCountChanged,
    });

    await markUserNotificationRead({ id: created.id, recipientId });
    await expectNoRealtimeEvent(subscription);

    await markUserNotificationsRead({ recipientId });
    await expectNoRealtimeEvent(subscription);
  });

  it("scopes reads, unread counts, and mutations to the recipient", async () => {
    const ownerId = await createUser("Owner");
    const otherId = await createUser("Other");
    const owned = await notify({
      data: { action: "New sign-in detected" },
      recipientId: ownerId,
      type: "security.account_alert",
    });
    const ownedNotification = expectNotificationRecord(owned.notification);
    await notify({
      data: { action: "Other sign-in detected" },
      recipientId: otherId,
      type: "security.account_alert",
    });

    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(1);
    expect(
      await markUserNotificationRead({
        id: ownedNotification.id,
        recipientId: otherId,
      }),
    ).toBeNull();
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(1);

    const read = await markUserNotificationRead({
      id: ownedNotification.id,
      recipientId: ownerId,
    });
    expect(read?.readAt).toBeInstanceOf(Date);
    expect(await getUnreadNotificationCount({ recipientId: ownerId })).toBe(0);

    const unread = await markUserNotificationUnread({
      id: ownedNotification.id,
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
            action: `Security event ${index}`,
          },
          recipientId,
          type: "security.account_alert",
        }),
      ),
    );
    await notify({
      data: { action: "Hidden security event" },
      recipientId: otherId,
      type: "security.account_alert",
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
    const expectedIds = rows
      .map((row) => expectNotificationRecord(row.notification).id)
      .sort();

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
