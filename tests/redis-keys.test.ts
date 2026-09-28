import { describe, expect, it } from "vitest";
import {
  redisCacheGenerationKey,
  redisCacheKey,
  redisIdempotencyKey,
  redisLockKey,
  redisNotificationChannel,
  redisRateLimitFixedWindowKey,
  redisRateLimitHashTag,
  redisTempKey,
} from "@/adapters/redis/keys";

describe("Redis key helpers", () => {
  it("builds domain-versioned keys from one normalized prefix", () => {
    expect(redisCacheKey("email-list", 1, ["summary"], "mirage:test:")).toMatch(
      /^mirage:test:cache:email-list:v1:[a-f0-9]{64}$/,
    );
    expect(
      redisCacheGenerationKey("user-posts", 1, ["user-1"], "mirage:test"),
    ).toMatch(/^mirage:test:cache-generation:user-posts:v1:[a-f0-9]{64}$/);
    expect(redisTempKey("email-change", 2, ["token"], "mirage:test")).toMatch(
      /^mirage:test:temp:email-change:v2:[a-f0-9]{64}$/,
    );
    expect(redisLockKey("stripe", 1, ["session"], "mirage:test")).toMatch(
      /^mirage:test:lock:stripe:v1:[a-f0-9]{64}$/,
    );
    expect(
      redisIdempotencyKey("stripe", 1, ["checkout"], "mirage:test"),
    ).toMatch(/^mirage:test:idempotency:stripe:v1:[a-f0-9]{64}$/);
    expect(redisNotificationChannel("user-1", "mirage:test")).toMatch(
      /^mirage:test:pubsub:notifications:v1:[a-f0-9]{64}$/,
    );
  });

  it("hashes user-controlled key parts", () => {
    const email = "person@example.com";
    const key = redisCacheKey("contact", 1, [email], "mirage:test");
    const channel = redisNotificationChannel(email, "mirage:test");

    expect(key).not.toContain(email);
    expect(channel).not.toContain(email);
    expect(key).not.toContain("mirage:mirage");
  });

  it("uses one cluster hash tag for fixed-window rate-limit keys", () => {
    const prefix = "mirage:production";
    const first = redisRateLimitFixedWindowKey({
      identifierHash: "identifier-one",
      prefix,
      scope: "public:contact:destination",
    });
    const second = redisRateLimitFixedWindowKey({
      identifierHash: "identifier-two",
      prefix,
      scope: "public:contact:global",
    });

    expect(first).toMatch(
      /^\{mirage:production:ratelimit\}:fixed:v1:[a-f0-9]{64}:[a-f0-9]{64}$/,
    );
    expect(first.slice(0, first.indexOf("}") + 1)).toBe(
      redisRateLimitHashTag(prefix),
    );
    expect(second.slice(0, second.indexOf("}") + 1)).toBe(
      redisRateLimitHashTag(prefix),
    );
  });
});
