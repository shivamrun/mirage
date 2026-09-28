import { randomUUID } from "node:crypto";

import { createClient } from "redis";
import { beforeAll, describe, expect, it } from "vitest";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const runRedisContract =
  process.env.REDIS_NOTIFICATIONS_CONTRACT_TEST === "1" ||
  Boolean(process.env.REDIS_URL);

let redisAvailable = false;

beforeAll(async () => {
  if (!runRedisContract) {
    return;
  }

  const client = createClient({
    socket: {
      connectTimeout: 500,
      reconnectStrategy: false,
    },
    url: redisUrl,
  });

  client.on("error", () => {
    // Availability is reported through redisAvailable.
  });

  try {
    await client.connect();
    await client.ping();
    redisAvailable = true;
  } catch {
    redisAvailable = false;
  } finally {
    if (client.isOpen) {
      await client.close();
    }
  }
});

describe("Redis notification pub/sub", () => {
  it("delivers a broker event through Redis when available", async (context) => {
    if (!redisAvailable) {
      context.skip();
    }

    process.env.REDIS_URL = redisUrl;
    const { publish, resetNotificationRealtimeBrokerForTests, subscribe } =
      await import("@/server/db/services/notifications/realtime-broker");
    const recipientId = `test:${randomUUID()}`;
    const subscription = subscribe(recipientId);

    try {
      const waiter = subscription.next();
      const publishTimer = setInterval(() => {
        publish(recipientId, {
          data: { unreadCount: 7 },
          event: "notifications.unread_count_changed",
        });
      }, 50);

      try {
        await expect(waiter).resolves.toEqual({
          data: { unreadCount: 7 },
          event: "notifications.unread_count_changed",
        });
      } finally {
        clearInterval(publishTimer);
      }
    } finally {
      subscription.close();
      resetNotificationRealtimeBrokerForTests();
    }
  });
});
