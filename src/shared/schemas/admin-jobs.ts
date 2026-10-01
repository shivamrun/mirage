import { z } from "zod";

import { jobDefinitions, jobQueueNames } from "@/server/jobs/registry";
import { paginationMetaSchema, paginationQuerySchema } from "./pagination";

const queueValues = Object.values(jobQueueNames);
const jobNameValues = Object.keys(
  jobDefinitions,
) as (keyof typeof jobDefinitions)[];

export const adminJobQueueSchema = z.enum(queueValues);
export const adminJobNameSchema = z.enum(jobNameValues);
export const adminJobStatusSchema = z.enum([
  "waiting",
  "active",
  "delayed",
  "completed",
  "failed",
]);

export const adminJobsListQuerySchema = paginationQuerySchema.extend({
  name: adminJobNameSchema.optional(),
  queue: adminJobQueueSchema.optional(),
  status: adminJobStatusSchema.optional(),
});

export const adminJobKeySchema = z.object({
  jobId: z.string().trim().min(1).max(512),
  queue: adminJobQueueSchema,
});

export const adminJobDetailQuerySchema = adminJobKeySchema;
export const adminJobActionSchema = adminJobKeySchema.strict();
export const adminScheduleTriggerSchema = z
  .object({
    requestId: z.uuid(),
    scheduleId: z.string().trim().min(1).max(256),
  })
  .strict();

export const adminJobCountsSchema = z.object({
  active: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
});

export const adminSafePayloadSchema = z.object({
  fields: z.record(z.string(), z.string()),
  redacted: z.boolean(),
});

export const adminJobSchema = z.object({
  attemptsMade: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  id: z.string(),
  maxAttempts: z.number().int().positive(),
  name: z.string(),
  processedAt: z.iso.datetime().nullable(),
  queue: adminJobQueueSchema,
  scheduledFor: z.iso.datetime().nullable(),
  schedulerId: z.string().nullable(),
  status: adminJobStatusSchema,
});

export const adminJobDetailSchema = adminJobSchema.extend({
  failureReason: z.string().nullable(),
  payload: adminSafePayloadSchema,
});

export const adminQueueHealthSchema = z.object({
  counts: adminJobCountsSchema,
  oldestWaitingAgeMs: z.number().int().nonnegative().nullable(),
  queue: adminJobQueueSchema,
  status: z.enum(["healthy", "no-worker", "unavailable"]),
  workerCount: z.number().int().nonnegative(),
});

export const adminWorkerSchema = z.object({
  concurrencyByQueue: z.record(z.string(), z.number().int().positive()),
  lastSeenAt: z.iso.datetime(),
  queues: z.array(adminJobQueueSchema),
  release: z.string().nullable(),
  startedAt: z.iso.datetime(),
  status: z.literal("online"),
  workerId: z.string(),
});

export const adminScheduleSchema = z.object({
  enabled: z.boolean(),
  everyMs: z.number().int().positive().nullable(),
  id: z.string(),
  lastRunAt: z.iso.datetime().nullable(),
  manualTrigger: z.boolean(),
  name: adminJobNameSchema,
  nextRunAt: z.iso.datetime().nullable(),
  pattern: z.string().nullable(),
  queue: adminJobQueueSchema,
  timezone: z.string().nullable(),
});

export const adminJobDetailResponseSchema = z.object({
  job: adminJobDetailSchema,
});

export const adminJobMutationResponseSchema = z.object({
  job: adminJobSchema,
  status: z.literal(true),
});

export const adminScheduleTriggerResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal(true),
});

export const adminJobsPageSchema = z.object({
  items: z.array(adminJobSchema),
  pagination: paginationMetaSchema,
  unavailableQueues: z.array(adminJobQueueSchema),
});

export type AdminJob = z.infer<typeof adminJobSchema>;
export type AdminJobCounts = z.infer<typeof adminJobCountsSchema>;
export type AdminJobDetail = z.infer<typeof adminJobDetailSchema>;
export type AdminJobName = z.infer<typeof adminJobNameSchema>;
export type AdminJobQueue = z.infer<typeof adminJobQueueSchema>;
export type AdminJobsListQuery = z.output<typeof adminJobsListQuerySchema>;
export type AdminJobStatus = z.infer<typeof adminJobStatusSchema>;
export type AdminQueueHealth = z.infer<typeof adminQueueHealthSchema>;
export type AdminSchedule = z.infer<typeof adminScheduleSchema>;
export type AdminWorker = z.infer<typeof adminWorkerSchema>;
