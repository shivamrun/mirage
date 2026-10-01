import type { RepeatOptions } from "bullmq";

import type { JobName, JobPayload } from "./registry";

export const JOB_SCHEDULER_ID_PREFIX = "mirage:";

export type JobSchedule = {
  [Name in JobName]: {
    id: `${typeof JOB_SCHEDULER_ID_PREFIX}${string}`;
    name: Name;
    payload: JobPayload<Name>;
    repeat: Omit<RepeatOptions, "key">;
  };
}[JobName];

export const jobSchedules = [
  {
    id: "mirage:pending-work-recovery:v1",
    name: "system.pending-work.recover.v1",
    payload: {},
    repeat: { every: 60_000 },
  },
  {
    id: "mirage:billing-subscription-reconciliation:v1",
    name: "billing.subscription-reconciliation.scan.v1",
    payload: {},
    repeat: { pattern: "15 2 * * *", tz: "UTC" },
  },
] as const satisfies readonly JobSchedule[];
