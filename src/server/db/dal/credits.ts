import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import db, { type DBClient } from "@/server/db";
import {
  creditAccounts,
  creditLedgerEntries,
  creditPeriodGrants,
  subscription,
  user,
} from "@/server/db/schema";

export type CreditTransaction = DBClient;
export type LedgerEntry = typeof creditLedgerEntries.$inferSelect;
export type CreditAccount = typeof creditAccounts.$inferSelect;
export type SubscriptionRecord = typeof subscription.$inferSelect;
export type UserRecord = typeof user.$inferSelect;

export function withCreditTransaction<T>(
  callback: (tx: CreditTransaction) => Promise<T>,
) {
  return db.transaction(callback);
}

export async function findCreditUser(
  userId: string,
  tx: CreditTransaction = db,
) {
  const [record] = await tx.select().from(user).where(eq(user.id, userId));
  return record ?? null;
}

export async function findCurrentPaidSubscription(
  userId: string,
  statuses: readonly string[],
  tx: CreditTransaction = db,
) {
  const now = new Date();
  const [record] = await tx
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, userId),
        inArray(subscription.status, [...statuses]),
        lte(subscription.periodStart, now),
        gt(subscription.periodEnd, now),
      ),
    )
    .orderBy(desc(subscription.periodEnd), desc(subscription.periodStart))
    .limit(1);
  return record ?? null;
}

export async function lockCreditAccount(userId: string, tx: CreditTransaction) {
  await tx
    .insert(creditAccounts)
    .values({ userId })
    .onConflictDoNothing({ target: creditAccounts.userId });
  await tx.execute(sql`
    select ${creditAccounts.userId}
    from ${creditAccounts}
    where ${creditAccounts.userId} = ${userId}
    for update
  `);
  const [account] = await tx
    .select()
    .from(creditAccounts)
    .where(eq(creditAccounts.userId, userId));
  if (!account) throw new Error("Credit account could not be initialized.");
  return account;
}

export async function findLedgerEntryByIdempotencyKey(
  idempotencyKey: string,
  tx: CreditTransaction,
) {
  const [entry] = await tx
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.idempotencyKey, idempotencyKey));
  return entry ?? null;
}

export async function insertCreditLedgerEntry(
  values: typeof creditLedgerEntries.$inferInsert,
  tx: CreditTransaction,
) {
  const [entry] = await tx
    .insert(creditLedgerEntries)
    .values(values)
    .returning();
  return entry;
}

export async function updateCreditAccount(
  userId: string,
  values: Partial<typeof creditAccounts.$inferInsert>,
  tx: CreditTransaction,
) {
  await tx
    .update(creditAccounts)
    .set(values)
    .where(eq(creditAccounts.userId, userId));
}

export async function findLatestCreditLedgerEntry(
  userId: string,
  tx: CreditTransaction,
) {
  const [entry] = await tx
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.userId, userId))
    .orderBy(
      desc(creditLedgerEntries.periodEnd),
      desc(creditLedgerEntries.createdAt),
    )
    .limit(1);
  return entry ?? null;
}

export async function findCreditPeriodGrant(
  periodKey: string,
  tx: CreditTransaction,
) {
  const [grant] = await tx
    .select()
    .from(creditPeriodGrants)
    .where(eq(creditPeriodGrants.periodKey, periodKey));
  return grant ?? null;
}

export async function upsertCreditPeriodGrant(
  values: typeof creditPeriodGrants.$inferInsert,
  tx: CreditTransaction,
) {
  await tx
    .insert(creditPeriodGrants)
    .values(values)
    .onConflictDoUpdate({
      target: creditPeriodGrants.periodKey,
      set: {
        allowance: values.allowance,
        periodEnd: values.periodEnd,
        periodStart: values.periodStart,
        plan: values.plan,
        subscriptionId: values.subscriptionId,
      },
    });
}

export async function findSpendLedgerEntry(
  entryId: string,
  userId: string,
  tx: CreditTransaction,
) {
  const [entry] = await tx
    .select()
    .from(creditLedgerEntries)
    .where(
      and(
        eq(creditLedgerEntries.id, entryId),
        eq(creditLedgerEntries.userId, userId),
        eq(creditLedgerEntries.type, "spend"),
      ),
    );
  return entry ?? null;
}

export async function sumCreditRefunds(
  spendEntryId: string,
  tx: CreditTransaction,
) {
  const [total] = await tx
    .select({
      amount: sql<number>`coalesce(sum(abs(${creditLedgerEntries.amount})), 0)`,
    })
    .from(creditLedgerEntries)
    .where(
      and(
        eq(creditLedgerEntries.reversesLedgerEntryId, spendEntryId),
        eq(creditLedgerEntries.type, "refund"),
      ),
    );
  return Number(total?.amount ?? 0);
}

export function listRecentCreditLedger(
  userId: string,
  limit: number,
  tx: CreditTransaction,
) {
  return tx
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.userId, userId))
    .orderBy(desc(creditLedgerEntries.createdAt))
    .limit(limit);
}
