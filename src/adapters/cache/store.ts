import "server-only";

import { type CachePolicyName, cachePolicies } from "@/adapters/cache/policies";
import {
  type CacheValidator,
  deserializeCacheValue,
  serializeCacheValue,
} from "@/adapters/cache/serialization";
import { redisCacheStore } from "@/adapters/cache/stores/redis";
import {
  isRedisConfigured,
  RedisUnavailableError,
} from "@/adapters/redis/client";

const REDIS_FAILURE_COOLDOWN_MS = 5_000;
const REDIS_FALLBACK_LOG_INTERVAL_MS = 60_000;

let redisCooldownUntil = 0;
let lastRedisFallbackLogAt = 0;

type CacheKeyInput = {
  parts?: string[];
  policy: CachePolicyName;
};

type CacheSetInput<T> = CacheKeyInput & {
  value: T;
};

type CacheGetInput<T> = CacheKeyInput & {
  validator?: CacheValidator<T>;
};

type CacheGetOrSetInput<T> = CacheGetInput<T> & {
  load: () => Promise<T>;
};

export type CacheStore = {
  delete(input: CacheKeyInput): Promise<void>;
  get<T>(input: CacheGetInput<T>): Promise<T | null>;
  getGeneration(input: CacheKeyInput): Promise<number | null>;
  getOrSet<T>(input: CacheGetOrSetInput<T>): Promise<T>;
  incrementGeneration(input: CacheKeyInput): Promise<number | null>;
  set<T>(input: CacheSetInput<T>): Promise<void>;
};

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

  console.warn(
    "Redis cache unavailable; treating cache operations as misses.",
    {
      cause,
      cooldownMs: REDIS_FAILURE_COOLDOWN_MS,
    },
  );
}

export const cacheStore: CacheStore = {
  async delete(input) {
    if (!shouldTryRedis()) {
      return;
    }

    try {
      await redisCacheStore.delete(input);
    } catch (error) {
      markRedisUnavailable(error);
    }
  },

  async get({ parts, policy, validator }) {
    if (!shouldTryRedis()) {
      return null;
    }

    try {
      const value = await redisCacheStore.get<string>({ parts, policy });

      if (value == null) {
        return null;
      }

      return deserializeCacheValue(value, validator);
    } catch (error) {
      markRedisUnavailable(error);
      return null;
    }
  },

  async getOrSet({ load, parts, policy, validator }) {
    const cached = await this.get({ parts, policy, validator });

    if (cached != null) {
      return cached;
    }

    const value = await load();
    await this.set({ parts, policy, value });

    return value;
  },

  async getGeneration(input) {
    if (!shouldTryRedis()) {
      return null;
    }

    try {
      return await redisCacheStore.getGeneration(input);
    } catch (error) {
      markRedisUnavailable(error);
      return null;
    }
  },

  async incrementGeneration(input) {
    if (!shouldTryRedis()) {
      return null;
    }

    try {
      return await redisCacheStore.incrementGeneration(input);
    } catch (error) {
      markRedisUnavailable(error);
      return null;
    }
  },

  async set({ parts, policy, value }) {
    if (!shouldTryRedis()) {
      return;
    }

    try {
      await redisCacheStore.set({
        parts,
        policy,
        value: serializeCacheValue(value),
      });
    } catch (error) {
      markRedisUnavailable(error);
    }
  },
};

export function getCachePolicy(policy: CachePolicyName) {
  return cachePolicies[policy];
}
