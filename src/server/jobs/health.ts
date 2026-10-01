import { randomUUID } from "node:crypto";
import { hostname } from "node:os";

import {
  createJobsOperationsConnection,
  jobsRedisPrefix,
} from "@/adapters/jobs/connection";
import { logJobEvent } from "./observability";
import { jobQueueNames } from "./registry";

export const WORKER_HEARTBEAT_INTERVAL_MS = 15_000;
export const WORKER_HEARTBEAT_TTL_SECONDS = 45;

export type WorkerHeartbeat = {
  lastSeenAt: string;
  queues: string[];
  release: string | null;
  startedAt: string;
  workerId: string;
};

function heartbeatKey(workerId: string) {
  return `${jobsRedisPrefix()}:workers:${workerId}`;
}

export function createWorkerId() {
  return `${hostname()}:${process.pid}:${randomUUID()}`;
}

export async function startWorkerHeartbeat(workerId: string) {
  const client = createJobsOperationsConnection();
  const startedAt = new Date().toISOString();
  let stopped = false;
  await client.connect();

  async function refresh() {
    const heartbeat: WorkerHeartbeat = {
      lastSeenAt: new Date().toISOString(),
      queues: Object.values(jobQueueNames),
      release: process.env.RELEASE_ID ?? process.env.GIT_SHA ?? null,
      startedAt,
      workerId,
    };
    await client.set(heartbeatKey(workerId), JSON.stringify(heartbeat), {
      EX: WORKER_HEARTBEAT_TTL_SECONDS,
    });
  }

  await refresh();
  const timer = setInterval(() => {
    void refresh().catch((error) =>
      logJobEvent("error", "worker_heartbeat_error", {
        errorKind: error instanceof Error ? error.name : "UnknownError",
        workerId,
      }),
    );
  }, WORKER_HEARTBEAT_INTERVAL_MS);
  timer.unref();

  return {
    async stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      if (client.isOpen) {
        await client.del(heartbeatKey(workerId)).catch(() => undefined);
        await client.close().catch(() => undefined);
      }
    },
  };
}

export async function checkWorkerHealth() {
  const client = createJobsOperationsConnection({ retry: false });
  try {
    await client.connect();
    const heartbeats: WorkerHeartbeat[] = [];
    for await (const keys of client.scanIterator({
      COUNT: 100,
      MATCH: `${jobsRedisPrefix()}:workers:*`,
    })) {
      if (keys.length === 0) continue;
      const values = await client.mGet(keys);
      for (const value of values) {
        if (!value) continue;
        try {
          const heartbeat = JSON.parse(value) as WorkerHeartbeat;
          if (
            Date.now() - new Date(heartbeat.lastSeenAt).getTime() <=
            WORKER_HEARTBEAT_TTL_SECONDS * 1_000
          ) {
            heartbeats.push(heartbeat);
          }
        } catch {
          // A malformed operational record must not hide valid workers.
        }
      }
    }
    return { heartbeats, ok: heartbeats.length > 0 };
  } finally {
    if (client.isOpen) await client.close().catch(() => undefined);
  }
}
