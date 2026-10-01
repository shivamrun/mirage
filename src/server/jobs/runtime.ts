import { closeJobQueues, getJobQueue } from "@/adapters/jobs/queues";
import { closeDbConnection } from "@/server/db";
import { checkDatabaseHealth } from "@/server/db/dal/health";
import { startWorkerHeartbeat } from "./health";
import { logJobEvent } from "./observability";
import { jobQueueNames } from "./registry";
import { syncJobSchedules } from "./schedule-manager";
import { createJobWorkers, workerConfiguration } from "./worker";

const QUEUE_HEALTH_INTERVAL_MS = 30_000;

function startQueueHealthSampling(workerId: string) {
  let stopped = false;
  let inFlight: Promise<void> | null = null;

  async function sample() {
    for (const queueName of Object.values(jobQueueNames)) {
      if (stopped) return;
      const queue = getJobQueue(queueName);
      try {
        const [counts, oldestJobs] = await Promise.all([
          queue.getJobCounts(
            "active",
            "delayed",
            "failed",
            "prioritized",
            "waiting",
          ),
          queue.getJobs(["prioritized", "waiting"], 0, 0, true),
        ]);
        const oldest = oldestJobs[0];
        logJobEvent("info", "queue_health", {
          counts,
          oldestJobAgeMs: oldest
            ? Math.max(0, Date.now() - oldest.timestamp)
            : null,
          queue: queueName,
          workerId,
        });
      } catch (error) {
        logJobEvent("error", "queue_health_error", {
          errorKind: error instanceof Error ? error.name : "UnknownError",
          queue: queueName,
          workerId,
        });
      }
    }
  }

  function requestSample() {
    if (stopped || inFlight) return;
    inFlight = sample().finally(() => {
      inFlight = null;
    });
  }

  requestSample();
  const timer = setInterval(requestSample, QUEUE_HEALTH_INTERVAL_MS);
  timer.unref();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await inFlight;
  };
}

export async function startJobWorkerRuntime(workerId: string) {
  await checkDatabaseHealth();
  const schedules = await syncJobSchedules();
  const workers = createJobWorkers(workerId);
  let heartbeat: Awaited<ReturnType<typeof startWorkerHeartbeat>>;
  try {
    heartbeat = await startWorkerHeartbeat(
      workerId,
      Object.fromEntries(
        Object.entries(workerConfiguration).map(([queue, { concurrency }]) => [
          queue,
          concurrency,
        ]),
      ),
    );
  } catch (error) {
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await closeJobQueues();
    await closeDbConnection();
    throw error;
  }
  const stopQueueHealthSampling = startQueueHealthSampling(workerId);
  let closed = false;

  logJobEvent("info", "worker_ready", {
    schedules: schedules.registered,
    workerId,
    workers: workers.length,
  });

  return {
    async close(signal: string) {
      if (closed) return;
      closed = true;
      await stopQueueHealthSampling();
      logJobEvent("info", "worker_shutdown", { signal, workerId });
      const results = await Promise.allSettled(
        workers.map((worker) => worker.close()),
      );
      await heartbeat.stop();
      await closeJobQueues();
      await closeDbConnection();
      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length > 0) {
        throw new AggregateError(
          rejected.map((result) => result.reason),
          "One or more workers failed to close.",
        );
      }
    },
  };
}
