import "server-only";

import { createClient, type RedisClientType } from "redis";
import { env } from "@/shared/env";

const DEFAULT_REDIS_COMMAND_TIMEOUT_MS = 750;

export class RedisUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RedisUnavailableError";
  }
}

declare global {
  var mirageRedisClient: RedisClientType | undefined;
  var mirageRedisConnectPromise: Promise<RedisClientType> | undefined;
}

export function isRedisConfigured() {
  return Boolean(env.REDIS_URL);
}

function createRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  const client = createClient({
    socket: {
      connectTimeout: DEFAULT_REDIS_COMMAND_TIMEOUT_MS,
      reconnectStrategy: false,
    },
    url: env.REDIS_URL,
  });

  client.on("error", () => {
    // Feature adapters handle command failures and choose fallback behavior.
  });

  return client;
}

export async function getRedisClient() {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!globalThis.mirageRedisClient) {
    const client = createRedisClient();

    if (!client) {
      return null;
    }

    globalThis.mirageRedisClient = client;
  }

  const client = globalThis.mirageRedisClient;

  if (!client.isOpen) {
    globalThis.mirageRedisConnectPromise ??= client
      .connect()
      .then(() => client)
      .catch((error) => {
        globalThis.mirageRedisClient = undefined;
        throw new RedisUnavailableError("Redis connection failed.", {
          cause: error,
        });
      })
      .finally(() => {
        globalThis.mirageRedisConnectPromise = undefined;
      });

    return globalThis.mirageRedisConnectPromise;
  }

  return client;
}

export async function runRedisCommand<T>(
  command: (client: RedisClientType) => Promise<T>,
  timeoutMs = DEFAULT_REDIS_COMMAND_TIMEOUT_MS,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const commandPromise = (async () => {
    const client = await getRedisClient();

    if (!client) {
      throw new RedisUnavailableError("Redis is not configured.");
    }

    return command(client);
  })();
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      reject(new RedisUnavailableError("Redis command timed out."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([commandPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof RedisUnavailableError) {
      throw error;
    }

    throw new RedisUnavailableError("Redis command failed.", {
      cause: error,
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function checkRedisHealth(): Promise<
  "degraded" | "not_configured" | "ok"
> {
  if (!env.REDIS_URL) {
    return "not_configured";
  }

  try {
    await runRedisCommand((client) => client.ping(), 500);
    return "ok";
  } catch {
    return "degraded";
  }
}
