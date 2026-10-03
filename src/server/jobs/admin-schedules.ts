import { getJobQueue } from "@/adapters/jobs/queues";
import type { AdminSchedule } from "@/shared/schemas/admin-schedules";
import { enqueueJob } from "./enqueue";
import { jobDefinitions } from "./registry";
import { jobSchedules } from "./schedules";

export class AdminScheduleNotFoundError extends Error {}
export class AdminScheduleConflictError extends Error {}
export class AdminSchedulesUnavailableError extends Error {}

function iso(timestamp?: number | null) {
  return timestamp === undefined || timestamp === null
    ? null
    : new Date(timestamp).toISOString();
}

export async function listAdminSchedules(): Promise<AdminSchedule[]> {
  return Promise.all(
    jobSchedules.map(async (schedule) => {
      const queueName = jobDefinitions[schedule.name].queue;
      const queue = getJobQueue(queueName);
      const [registered, recent] = await Promise.all([
        queue.getJobScheduler(schedule.id),
        queue.getJobs(["active", "completed", "failed"], 0, -1, false),
      ]);
      const lastRun = recent
        .filter((job) => job.repeatJobKey === schedule.id && job.processedOn)
        .sort(
          (left, right) => (right.processedOn ?? 0) - (left.processedOn ?? 0),
        )[0];
      const pattern =
        "pattern" in schedule.repeat ? schedule.repeat.pattern : undefined;
      const every =
        "every" in schedule.repeat ? schedule.repeat.every : undefined;
      const timezone = "tz" in schedule.repeat ? schedule.repeat.tz : undefined;
      const enabled = Boolean(
        registered &&
          registered.name === schedule.name &&
          registered.pattern === pattern &&
          registered.every === every &&
          registered.tz === timezone,
      );

      return {
        enabled,
        everyMs: every ?? null,
        id: schedule.id,
        lastRunAt: iso(lastRun?.processedOn),
        manualTrigger: schedule.manualTrigger,
        name: schedule.name,
        nextRunAt: enabled ? iso(registered?.next) : null,
        pattern: pattern ?? null,
        queue: queueName,
        timezone: timezone ?? null,
      };
    }),
  );
}

export async function triggerAdminSchedule(
  scheduleId: string,
  requestId: string,
) {
  const schedule = jobSchedules.find(({ id }) => id === scheduleId);
  if (!schedule) throw new AdminScheduleNotFoundError("Schedule not found.");
  if (!schedule.manualTrigger) {
    throw new AdminScheduleConflictError(
      "This schedule cannot be triggered manually.",
    );
  }
  const safeScheduleId = schedule.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const job = await enqueueJob(schedule.name, schedule.payload, {
    jobId: `admin-${safeScheduleId}-${requestId}`,
  });
  if (!job.id) {
    throw new AdminSchedulesUnavailableError("Schedules service unavailable.");
  }
  return job.id;
}
