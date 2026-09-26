import { databaseRateLimitStore } from "@/adapters/rate-limit/stores/database";
import { redisRateLimitStore } from "@/adapters/rate-limit/stores/redis";
import type { RateLimitStore } from "@/adapters/rate-limit/types";
import {
  isRedisConfigured,
  RedisUnavailableError,
} from "@/adapters/redis/client";

const REDIS_FAILURE_COOLDOWN_MS = 5_000;
const REDIS_FALLBACK_LOG_INTERVAL_MS = 60_000;

let redisCooldownUntil = 0;
let lastRedisFallbackLogAt = 0;

function shouldTryRedis() {
  return isRedisConfigured() && Date.now() >= redisCooldownUntil;
}

function markRedisUnavailable(error: unknown) {
  redisCooldownUntil = Date.now() + REDIS_FAILURE_COOLDOWN_MS;

  const now = Date.now();
  if (now - lastRedisFallbackLogAt < REDIS_FALLBACK_LOG_INTERVAL_MS) {
    return;
  }

  lastRedisFallbackLogAt = now;
  const cause =
    error instanceof RedisUnavailableError && error.cause instanceof Error
      ? error.cause.message
      : error instanceof Error
        ? error.message
        : "unknown Redis failure";

  console.warn("Redis rate limiting unavailable; falling back to database.", {
    cause,
    cooldownMs: REDIS_FAILURE_COOLDOWN_MS,
  });
}

export const rateLimitStore: RateLimitStore = {
  async consumePolicy(buckets) {
    if (!shouldTryRedis()) {
      return databaseRateLimitStore.consumePolicy(buckets);
    }

    try {
      return await redisRateLimitStore.consumePolicy(buckets);
    } catch (error) {
      markRedisUnavailable(error);
      return databaseRateLimitStore.consumePolicy(buckets);
    }
  },

  async pruneExpired(limit) {
    if (!shouldTryRedis()) {
      return databaseRateLimitStore.pruneExpired(limit);
    }

    try {
      return await redisRateLimitStore.pruneExpired(limit);
    } catch (error) {
      markRedisUnavailable(error);
      return databaseRateLimitStore.pruneExpired(limit);
    }
  },
};
