import { randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

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

export async function claimStripeWebhookEvent(stripeEventId: string) {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  const processingToken = randomUUID();
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({
      attemptCount: sql`${stripeWebhookEvents.attemptCount} + 1`,
      lastErrorKind: null,
      lastErrorMessage: null,
      processingStartedAt: new Date(),
      processingToken,
      status: "processing",
    })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, stripeEventId),
        or(
          eq(stripeWebhookEvents.status, "pending"),
          eq(stripeWebhookEvents.status, "failed"),
          and(
            eq(stripeWebhookEvents.status, "processing"),
            or(
              isNull(stripeWebhookEvents.processingStartedAt),
              lt(stripeWebhookEvents.processingStartedAt, staleBefore),
            ),
          ),
        ),
      ),
    )
    .returning();

  return event ?? null;
}

export async function markStripeWebhookEventCompleted({
  processingToken,
  stripeEventId,
}: {
  processingToken: string;
  stripeEventId: string;
}) {
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: null,
      lastErrorMessage: null,
      processedAt: new Date(),
      processingStartedAt: null,
      processingToken: null,
      status: "completed",
    })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, stripeEventId),
        eq(stripeWebhookEvents.processingToken, processingToken),
        eq(stripeWebhookEvents.status, "processing"),
      ),
    )
    .returning();
  return event ?? null;
}

export async function markStripeWebhookEventFailed({
  errorKind,
  errorMessage,
  processingToken,
  stripeEventId,
}: {
  errorKind: string;
  errorMessage: string;
  processingToken: string;
  stripeEventId: string;
}) {
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: errorKind,
      lastErrorMessage: errorMessage.slice(0, 500),
      processingStartedAt: null,
      processingToken: null,
      status: "failed",
    })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, stripeEventId),
        eq(stripeWebhookEvents.processingToken, processingToken),
      ),
    )
    .returning();
  return event ?? null;
}

export async function markStripeWebhookEventRetrying({
  errorKind,
  errorMessage,
  processingToken,
  stripeEventId,
}: {
  errorKind: string;
  errorMessage: string;
  processingToken: string;
  stripeEventId: string;
}) {
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({
      lastErrorKind: errorKind,
      lastErrorMessage: errorMessage.slice(0, 500),
      processingStartedAt: null,
      status: "pending",
    })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, stripeEventId),
        eq(stripeWebhookEvents.processingToken, processingToken),
        eq(stripeWebhookEvents.status, "processing"),
      ),
    )
    .returning();
  return event ?? null;
}

export async function recordStripeWebhookLifecycleTransition({
  processingToken,
  stripeEventId,
}: {
  processingToken: string;
  stripeEventId: string;
}) {
  const [event] = await db
    .update(stripeWebhookEvents)
    .set({ lifecycleRecordedAt: new Date() })
    .where(
      and(
        eq(stripeWebhookEvents.stripeEventId, stripeEventId),
        eq(stripeWebhookEvents.processingToken, processingToken),
        eq(stripeWebhookEvents.status, "processing"),
        isNull(stripeWebhookEvents.lifecycleRecordedAt),
      ),
    )
    .returning();
  return event ?? null;
}
