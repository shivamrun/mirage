import { UnrecoverableError } from "bullmq";
import { ZodError } from "zod";

import { jobHandlers } from "./handlers";
import { type JobName, jobDefinitions, parseJobPayload } from "./registry";

export async function processJob(name: string, data: unknown) {
  if (!(name in jobDefinitions)) {
    throw new UnrecoverableError(`Unsupported job name: ${name}`);
  }

  const jobName = name as JobName;
  try {
    const payload = parseJobPayload(jobName, data);
    const handler = jobHandlers[jobName] as (
      value: typeof payload,
    ) => Promise<unknown>;
    return await handler(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new UnrecoverableError("Job payload validation failed.");
    }
    throw error;
  }
}
