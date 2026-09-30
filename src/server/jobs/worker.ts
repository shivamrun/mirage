import { Worker } from "bullmq";

import {
  createJobWorkerConnection,
  jobsRedisPrefix,
} from "@/adapters/jobs/connection";
import { finalizeStripeWebhookJobFailure } from "@/server/db/services/billing/stripe-webhook-jobs";
import { finalizeEmailDeliveryFailure } from "@/server/db/services/notifications/email-delivery";
import { processJob } from "./processor";
import { jobDefinitions, jobQueueNames } from "./registry";

function log(event: string, details: Record<string, unknown>) {
  console.info(JSON.stringify({ event, ...details }));
}

async function finalizeJobFailure({
  data,
  error,
  name,
}: {
  data: unknown;
  error: Error;
  name: string;
}) {
  if (name === "billing.stripe-event.process.v1") {
    const payload = jobDefinitions[name].payloadSchema.safeParse(data);
    if (payload.success) {
      await finalizeStripeWebhookJobFailure({ error, payload: payload.data });
    }
  }
  if (name === "notification.email.send.v1") {
    const payload = jobDefinitions[name].payloadSchema.safeParse(data);
    if (payload.success) {
      await finalizeEmailDeliveryFailure({
        deliveryId: payload.data.deliveryId,
        error,
      });
    }
  }
}

export function createJobWorkers() {
  return Object.entries({
    [jobQueueNames.billing]: 2,
    [jobQueueNames.default]: 5,
  }).map(([queue, concurrency]) => {
    const worker = new Worker(queue, (job) => processJob(job.name, job.data), {
      concurrency,
      connection: createJobWorkerConnection(),
      prefix: jobsRedisPrefix(),
    });

    worker.on("active", (job) =>
      log("job_started", {
        attempt: job.attemptsMade + 1,
        jobId: job.id,
        jobName: job.name,
        queue,
      }),
    );
    worker.on("completed", (job) =>
      log("job_completed", { jobId: job.id, jobName: job.name, queue }),
    );
    worker.on("failed", (job, error) => {
      const attempts = job?.opts.attempts ?? 1;
      if (job && job.attemptsMade >= attempts) {
        void finalizeJobFailure({
          data: job.data,
          error,
          name: job.name,
        }).catch((finalizationError) =>
          console.error(
            JSON.stringify({
              error:
                finalizationError instanceof Error
                  ? finalizationError.name
                  : "UnknownError",
              event: "job_failure_finalization_error",
              jobId: job.id,
              queue,
            }),
          ),
        );
      }
      console.error(
        JSON.stringify({
          attempt: job?.attemptsMade,
          error: error.name,
          event: "job_failed",
          jobId: job?.id,
          jobName: job?.name,
          queue,
        }),
      );
    });
    worker.on("stalled", (jobId) =>
      console.warn(JSON.stringify({ event: "job_stalled", jobId, queue })),
    );
    worker.on("error", (error) =>
      console.error(
        JSON.stringify({ error: error.message, event: "worker_error", queue }),
      ),
    );

    return worker;
  });
}
