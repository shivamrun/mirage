import "server-only";

import { type CachePolicyName, cachePolicies } from "@/adapters/cache/policies";
import { runRedisCommand } from "@/adapters/redis/client";
import { redisCacheGenerationKey, redisCacheKey } from "@/adapters/redis/keys";

type CacheKeyInput = {
  parts?: string[];
  policy: CachePolicyName;
};

type RedisCacheSetInput = CacheKeyInput & {
  value: string;
};

function keyFor({ parts = [], policy }: CacheKeyInput) {
  const cachePolicy = cachePolicies[policy];
  return redisCacheKey(policy, cachePolicy.version, parts);
}

function generationKeyFor({ parts = [], policy }: CacheKeyInput) {
  const cachePolicy = cachePolicies[policy];
  return redisCacheGenerationKey(policy, cachePolicy.version, parts);
}

export const redisCacheStore = {
  async delete(input: CacheKeyInput) {
    await runRedisCommand((client) => client.del(keyFor(input)));
  },

  async get<T = string>(input: CacheKeyInput): Promise<T | null> {
    const value = await runRedisCommand((client) => client.get(keyFor(input)));

    return value as T | null;
  },

  async incrementGeneration(input: CacheKeyInput) {
    return runRedisCommand((client) => client.incr(generationKeyFor(input)));
  },

  async set({ parts, policy, value }: RedisCacheSetInput) {
    const cachePolicy = cachePolicies[policy];

    await runRedisCommand((client) =>
      client.setEx(keyFor({ parts, policy }), cachePolicy.ttlSeconds, value),
    );
  },
};
