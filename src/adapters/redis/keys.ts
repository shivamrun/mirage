import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/shared/env";

function normalizePrefix(prefix = env.REDIS_KEY_PREFIX) {
  return prefix.trim().replace(/:+$/g, "");
}

export function hashRedisKeyPart(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function redisCacheKey(
  domain: string,
  version: number,
  parts: string[] = [],
  prefix?: string,
) {
  return [
    normalizePrefix(prefix),
    "cache",
    domain,
    `v${version}`,
    ...parts.map(hashRedisKeyPart),
  ].join(":");
}

export function redisCacheGenerationKey(
  domain: string,
  version: number,
  parts: string[] = [],
  prefix?: string,
) {
  return [
    normalizePrefix(prefix),
    "cache-generation",
    domain,
    `v${version}`,
    ...parts.map(hashRedisKeyPart),
  ].join(":");
}

export function redisTempKey(
  purpose: string,
  version: number,
  parts: string[] = [],
  prefix?: string,
) {
  return [
    normalizePrefix(prefix),
    "temp",
    purpose,
    `v${version}`,
    ...parts.map(hashRedisKeyPart),
  ].join(":");
}

export function redisLockKey(
  resource: string,
  version: number,
  parts: string[] = [],
  prefix?: string,
) {
  return [
    normalizePrefix(prefix),
    "lock",
    resource,
    `v${version}`,
    ...parts.map(hashRedisKeyPart),
  ].join(":");
}

export function redisIdempotencyKey(
  provider: string,
  version: number,
  parts: string[] = [],
  prefix?: string,
) {
  return [
    normalizePrefix(prefix),
    "idempotency",
    provider,
    `v${version}`,
    ...parts.map(hashRedisKeyPart),
  ].join(":");
}

export function redisNotificationChannel(recipientId: string, prefix?: string) {
  return [
    normalizePrefix(prefix),
    "pubsub",
    "notifications",
    "v1",
    hashRedisKeyPart(recipientId),
  ].join(":");
}

export function redisRateLimitHashTag(prefix?: string) {
  return `{${normalizePrefix(prefix)}:ratelimit}`;
}

export function redisRateLimitFixedWindowKey({
  identifierHash,
  prefix,
  scope,
}: {
  identifierHash: string;
  prefix?: string;
  scope: string;
}) {
  return [
    redisRateLimitHashTag(prefix),
    "fixed",
    "v1",
    hashRedisKeyPart(scope),
    hashRedisKeyPart(identifierHash),
  ].join(":");
}
