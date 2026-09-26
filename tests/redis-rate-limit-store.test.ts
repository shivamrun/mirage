import { randomUUID } from "node:crypto";

import { createClient } from "redis";
import { beforeAll, describe, expect, it } from "vitest";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const runRedisContract =
  process.env.REDIS_RATE_LIMIT_CONTRACT_TEST === "1" ||
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

describe("Redis rate-limit store", () => {
  it("preserves fixed-window no-partial-spend semantics", async (context) => {
    if (!redisAvailable) {
      context.skip();
    }

    process.env.REDIS_URL = redisUrl;
    const { redisRateLimitStore } = await import(
      "@/adapters/rate-limit/stores/redis"
    );
    const scopePrefix = `test:${randomUUID()}`;
    const constrained = {
      identifierHash: `${scopePrefix}:limited`,
      limit: 1,
      scope: `${scopePrefix}:constrained`,
      windowMs: 30_000,
    };
    const shared = {
      identifierHash: `${scopePrefix}:shared`,
      limit: 10,
      scope: `${scopePrefix}:shared`,
      windowMs: 30_000,
    };

    expect(await redisRateLimitStore.consumePolicy([constrained])).toEqual({
      allowed: true,
    });

    const blocked = await redisRateLimitStore.consumePolicy([
      constrained,
      shared,
    ]);
    expect(blocked.allowed).toBe(false);

    expect(await redisRateLimitStore.consumePolicy([shared])).toEqual({
      allowed: true,
    });
  });
});
