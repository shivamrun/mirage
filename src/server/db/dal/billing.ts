import { desc, eq } from "drizzle-orm";

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
    | "stripeSubscriptionId"
  >
>;

export async function getBillingSubscriptionsByUserId(userId: string) {
  return db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, userId))
    .orderBy(desc(subscription.periodEnd), desc(subscription.periodStart));
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
