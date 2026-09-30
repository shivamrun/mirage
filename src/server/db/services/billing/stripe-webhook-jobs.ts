import type Stripe from "stripe";

import { getJobQueue } from "@/adapters/jobs/queues";
import {
  createOrGetStripeWebhookEvent,
  getStripeWebhookEvent,
  listPendingStripeWebhookEvents,
  markStripeWebhookEventCompleted,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessing,
  markStripeWebhookEventRetrying,
} from "@/server/db/dal/stripe-webhook-events";
import { getBillingStripeClient } from "@/server/db/services/billing/stripe-client";
import { grantCreditTopUpForCheckoutSession } from "@/server/db/services/credits/top-up";
import { enqueueJob } from "@/server/jobs/enqueue";
import { type JobPayload, jobQueueNames } from "@/server/jobs/registry";

type StripeTopUpEventType =
  JobPayload<"billing.stripe-event.process.v1">["eventType"];

function sanitizedError(error: unknown) {
  return {
    kind: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown job failure.",
  };
}

export async function recoverPendingStripeWebhookJobs() {
  const events = await listPendingStripeWebhookEvents();
  const results = await Promise.allSettled(
    events.map((event) =>
      enqueueJob(
        "billing.stripe-event.process.v1",
        {
          eventId: event.stripeEventId,
          eventType: event.eventType as StripeTopUpEventType,
          objectId: event.objectId,
        },
        { jobId: `stripe-${event.stripeEventId.replaceAll(":", "-")}` },
      ),
    ),
  );
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        JSON.stringify({
          error:
            result.reason instanceof Error
              ? result.reason.name
              : "UnknownError",
          event: "stripe_webhook_job_recovery_failed",
        }),
      );
    }
  }
}

export async function enqueueStripeWebhookJob({
  eventId,
  eventType,
  objectId,
}: {
  eventId: string;
  eventType: StripeTopUpEventType;
  objectId: string;
}) {
  const record = await createOrGetStripeWebhookEvent({
    eventType,
    objectId,
    stripeEventId: eventId,
  });

  if (record.status === "completed") return record;

  const jobId = `stripe-${eventId.replaceAll(":", "-")}`;
  if (record.status === "failed") {
    const job = await getJobQueue(jobQueueNames.billing).getJob(jobId);
    if (job && (await job.getState()) === "failed") {
      await job.retry("failed", { resetAttemptsMade: true });
      return record;
    }
  }

  await enqueueJob(
    "billing.stripe-event.process.v1",
    { eventId, eventType, objectId },
    { jobId },
  );

  return record;
}

export async function processStripeWebhookJob(
  payload: JobPayload<"billing.stripe-event.process.v1">,
) {
  const existing = await getStripeWebhookEvent(payload.eventId);
  if (!existing) throw new Error("Stripe webhook inbox record was not found.");
  if (existing.status === "completed") return { skipped: true };

  await markStripeWebhookEventProcessing(payload.eventId);

  try {
    const session = await getBillingStripeClient().checkout.sessions.retrieve(
      payload.objectId,
    );
    await grantCreditTopUpForCheckoutSession(
      session as Stripe.Checkout.Session,
    );
    await markStripeWebhookEventCompleted(payload.eventId);
    return { skipped: false };
  } catch (error) {
    const failure = sanitizedError(error);
    await markStripeWebhookEventRetrying({
      errorKind: failure.kind,
      errorMessage: failure.message,
      stripeEventId: payload.eventId,
    });
    throw error instanceof Error ? error : new Error(failure.message);
  }
}

export async function finalizeStripeWebhookJobFailure({
  error,
  payload,
}: {
  error: Error;
  payload: JobPayload<"billing.stripe-event.process.v1">;
}) {
  await markStripeWebhookEventFailed({
    errorKind: error.name,
    errorMessage: error.message,
    stripeEventId: payload.eventId,
  });
}
