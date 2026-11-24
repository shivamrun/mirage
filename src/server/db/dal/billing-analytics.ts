import { randomUUID } from "node:crypto";
import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { BillingAnalyticsEvent } from "@/adapters/analytics/events";
import db from "@/server/db";
import { billingAnalytics } from "@/server/db/schema/billing-analytics";

export async function insertBillingAnalytics(
  key: string,
  event: BillingAnalyticsEvent,
  occurredAt: Date,
) {
  await db
    .insert(billingAnalytics)
    .values({ key, event, occurredAt })
    .onConflictDoNothing();
}

export function claimBillingAnalytics() {
  return db.transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .select()
      .from(billingAnalytics)
      .where(
        and(
          isNotNull(billingAnalytics.event),
          lte(billingAnalytics.availableAt, now),
        ),
      )
      .orderBy(asc(billingAnalytics.availableAt))
      .limit(1)
      .for("update", { skipLocked: true });
    if (!row?.event) return null;

    const claimToken = randomUUID();
    const attempts = row.attempts + 1;
    await tx
      .update(billingAnalytics)
      .set({
        attempts,
        availableAt: new Date(now.getTime() + 60_000),
        claimToken,
      })
      .where(eq(billingAnalytics.key, row.key));
    return { ...row, event: row.event, claimToken, attempts };
  });
}

export async function completeBillingAnalytics(
  claim: { key: string; claimToken: string; attempts: number },
  delivered: boolean,
) {
  const delay = Math.min(3600, 2 ** claim.attempts * 15);
  await db
    .update(billingAnalytics)
    .set(
      delivered
        ? { event: null, deliveredAt: new Date(), claimToken: null }
        : {
            availableAt: sql`now() + ${delay} * interval '1 second'`,
            claimToken: null,
          },
    )
    .where(
      and(
        eq(billingAnalytics.key, claim.key),
        eq(billingAnalytics.claimToken, claim.claimToken),
      ),
    );
}
