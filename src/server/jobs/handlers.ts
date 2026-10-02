import {
  prepareAccountDataExport,
  processAccountDeletion,
  recoverAccountDeletionWork,
  recoverAccountExportWork,
} from "@/server/db/services/account-deletion/lifecycle";
import { listBillingSubscriptionsForReconciliation } from "@/server/db/services/billing/overview";
import { reconcileBillingSubscription } from "@/server/db/services/billing/stripe-subscriptions";
import {
  finalizeStripeWebhookJobFailure,
  processStripeWebhookJob,
  recoverPendingStripeWebhookJobs,
} from "@/server/db/services/billing/stripe-webhook-jobs";
import {
  finalizeEmailDeliveryFailure,
  processEmailDelivery,
  recoverPendingEmailDeliveries,
} from "@/server/db/services/notifications/email-delivery";
import { enqueueJob } from "./enqueue";
import type { JobName, JobPayload } from "./registry";
import { jobDefinitions, parseJobPayload } from "./registry";

type JobHandlerMap = {
  [Name in JobName]: (payload: JobPayload<Name>) => Promise<unknown>;
};

const RECONCILIATION_PAGE_SIZE = 100;

function utcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export const jobHandlers = {
  "account.deletion.process.v1": ({ deletionId }) =>
    processAccountDeletion(deletionId),
  "account.data-export.prepare.v1": ({ exportId }) =>
    prepareAccountDataExport(exportId),
  "billing.stripe-event.process.v1": processStripeWebhookJob,
  "billing.subscription-reconciliation.scan.v1": async ({ cursor, runId }) => {
    const subscriptions = await listBillingSubscriptionsForReconciliation({
      afterId: cursor,
      limit: RECONCILIATION_PAGE_SIZE,
    });
    const runKey = runId ?? utcDateKey();

    await Promise.all(
      subscriptions.map((subscription) =>
        enqueueJob(
          "billing.subscription.reconcile.v1",
          { subscriptionId: subscription.id },
          { jobId: `billing-reconcile-${subscription.id}-${runKey}` },
        ),
      ),
    );

    if (subscriptions.length === RECONCILIATION_PAGE_SIZE) {
      const nextCursor = subscriptions.at(-1)?.id;
      if (nextCursor) {
        await enqueueJob(
          "billing.subscription-reconciliation.scan.v1",
          { cursor: nextCursor, runId: runKey },
          { jobId: `billing-reconcile-scan-${nextCursor}-${runKey}` },
        );
      }
    }

    return { enqueued: subscriptions.length };
  },
  "billing.subscription.reconcile.v1": ({ subscriptionId }) =>
    reconcileBillingSubscription(subscriptionId),
  "notification.email.send.v1": ({ deliveryId }) =>
    processEmailDelivery(deliveryId),
  "system.pending-work.recover.v1": async () => {
    const results = await Promise.allSettled([
      recoverAccountDeletionWork(),
      recoverAccountExportWork(),
      recoverPendingStripeWebhookJobs(),
      recoverPendingEmailDeliveries(),
    ]);
    const rejected = results.filter((result) => result.status === "rejected");
    if (rejected.length > 0) {
      throw new AggregateError(
        rejected.map((result) => result.reason),
        "One or more pending-work recovery operations failed.",
      );
    }
  },
} satisfies JobHandlerMap;

type FailureHandlerMap = Partial<{
  [Name in JobName]: (payload: JobPayload<Name>, error: Error) => Promise<void>;
}>;

export const jobFailureHandlers = {
  "billing.stripe-event.process.v1": (payload, error) =>
    finalizeStripeWebhookJobFailure({ error, payload }),
  "notification.email.send.v1": ({ deliveryId }, error) =>
    finalizeEmailDeliveryFailure({ deliveryId, error }),
} satisfies FailureHandlerMap;

export async function finalizeJobFailure({
  data,
  error,
  name,
}: {
  data: unknown;
  error: Error;
  name: string;
}) {
  if (!(name in jobDefinitions)) return;
  const jobName = name as JobName;
  const handler = (
    jobFailureHandlers as Partial<
      Record<JobName, (payload: unknown, failure: Error) => Promise<void>>
    >
  )[jobName];
  if (!handler) return;
  await handler(parseJobPayload(jobName, data), error);
}
