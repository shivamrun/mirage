import type { Job, JobType } from "bullmq";

import { getJobQueue } from "@/adapters/jobs/queues";
import {
  createPaginationMeta,
  getPaginationOffset,
  type PaginationMeta,
} from "@/shared/pagination";
import type {
  AdminJob,
  AdminJobCounts,
  AdminJobDetail,
  AdminJobName,
  AdminJobQueue,
  AdminJobStatus,
  AdminQueueHealth,
  AdminSchedule,
  AdminWorker,
} from "@/shared/schemas/admin-jobs";
import { enqueueJob } from "./enqueue";
import { checkWorkerHealth, WORKER_HEARTBEAT_TTL_SECONDS } from "./health";
import { type JobName, jobDefinitions, jobQueueNames } from "./registry";
import { jobSchedules } from "./schedules";

const adminStatuses = [
  "waiting",
  "active",
  "delayed",
  "completed",
  "failed",
] as const satisfies readonly AdminJobStatus[];

const bullStatesByAdminStatus: Record<AdminJobStatus, JobType[]> = {
  active: ["active"],
  completed: ["completed"],
  delayed: ["delayed"],
  failed: ["failed"],
  waiting: ["waiting", "prioritized"],
};

const emptyCounts = (): AdminJobCounts => ({
  active: 0,
  completed: 0,
  delayed: 0,
  failed: 0,
  waiting: 0,
});

export class AdminJobNotFoundError extends Error {}
export class AdminJobConflictError extends Error {}
export class AdminJobsUnavailableError extends Error {}

function iso(timestamp?: number | null) {
  return timestamp === undefined || timestamp === null
    ? null
    : new Date(timestamp).toISOString();
}

function normalizedStatus(state: string): AdminJobStatus | null {
  if (state === "prioritized" || state === "waiting-children") return "waiting";
  return adminStatuses.includes(state as AdminJobStatus)
    ? (state as AdminJobStatus)
    : null;
}

function toAdminJob(
  job: Job,
  queue: AdminJobQueue,
  status: AdminJobStatus,
): AdminJob {
  return {
    attemptsMade: job.attemptsMade,
    createdAt: new Date(job.timestamp).toISOString(),
    finishedAt: iso(job.finishedOn),
    id: job.id ?? "unknown",
    maxAttempts:
      typeof job.opts.attempts === "number" && job.opts.attempts > 0
        ? job.opts.attempts
        : 1,
    name: job.name,
    processedAt: iso(job.processedOn),
    queue,
    scheduledFor:
      typeof job.opts.delay === "number" && job.opts.delay > 0
        ? iso(job.timestamp + job.opts.delay)
        : null,
    schedulerId: job.repeatJobKey ?? null,
    status,
  };
}

function maskIdentifier(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return "[redacted]";
  if (value.length <= 6) return "******";
  return `${value.slice(0, 2)}…${value.slice(-4)}`;
}

function safePayload(name: string, data: unknown): AdminJobDetail["payload"] {
  const value =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  switch (name as JobName) {
    case "billing.stripe-event.process.v1":
      return {
        fields: {
          eventId: maskIdentifier(value.eventId),
          eventType:
            typeof value.eventType === "string"
              ? value.eventType
              : "[redacted]",
          objectId: maskIdentifier(value.objectId),
        },
        redacted: true,
      };
    case "billing.subscription-reconciliation.scan.v1":
      return {
        fields: {
          ...(value.cursor ? { cursor: maskIdentifier(value.cursor) } : {}),
          ...(typeof value.runId === "string" ? { runId: value.runId } : {}),
        },
        redacted: Boolean(value.cursor),
      };
    case "billing.subscription.reconcile.v1":
      return {
        fields: { subscriptionId: maskIdentifier(value.subscriptionId) },
        redacted: true,
      };
    case "notification.email.send.v1":
      return {
        fields: { deliveryId: maskIdentifier(value.deliveryId) },
        redacted: true,
      };
    case "system.pending-work.recover.v1":
      return { fields: {}, redacted: false };
    default:
      return { fields: {}, redacted: true };
  }
}

