import { createNodeRedisClient } from "bullmq";
import { createClient } from "redis";

import { env } from "@/shared/env";

export class JobsRedisConfigurationError extends Error {
  constructor() {
    super(
      env.NODE_ENV === "production"
        ? "JOBS_REDIS_URL must be configured for production background jobs."
        : "JOBS_REDIS_URL or REDIS_URL must be configured for background jobs.",
    );
    this.name = "JobsRedisConfigurationError";
  }
}

export function resolveJobsRedisUrl({
  jobsRedisUrl,
  nodeEnv,
  redisUrl,
}: {
  jobsRedisUrl?: string;
  nodeEnv: "development" | "production" | "test";
  redisUrl?: string;
}) {
  return jobsRedisUrl ?? (nodeEnv === "production" ? undefined : redisUrl);
}

function configuredJobsRedisUrl() {
  return resolveJobsRedisUrl({
    jobsRedisUrl: env.JOBS_REDIS_URL,
    nodeEnv: env.NODE_ENV,
    redisUrl: env.REDIS_URL,
  });
}

export function jobsRedisUrl() {
  const url = configuredJobsRedisUrl();
  if (!url) throw new JobsRedisConfigurationError();
  return url;
}

export function createJobsOperationsConnection({
  retry = true,
}: {
  retry?: boolean;
} = {}) {
  const client = createClient({
    socket: {
      connectTimeout: retry ? 5_000 : 1_000,
      reconnectStrategy: retry
        ? (retries) => Math.min(1_000 * 2 ** retries, 20_000)
        : false,
    },
    url: jobsRedisUrl(),
  });
  client.on("error", () => {
    // Callers surface operation-specific structured errors.
  });
  return client;
}

export function jobsRedisPrefix() {
  return `${env.REDIS_KEY_PREFIX}:jobs`;
}

export function createJobProducerConnection() {
  const rawClient = createClient({
    socket: {
      connectTimeout: 1_000,
      reconnectStrategy: false,
    },
    url: jobsRedisUrl(),
  });
  rawClient.on("error", () => {
    // Queue instances emit actionable errors with job context.
  });
  return createNodeRedisClient(rawClient);
}

export function createJobWorkerConnection() {
  const rawClient = createClient({
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(1_000 * 2 ** retries, 20_000),
    },
    url: jobsRedisUrl(),
  });
  rawClient.on("error", () => {
    // Worker error listeners provide structured operational logging.
  });
  return createNodeRedisClient(rawClient);
}

export async function checkJobsRedisHealth(): Promise<
  "degraded" | "not_configured" | "ok"
> {
  const url = configuredJobsRedisUrl();
  if (!url) return "not_configured";

  const client = createClient({
    socket: { connectTimeout: 500, reconnectStrategy: false },
    url,
  });
  client.on("error", () => undefined);
  try {
    await client.connect();
    await client.ping();
    return "ok";
  } catch {
    return "degraded";
  } finally {
    if (client.isOpen) await client.close().catch(() => undefined);
  }
}
