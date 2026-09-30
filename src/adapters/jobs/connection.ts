import { createNodeRedisClient } from "bullmq";
import { createClient } from "redis";

import { env } from "@/shared/env";

export class JobsRedisConfigurationError extends Error {
  constructor() {
    super(
      "JOBS_REDIS_URL or REDIS_URL must be configured for background jobs.",
    );
    this.name = "JobsRedisConfigurationError";
  }
}

function jobsRedisUrl() {
  const url = env.JOBS_REDIS_URL ?? env.REDIS_URL;
  if (!url) throw new JobsRedisConfigurationError();
  return url;
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
  const url = env.JOBS_REDIS_URL ?? env.REDIS_URL;
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
