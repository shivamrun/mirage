import { asc, eq } from "drizzle-orm";

import db from "@/server/db";
import { billingPlan } from "@/server/db/schema";
import type {
  AdminBillingPlanMutationValues,
  AdminUpdateBillingPlanValues,
} from "@/shared/schemas";

export type BillingPlanRecord = typeof billingPlan.$inferSelect;

const billingPlanReturning = {
  active: billingPlan.active,
  benefits: billingPlan.benefits,
  createdAt: billingPlan.createdAt,
  description: billingPlan.description,
  entitlements: billingPlan.entitlements,
  group: billingPlan.group,
  id: billingPlan.id,
  limits: billingPlan.limits,
  name: billingPlan.name,
  sortOrder: billingPlan.sortOrder,
  stripeAnnualDiscountPriceId: billingPlan.stripeAnnualDiscountPriceId,
  stripePriceId: billingPlan.stripePriceId,
  updatedAt: billingPlan.updatedAt,
};

export function listActiveBillingPlans() {
  return db
    .select()
    .from(billingPlan)
    .where(eq(billingPlan.active, true))
    .orderBy(asc(billingPlan.sortOrder), asc(billingPlan.name));
}

export function listBillingPlans() {
  return db
    .select(billingPlanReturning)
    .from(billingPlan)
    .orderBy(asc(billingPlan.sortOrder), asc(billingPlan.name));
}

export async function createBillingPlan(
  values: AdminBillingPlanMutationValues,
) {
  const [plan] = await db
    .insert(billingPlan)
    .values(values)
    .returning(billingPlanReturning);

  return plan ?? null;
}

export async function updateBillingPlan({
  id,
  values,
}: {
  id: string;
  values: AdminUpdateBillingPlanValues;
}) {
  const [plan] = await db
    .update(billingPlan)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(billingPlan.id, id))
    .returning(billingPlanReturning);

  return plan ?? null;
}
