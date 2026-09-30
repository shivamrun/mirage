import { UnrecoverableError } from "bullmq";
import { ZodError } from "zod";

import { processStripeWebhookJob } from "@/server/db/services/billing/stripe-webhook-jobs";
import { processEmailDelivery } from "@/server/db/services/notifications/email-delivery";
import { type JobName, jobDefinitions, parseJobPayload } from "./registry";

export async function processJob(name: string, data: unknown) {
  if (!(name in jobDefinitions)) {
    throw new UnrecoverableError(`Unsupported job name: ${name}`);
  }

  const jobName = name as JobName;
  try {
    const processing = (() => {
      switch (jobName) {
        case "billing.stripe-event.process.v1":
          return processStripeWebhookJob(
            parseJobPayload("billing.stripe-event.process.v1", data),
          );
        case "notification.email.send.v1":
          return processEmailDelivery(
            parseJobPayload("notification.email.send.v1", data).deliveryId,
          );
      }
    })();

    return await processing;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new UnrecoverableError("Job payload validation failed.");
    }
    throw error;
  }
}