function safeFailureReason(reason?: string) {
  if (!reason) return null;
  if (reason === "Job payload validation failed.") {
    return "Job payload validation failed.";
  }
  if (reason.endsWith("record was not found.")) {
    return "A required record was not found.";
  }
  if (reason === "One or more pending-work recovery operations failed.") {
    return reason;
  }
  return "Processing failed; details withheld. Check server logs.";
}

async function loadHeartbeats(): Promise<AdminWorker[]> {
  const { heartbeats } = await checkWorkerHealth();
  const knownQueues = new Set(Object.values(jobQueueNames));

  return heartbeats.flatMap((heartbeat) => {
    const lastSeen = Date.parse(heartbeat.lastSeenAt);
    const started = Date.parse(heartbeat.startedAt);
    if (
      !heartbeat.workerId ||
      !Number.isFinite(lastSeen) ||
      !Number.isFinite(started) ||
      Date.now() - lastSeen > WORKER_HEARTBEAT_TTL_SECONDS * 1_000
    ) {
      return [];
    }

    const queues = heartbeat.queues.filter((queue): queue is AdminJobQueue =>
      knownQueues.has(queue as AdminJobQueue),
    );
    const concurrencyByQueue = Object.fromEntries(
      Object.entries(heartbeat.concurrencyByQueue ?? {}).filter(
        ([queue, concurrency]) =>
          knownQueues.has(queue as AdminJobQueue) &&
          Number.isInteger(concurrency) &&
          concurrency > 0,
      ),
    );

    return [
      {
        concurrencyByQueue,
        lastSeenAt: new Date(lastSeen).toISOString(),
        queues,
        release: heartbeat.release,
        startedAt: new Date(started).toISOString(),
        status: "online" as const,
        workerId: heartbeat.workerId,
      },
    ];
  });
}

export type AdminJobsSnapshot = {
  counts: AdminJobCounts;
  queues: AdminQueueHealth[];
  schedules: AdminSchedule[];
  snapshotAt: string;
  workers: AdminWorker[];
};

export async function getAdminJobsSnapshot(): Promise<AdminJobsSnapshot> {
  let workers: AdminWorker[] = [];
  try {
    workers = await loadHeartbeats();
  } catch {
    // Queue rows independently report Redis availability.
  }

  const queues = await Promise.all(
    Object.values(jobQueueNames).map(
      async (queueName): Promise<AdminQueueHealth> => {
        const queue = getJobQueue(queueName);
        try {
          const [counts, oldest] = await Promise.all([
            queue.getJobCounts(
              "active",
              "completed",
              "delayed",
              "failed",
              "prioritized",
              "waiting",
            ),
            queue.getJobs(["waiting", "prioritized"], 0, 0, true),
          ]);
          const workerCount = workers.filter(({ queues: names }) =>
            names.includes(queueName),
          ).length;
          return {
            counts: {
              active: counts.active ?? 0,
              completed: counts.completed ?? 0,
              delayed: counts.delayed ?? 0,
              failed: counts.failed ?? 0,
              waiting: (counts.waiting ?? 0) + (counts.prioritized ?? 0),
            },
            oldestWaitingAgeMs: oldest[0]
              ? Math.max(0, Date.now() - oldest[0].timestamp)
              : null,
            queue: queueName,
            status: workerCount > 0 ? "healthy" : "no-worker",
            workerCount,
          };
        } catch {
          return {
            counts: emptyCounts(),
            oldestWaitingAgeMs: null,
            queue: queueName,
            status: "unavailable",
            workerCount: 0,
          };
        }
      },
    ),
  );

  const counts = queues.reduce((total, queue) => {
    for (const status of adminStatuses) total[status] += queue.counts[status];
    return total;
  }, emptyCounts());

  return {
    counts,
    queues,
    schedules: await listAdminSchedules().catch(() => []),
    snapshotAt: new Date().toISOString(),
    workers,
  };
}

