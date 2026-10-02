import { and, asc, desc, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";

import db from "@/server/db";
import { subscription } from "@/server/db/schema";

export type BillingSubscriptionRecord = typeof subscription.$inferSelect;
export type BillingSubscriptionUpdate = Partial<
  Pick<
    BillingSubscriptionRecord,
    | "billingInterval"
    | "cancelAt"
    | "cancelAtPeriodEnd"
    | "canceledAt"
    | "endedAt"
    | "periodEnd"
    | "periodStart"
    | "plan"
    | "seats"
    | "status"
    | "stripeScheduleId"
    | "stripeCustomerId"
    | "stripeEventCreatedAt"
    | "stripeSubscriptionId"
  >
>;

export async function getBillingSubscriptionById(id: string) {
  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.id, id))
    .limit(1);

  return record ?? null;
}

export async function listStripeSubscriptionsForReconciliation({
  afterId,
  limit,
}: {
  afterId?: string;
  limit: number;
}) {
  return db
    .select()
    .from(subscription)
    .where(
      and(
        isNotNull(subscription.stripeSubscriptionId),
        afterId ? gt(subscription.id, afterId) : undefined,
      ),
    )
    .orderBy(asc(subscription.id))
    .limit(limit);
}

export async function getBillingSubscriptionsByUserId(userId: string) {
  return db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, userId))
    .orderBy(desc(subscription.periodEnd), desc(subscription.periodStart));
}

export async function getBillingSubscriptionByStripeCustomerId(
  stripeCustomerId: string,
) {
  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeCustomerId, stripeCustomerId))
    .orderBy(desc(subscription.periodEnd), desc(subscription.periodStart))
    .limit(1);

  return record ?? null;
}

export async function getBillingSubscriptionByStripeSubscriptionId(
  stripeSubscriptionId: string,
) {
  const [record] = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);

  return record ?? null;
}

export async function updateBillingSubscription(
  id: string,
  values: BillingSubscriptionUpdate,
) {
  const [updatedSubscription] = await db
    .update(subscription)
    .set(values)
    .where(eq(subscription.id, id))
    .returning();

  return updatedSubscription ?? null;
}

export async function applyBillingSubscriptionStripeEvent({
  eventCreatedAt,
  id,
  values,
}: {
  eventCreatedAt: number;
  id: string;
  values: BillingSubscriptionUpdate;
}) {
  const [updatedSubscription] = await db
    .update(subscription)
    .set({ ...values, stripeEventCreatedAt: eventCreatedAt })
    .where(
      and(
        eq(subscription.id, id),
        or(
          isNull(subscription.stripeEventCreatedAt),
          lt(subscription.stripeEventCreatedAt, eventCreatedAt),
        ),
      ),
    )
    .returning();

  return updatedSubscription ?? null;
}
