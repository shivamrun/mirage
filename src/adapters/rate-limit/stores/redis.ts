import type {
  RateLimitBucket,
  RateLimitResult,
  RateLimitStore,
} from "@/adapters/rate-limit/types";
import { runRedisCommand } from "@/adapters/redis/client";
import { redisRateLimitFixedWindowKey } from "@/adapters/redis/keys";

const consumeFixedWindowScript = `
local bucket_count = #KEYS
local retry_after_seconds = 1

for index = 1, bucket_count do
  local key = KEYS[index]
  local limit = tonumber(ARGV[((index - 1) * 2) + 1])
  local window_ms = tonumber(ARGV[((index - 1) * 2) + 2])
  local count = tonumber(redis.call("GET", key) or "0")
  local ttl_ms = redis.call("PTTL", key)

  if ttl_ms < 0 then
    count = 0
    ttl_ms = window_ms
  end

  if count >= limit then
    retry_after_seconds = math.max(1, math.ceil(ttl_ms / 1000))
    return { 0, retry_after_seconds }
  end
end

for index = 1, bucket_count do
  local key = KEYS[index]
  local window_ms = tonumber(ARGV[((index - 1) * 2) + 2])
  local count = redis.call("INCR", key)

  if count == 1 or redis.call("PTTL", key) < 0 then
    redis.call("PEXPIRE", key, window_ms)
  end
end

return { 1, 0 }
`;

function parseRedisResult(reply: unknown): RateLimitResult {
  if (!Array.isArray(reply)) {
    throw new Error("Redis rate limit script returned an invalid result.");
  }

  const [allowed, retryAfterSeconds] = reply.map(Number);

  if (allowed === 1) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, retryAfterSeconds || 1),
  };
}

async function consumeRedisRateLimitPolicy(
  buckets: RateLimitBucket[],
): Promise<RateLimitResult> {
  if (buckets.length === 0) {
    return { allowed: true };
  }

  const keys = buckets.map((bucket) => redisRateLimitFixedWindowKey(bucket));
  const args = buckets.flatMap((bucket) => [
    String(bucket.limit),
    String(bucket.windowMs),
  ]);

  const reply = await runRedisCommand((client) =>
    client.sendCommand([
      "EVAL",
      consumeFixedWindowScript,
      String(keys.length),
      ...keys,
      ...args,
    ]),
  );

  return parseRedisResult(reply);
}

export const redisRateLimitStore: RateLimitStore = {
  consumePolicy: consumeRedisRateLimitPolicy,
  pruneExpired: async () => 0,
};
