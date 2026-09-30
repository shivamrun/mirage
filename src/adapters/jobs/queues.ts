import { Queue } from "bullmq";

import type { jobQueueNames } from "@/server/jobs/registry";
import { createJobProducerConnection, jobsRedisPrefix } from "./connection";

type JobQueueName = (typeof jobQueueNames)[keyof typeof jobQueueNames];

declare global {
  var mirageJobQueues: Map<JobQueueName, Queue> | undefined;
}

export function getJobQueue(name: JobQueueName) {
  globalThis.mirageJobQueues ??= new Map();
  const existing = globalThis.mirageJobQueues.get(name);
  if (existing) return existing;

  const queue = new Queue(name, {
    connection: createJobProducerConnection(),
    prefix: jobsRedisPrefix(),
  });
  queue.on("error", (error) => {
    console.error(
      JSON.stringify({
        error: error.message,
        event: "job_queue_error",
        queue: name,
      }),
    );
  });
  globalThis.mirageJobQueues.set(name, queue);
  return queue;
}

export async function closeJobQueues() {
  const queues = [...(globalThis.mirageJobQueues?.values() ?? [])];
  globalThis.mirageJobQueues = undefined;
  await Promise.allSettled(queues.map((queue) => queue.close()));
}
