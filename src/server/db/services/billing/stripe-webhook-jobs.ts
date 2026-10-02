import { getJobQueue } from "@/adapters/jobs/queues";
import {
  type StripeCheckoutSession,
  type StripeSubscription,
  stripeBillingProvider,
} from "@/adapters/stripe/billing-provider";
import { getBillingSubscriptionByStripeSubscriptionId } from "@/server/db/dal/billing";
import {
  claimStripeWebhookEvent,
  createOrGetStripeWebhookEvent,
  getStripeWebhookEvent,
  listRecoverableStripeWebhookEvents,
  markStripeWebhookEventCompleted,
  markStripeWebhookEventFailed,
  markStripeWebhookEventRetrying,
  recordStripeWebhookLifecycleTransition,
} from "@/server/db/dal/stripe-webhook-events";
import {
  handlePaymentFailedInvoice,
  handleSubscriptionCanceled,
  handleSubscriptionStarted,
  handleSubscriptionUpdated,
} from "@/server/db/services/billing/lifecycle-events";
import { applySubscriptionStateFromStripeEvent } from "@/server/db/services/billing/stripe-subscriptions";
import { grantCreditTopUpForCheckoutSession } from "@/server/db/services/credits/top-up";
import { enqueueJob } from "@/server/jobs/enqueue";
import { type JobPayload, jobQueueNames } from "@/server/jobs/registry";

type DurableStripeEventType =
  JobPayload<"billing.stripe-event.process.v1">["eventType"];

function sanitizedError(error: unknown) {
  return {
    kind: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown job failure.",
  };
}

class StripeWebhookJobError extends Error {
  constructor(
    message: string,
    readonly processingToken: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StripeWebhookJobError";
  }
}

function isCancellationScheduledTransition(
  stripeEvent: Awaited<ReturnType<typeof stripeBillingProvider.retrieveEvent>>,
  stripeSubscription: StripeSubscription,
) {
  const previous = stripeEvent?.data.previous_attributes as
    | { cancel_at_period_end?: unknown }
    | undefined;
  return (
    previous?.cancel_at_period_end === false &&
    stripeSubscription.cancel_at_period_end === true
  );
}

export async function recoverPendingStripeWebhookJobs() {
  const events = await listRecoverableStripeWebhookEvents();
  const results = await Promise.allSettled(
    events.map((event) =>
      enqueueJob(
        "billing.stripe-event.process.v1",
        {
          eventId: event.stripeEventId,
          eventType: event.eventType as DurableStripeEventType,
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
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((result) => result.reason),
      "Unable to recover one or more pending Stripe webhook jobs.",
    );
  }
}

export async function enqueueStripeWebhookJob({
  eventId,
  eventType,
  objectId,
}: {
  eventId: string;
  eventType: DurableStripeEventType;
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

  const claimed = await claimStripeWebhookEvent(payload.eventId);
  if (!claimed) return { skipped: true };
  const processingToken = claimed.processingToken;
  if (!processingToken) {
    throw new Error("Stripe webhook claim has no processing token.");
  }

  try {
    const stripeEvent = await stripeBillingProvider.retrieveEvent(
      payload.eventId,
    );
    if (!stripeEvent) {
      throw new Error("Stripe webhook event could not be retrieved.");
    }
    const eventObject = stripeEvent.data.object as { id?: unknown } | undefined;
    if (
      stripeEvent.type !== payload.eventType ||
      eventObject?.id !== payload.objectId
    ) {
      throw new Error("Stripe webhook event does not match its inbox record.");
    }

    if (
      payload.eventType === "checkout.session.completed" ||
      payload.eventType === "checkout.session.async_payment_succeeded"
    ) {
      const session = await stripeBillingProvider.retrieveCheckoutSession(
        payload.objectId,
      );
      await grantCreditTopUpForCheckoutSession(
        session as StripeCheckoutSession,
      );
    } else if (payload.eventType === "invoice.payment_failed") {
      const invoice = await stripeBillingProvider.retrieveInvoice(
        payload.objectId,
      );
      await handlePaymentFailedInvoice(invoice, payload.eventId);
    } else {
      const localSubscription =
        await getBillingSubscriptionByStripeSubscriptionId(payload.objectId);
      if (!localSubscription) {
        throw new Error("Billing subscription record was not found.");
      }
      const stripeSubscription = stripeEvent.data.object as StripeSubscription;
      const { applied, eventSubscription } =
        await applySubscriptionStateFromStripeEvent({
          eventCreatedAt: stripeEvent.created,
          localSubscription,
          stripeSubscription,
        });
      if (payload.eventType === "customer.subscription.created") {
        if (applied) await handleSubscriptionStarted(eventSubscription);
      } else if (applied) {
        await handleSubscriptionUpdated(eventSubscription);
      }
      if (
        payload.eventType === "customer.subscription.updated" &&
        isCancellationScheduledTransition(stripeEvent, stripeSubscription)
      ) {
        const recorded = await recordStripeWebhookLifecycleTransition({
          processingToken,
          stripeEventId: payload.eventId,
        });
        if (recorded) {
          await handleSubscriptionCanceled(eventSubscription);
        }
      }
    }
    const completed = await markStripeWebhookEventCompleted({
      processingToken,
      stripeEventId: payload.eventId,
    });
    return { skipped: !completed };
  } catch (error) {
    const failure = sanitizedError(error);
    await markStripeWebhookEventRetrying({
      errorKind: failure.kind,
      errorMessage: failure.message,
      processingToken,
      stripeEventId: payload.eventId,
    });
    throw new StripeWebhookJobError(failure.message, processingToken, {
      cause: error,
    });
  }
}

export async function finalizeStripeWebhookJobFailure({
  error,
  payload,
}: {
  error: Error;
  payload: JobPayload<"billing.stripe-event.process.v1">;
}) {
  if (!(error instanceof StripeWebhookJobError)) return;
  await markStripeWebhookEventFailed({
    errorKind: error.name,
    errorMessage: error.message,
    processingToken: error.processingToken,
    stripeEventId: payload.eventId,
  });
}
