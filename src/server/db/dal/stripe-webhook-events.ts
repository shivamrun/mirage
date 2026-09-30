import { asc, eq, sql } from "drizzle-orm";

import db from "@/server/db";
import { stripeWebhookEvents } from "@/server/db/schema";

type StripeWebhookEventInsert = Pick<
  typeof stripeWebhookEvents.$inferInsert,
  "eventType" | "objectId" | "stripeEventId"
>;

export async function createOrGetStripeWebhookEvent(
  input: StripeWebhookEventInsert,
) {
  const [created] = await db
    .insert(stripeWebhookEvents)
    .values(input)
    .onConflictDoNothing({ target: stripeWebhookEvents.stripeEventId })
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, input.stripeEventId))
    .limit(1);

  if (!existing) {
    throw new Error("Stripe webhook event conflict could not be resolved.");
  }

  if (
    existing.eventType !== input.eventType ||
    existing.objectId !== input.objectId
  ) {
    throw new Error("Stripe webhook event ID was reused with different data.");
  }

  return existing;
}

export async function getStripeWebhookEvent(stripeEventId: string) {
  const [event] = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
    .limit(1);

  return event ?? null;
}

export function listPendingStripeWebhookEvents(limit = 100) {
  return db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.status, "pending"))
    .orderBy(asc(stripeWebhookEvents.createdAt))
    .limit(limit);
}

export async function markStripeWebhookEventProcessing(stripeEventId: string) {
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({
      attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
      lastErrorKind: null,
      lastErrorMessage: null,
      status: "processing",
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId))
    .returning();

  return event ?? null;
}

export async function markStripeWebhookEventCompleted(stripeEventId: string) {
  await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: null,
      lastErrorMessage: null,
      processedAt: new Date(),
      status: "completed",
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
}

export async function markStripeWebhookEventFailed({
  errorKind,
  errorMessage,
  stripeEventId,
}: {
  errorKind: string;
  errorMessage: string;
  stripeEventId: string;
}) {
  await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: errorKind,
      lastErrorMessage: errorMessage.slice(0, 500),
      status: "failed",
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
}

export async function markStripeWebhookEventRetrying({
  errorKind,
  errorMessage,
  stripeEventId,
}: {
  errorKind: string;
  errorMessage: string;
  stripeEventId: string;
}) {
  await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: errorKind,
      lastErrorMessage: errorMessage.slice(0, 500),
      status: "pending",
    })
    .where(eq(stripeWebhookEvents.stripeEventId, stripeEventId));
}
