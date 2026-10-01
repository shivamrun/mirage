import type { JobSchedulerTemplateOptions } from "bullmq";

import { getJobQueue } from "@/adapters/jobs/queues";
import { jobOptions } from "./enqueue";
import { jobDefinitions, parseJobPayload } from "./registry";
import {
  JOB_SCHEDULER_ID_PREFIX,
  type JobSchedule,
  jobSchedules,
} from "./schedules";

function schedulerOptions(schedule: JobSchedule): JobSchedulerTemplateOptions {
  return jobOptions(schedule.name) as JobSchedulerTemplateOptions;
}

export async function syncJobSchedules({ prune = false } = {}) {
  const desiredQueueById = new Map(
    jobSchedules.map((schedule) => [
      schedule.id,
      jobDefinitions[schedule.name].queue,
    ]),
  );

  for (const schedule of jobSchedules) {
    const definition = jobDefinitions[schedule.name];
    await getJobQueue(definition.queue).upsertJobScheduler(
      schedule.id,
      schedule.repeat,
      {
        data: parseJobPayload(schedule.name, schedule.payload),
        name: schedule.name,
        opts: schedulerOptions(schedule),
      },
    );
  }

  const removed: string[] = [];
  if (prune) {
    const queues = new Set(
      Object.values(jobDefinitions).map((definition) => definition.queue),
    );
    for (const queueName of queues) {
      const queue = getJobQueue(queueName);
      const schedulers = await queue.getJobSchedulers(0, -1, true);
      for (const scheduler of schedulers) {
        if (
          scheduler.key.startsWith(JOB_SCHEDULER_ID_PREFIX) &&
          desiredQueueById.get(
            scheduler.key as (typeof jobSchedules)[number]["id"],
          ) !== queueName
        ) {
          await queue.removeJobScheduler(scheduler.key);
          removed.push(scheduler.key);
        }
      }
    }
  }

  return { registered: jobSchedules.length, removed };
}
