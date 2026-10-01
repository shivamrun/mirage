import { Worker } from "bullmq";

import {
  createJobWorkerConnection,
  jobsRedisPrefix,
} from "@/adapters/jobs/connection";
import { finalizeJobFailure } from "./handlers";
import { logJobEvent } from "./observability";
import { processJob } from "./processor";
import { jobQueueNames } from "./registry";

export const workerConfiguration = {
  [jobQueueNames.billing]: { concurrency: 2 },
  [jobQueueNames.default]: { concurrency: 5 },
} as const;

export function createJobWorkers(workerId = "unidentified-worker") {
  return Object.entries(workerConfiguration).map(([queue, configuration]) => {
    const startedAt = new Map<string, number>();
    const worker = new Worker(queue, (job) => processJob(job.name, job.data), {
      concurrency: configuration.concurrency,
      connection: createJobWorkerConnection(),
      lockDuration: 30_000,
      maxStalledCount: 1,
      prefix: jobsRedisPrefix(),
      stalledInterval: 30_000,
    });

    worker.on("active", (job) => {
      if (job.id) startedAt.set(job.id, Date.now());
      logJobEvent("info", "job_started", {
        attempt: job.attemptsMade + 1,
        jobId: job.id,
        jobName: job.name,
        queue,
        schedulerId: job.repeatJobKey,
        workerId,
      });
    });
    worker.on("completed", (job) => {
      const started = job.id ? startedAt.get(job.id) : undefined;
      if (job.id) startedAt.delete(job.id);
      logJobEvent("info", "job_completed", {
        durationMs: started ? Date.now() - started : undefined,
        jobId: job.id,
        jobName: job.name,
        queue,
        schedulerId: job.repeatJobKey,
        workerId,
      });
    });
    worker.on("failed", (job, error) => {
      const started = job?.id ? startedAt.get(job.id) : undefined;
      if (job?.id) startedAt.delete(job.id);
      const attempts = job?.opts.attempts ?? 1;
      if (job && job.attemptsMade >= attempts) {
        void finalizeJobFailure({
          data: job.data,
          error,
          name: job.name,
        }).catch((finalizationError) =>
          logJobEvent("error", "job_failure_finalization_error", {
            errorKind:
              finalizationError instanceof Error
                ? finalizationError.name
                : "UnknownError",
            jobId: job.id,
            queue,
            workerId,
          }),
        );
      }
      logJobEvent("error", "job_failed", {
        attempt: job?.attemptsMade,
        durationMs: started ? Date.now() - started : undefined,
        errorKind: error.name,
        jobId: job?.id,
        jobName: job?.name,
        queue,
        schedulerId: job?.repeatJobKey,
        workerId,
      });
    });
    worker.on("stalled", (jobId) =>
      logJobEvent("warn", "job_stalled", { jobId, queue, workerId }),
    );
    worker.on("error", (error) =>
      logJobEvent("error", "worker_error", {
        errorKind: error.name,
        queue,
        workerId,
      }),
    );

    return worker;
  });
}
