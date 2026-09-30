import type { JobsOptions } from "bullmq";

import { getJobQueue } from "@/adapters/jobs/queues";
import {
  type JobName,
  type JobPayload,
  jobDefinitions,
  parseJobPayload,
} from "./registry";

export class JobEnqueueError extends Error {
  constructor(
    readonly jobName: JobName,
    options?: ErrorOptions,
  ) {
    super(`Unable to enqueue background job ${jobName}.`, options);
    this.name = "JobEnqueueError";
  }
}

type TestEnqueueHandler = (
  name: JobName,
  payload: unknown,
  options: Pick<JobsOptions, "delay" | "jobId">,
) => Promise<{ id?: string }>;

let testEnqueueHandler: TestEnqueueHandler | null = null;

export function setJobEnqueueHandlerForTests(
  handler: TestEnqueueHandler | null,
) {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Job enqueue overrides are only available in tests.");
  }
  testEnqueueHandler = handler;
}

export async function enqueueJob<Name extends JobName>(
  name: Name,
  payload: JobPayload<Name>,
  options: Pick<JobsOptions, "delay" | "jobId"> = {},
) {
  const definition = jobDefinitions[name];
  const parsedPayload = parseJobPayload(name, payload);

  try {
    if (testEnqueueHandler) {
      return await testEnqueueHandler(name, parsedPayload, options);
    }

    const job = await getJobQueue(definition.queue).add(name, parsedPayload, {
      ...options,
      attempts: definition.attempts,
      backoff: definition.backoff,
      priority: definition.priority,
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 2_592_000, count: 10_000 },
    });
    console.info(
      JSON.stringify({
        event: "job_enqueued",
        jobId: job.id,
        jobName: name,
        queue: definition.queue,
      }),
    );
    return job;
  } catch (error) {
    throw new JobEnqueueError(name, { cause: error });
  }
}
