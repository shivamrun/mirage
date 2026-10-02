import { and, eq } from "drizzle-orm";
import db from "@/server/db";
import { billingCreditPurchases } from "@/server/db/schema";

export type BillingCreditPurchase = typeof billingCreditPurchases.$inferSelect;

export async function createOrGetCreditPurchase(
  input: Pick<
    typeof billingCreditPurchases.$inferInsert,
    "amount" | "credits" | "currency" | "packageKey" | "requestId" | "userId"
  >,
) {
  const [created] = await db
    .insert(billingCreditPurchases)
    .values(input)
    .onConflictDoNothing({ target: billingCreditPurchases.requestId })
    .returning();
  if (created) return created;

  const [existing] = await db
    .select()
    .from(billingCreditPurchases)
    .where(eq(billingCreditPurchases.requestId, input.requestId))
    .limit(1);
  if (!existing) throw new Error("Billing purchase conflict was not resolved.");
  if (
    existing.userId !== input.userId ||
    existing.packageKey !== input.packageKey ||
    existing.amount !== input.amount ||
    existing.currency !== input.currency ||
    existing.credits !== input.credits
  ) {
    throw new Error(
      "Billing purchase request ID was reused with different data.",
    );
  }
  return existing;
}

export async function getCreditPurchaseByCheckoutSessionId(sessionId: string) {
  const [purchase] = await db
    .select()
    .from(billingCreditPurchases)
    .where(eq(billingCreditPurchases.stripeCheckoutSessionId, sessionId))
    .limit(1);
  return purchase ?? null;
}

export async function markCreditPurchaseCheckoutCreated({
  purchaseId,
  sessionId,
}: {
  purchaseId: string;
  sessionId: string;
}) {
  const [purchase] = await db
    .update(billingCreditPurchases)
    .set({ status: "checkout_created", stripeCheckoutSessionId: sessionId })
    .where(
      and(
        eq(billingCreditPurchases.id, purchaseId),
        eq(billingCreditPurchases.status, "pending"),
      ),
    )
    .returning();
  return purchase ?? null;
}

export async function markCreditPurchasePaid({
  paymentIntentId,
  purchaseId,
}: {
  paymentIntentId?: null | string;
  purchaseId: string;
}) {
  await db
    .update(billingCreditPurchases)
    .set({
      paidAt: new Date(),
      status: "paid",
      stripePaymentIntentId: paymentIntentId ?? undefined,
    })
    .where(eq(billingCreditPurchases.id, purchaseId));
}

export async function markCreditPurchaseFulfilled(purchaseId: string) {
  await db
    .update(billingCreditPurchases)
    .set({ fulfilledAt: new Date(), status: "fulfilled" })
    .where(eq(billingCreditPurchases.id, purchaseId));
}
