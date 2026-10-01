import { z } from "zod";

export const jobQueueNames = {
  billing: "billing",
  default: "default",
} as const;

const stripeEventTypes = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
] as const;

export const jobDefinitions = {
  "account.deletion.process.v1": {
    attempts: 8,
    backoff: { delay: 30_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({ deletionId: z.uuid() }),
    priority: 1,
    queue: jobQueueNames.default,
  },
  "account.data-export.prepare.v1": {
    attempts: 8,
    backoff: { delay: 30_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({ exportId: z.uuid() }),
    priority: 5,
    queue: jobQueueNames.default,
  },
  "billing.subscription-reconciliation.scan.v1": {
    attempts: 5,
    backoff: { delay: 10_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({
      cursor: z.string().trim().min(1).optional(),
      runId: z.string().trim().min(1).optional(),
    }),
    priority: 10,
    queue: jobQueueNames.billing,
  },
  "billing.subscription.reconcile.v1": {
    attempts: 5,
    backoff: { delay: 10_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({ subscriptionId: z.string().trim().min(1) }),
    priority: 10,
    queue: jobQueueNames.billing,
  },
  "billing.stripe-event.process.v1": {
    attempts: 8,
    backoff: { delay: 5_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({
      eventId: z.string().trim().min(1),
      eventType: z.enum(stripeEventTypes),
      objectId: z.string().trim().min(1),
    }),
    priority: 1,
    queue: jobQueueNames.billing,
  },
  "notification.email.send.v1": {
    attempts: 6,
    backoff: { delay: 5_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({ deliveryId: z.uuid() }),
    priority: 5,
    queue: jobQueueNames.default,
  },
  "system.pending-work.recover.v1": {
    attempts: 3,
    backoff: { delay: 5_000, jitter: 0.2, type: "exponential" as const },
    payloadSchema: z.object({}),
    priority: 20,
    queue: jobQueueNames.default,
  },
} as const;

export type JobName = keyof typeof jobDefinitions;
export type JobPayload<Name extends JobName> = z.infer<
  (typeof jobDefinitions)[Name]["payloadSchema"]
>;

export function parseJobPayload<Name extends JobName>(
  name: Name,
  payload: unknown,
): JobPayload<Name> {
  return jobDefinitions[name].payloadSchema.parse(payload) as JobPayload<Name>;
}