export async function listAdminJobs({
  limit,
  name,
  page,
  queue: selectedQueue,
  status: selectedStatus,
}: {
  limit: number;
  name?: AdminJobName;
  page: number;
  queue?: AdminJobQueue;
  status?: AdminJobStatus;
}): Promise<{
  items: AdminJob[];
  pagination: PaginationMeta;
  unavailableQueues: AdminJobQueue[];
}> {
  const queues = selectedQueue ? [selectedQueue] : Object.values(jobQueueNames);
  const statuses = selectedStatus ? [selectedStatus] : [...adminStatuses];
  const unavailableQueues = new Set<AdminJobQueue>();

  const groups = await Promise.all(
    queues.flatMap((queueName) =>
      statuses.map(async (status) => {
        try {
          const jobs = await getJobQueue(queueName).getJobs(
            bullStatesByAdminStatus[status],
            0,
            -1,
            false,
          );
          return jobs
            .filter((job) => !name || job.name === name)
            .map((job) => toAdminJob(job, queueName, status));
        } catch {
          unavailableQueues.add(queueName);
          return [];
        }
      }),
    ),
  );
  const jobs = groups
    .flat()
    .sort(
      (left, right) =>
        Date.parse(right.finishedAt ?? right.processedAt ?? right.createdAt) -
        Date.parse(left.finishedAt ?? left.processedAt ?? left.createdAt),
    );
  const pagination = createPaginationMeta({ limit, page, total: jobs.length });
  const offset = getPaginationOffset({ limit, page: pagination.page });

  return {
    items: jobs.slice(offset, offset + limit),
    pagination,
    unavailableQueues: [...unavailableQueues],
  };
}

async function findJob(queueName: AdminJobQueue, jobId: string) {
  try {
    const job = await getJobQueue(queueName).getJob(jobId);
    if (!job) throw new AdminJobNotFoundError("Job not found.");
    return job;
  } catch (error) {
    if (error instanceof AdminJobNotFoundError) throw error;
    throw new AdminJobsUnavailableError("Jobs service unavailable.");
  }
}

export async function getAdminJobDetail(
  queueName: AdminJobQueue,
  jobId: string,
): Promise<AdminJobDetail> {
  const job = await findJob(queueName, jobId);
  const status = normalizedStatus(await job.getState());
  if (!status) throw new AdminJobConflictError("Job state is unsupported.");
  return {
    ...toAdminJob(job, queueName, status),
    failureReason: safeFailureReason(job.failedReason),
    payload: safePayload(job.name, job.data),
  };
}

export async function retryAdminJob(queueName: AdminJobQueue, jobId: string) {
  const job = await findJob(queueName, jobId);
  if ((await job.getState()) !== "failed") {
    throw new AdminJobConflictError("Only failed jobs can be retried.");
  }
  try {
    await job.retry("failed");
  } catch {
    throw new AdminJobConflictError(
      "The job changed state and was not retried.",
    );
  }
  const status = normalizedStatus(await job.getState()) ?? "waiting";
  return toAdminJob(job, queueName, status);
}

export async function removeAdminJob(queueName: AdminJobQueue, jobId: string) {
  const job = await findJob(queueName, jobId);
  const state = await job.getState();
  const status = normalizedStatus(state);
  if (
    !status ||
    status === "active" ||
    job.repeatJobKey ||
    !["waiting", "delayed", "completed", "failed"].includes(status)
  ) {
    throw new AdminJobConflictError("This job cannot be safely removed.");
  }
  const dependencies = await job.getDependenciesCount();
  if (Object.values(dependencies).some((count) => (count ?? 0) > 0)) {
    throw new AdminJobConflictError(
      "Jobs with dependencies cannot be removed.",
    );
  }
  try {
    await job.remove({ removeChildren: false });
  } catch {
    throw new AdminJobConflictError(
      "The job changed state and was not removed.",
    );
  }
  return toAdminJob(job, queueName, status);
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
  if (!schedule) throw new AdminJobNotFoundError("Schedule not found.");
  if (!schedule.manualTrigger) {
    throw new AdminJobConflictError(
      "This schedule cannot be triggered manually.",
    );
  }
  const safeScheduleId = schedule.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const job = await enqueueJob(schedule.name, schedule.payload, {
    jobId: `admin-${safeScheduleId}-${requestId}`,
  });
  if (!job.id) throw new AdminJobsUnavailableError("Jobs service unavailable.");
  return job.id;
}
