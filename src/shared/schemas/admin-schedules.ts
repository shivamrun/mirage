import { z } from "zod";

import { jobDefinitions, jobQueueNames } from "@/server/jobs/registry";

const queueValues = Object.values(jobQueueNames);
const jobNameValues = Object.keys(
  jobDefinitions,
) as (keyof typeof jobDefinitions)[];

export const adminScheduleTriggerSchema = z
  .object({
    requestId: z.uuid(),
    scheduleId: z.string().trim().min(1).max(256),
  })
  .strict();

export const adminScheduleSchema = z.object({
  enabled: z.boolean(),
  everyMs: z.number().int().positive().nullable(),
  id: z.string(),
  lastRunAt: z.iso.datetime().nullable(),
  manualTrigger: z.boolean(),
  name: z.enum(jobNameValues),
  nextRunAt: z.iso.datetime().nullable(),
  pattern: z.string().nullable(),
  queue: z.enum(queueValues),
  timezone: z.string().nullable(),
});

export const adminScheduleTriggerResponseSchema = z.object({
  jobId: z.string(),
  status: z.literal(true),
});

export type AdminSchedule = z.infer<typeof adminScheduleSchema>;
