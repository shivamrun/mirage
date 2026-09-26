import { and, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";

import { subscriptionPlans } from "@/features/auth/better-auth/subscription-plans";
import db, { type DBClient } from "@/server/db";
import {
  creditAccounts,
  creditLedgerEntries,
  creditPeriodGrants,
  subscription,
  user,
} from "@/server/db/schema";
import { invalidateCreditBalanceCache } from "./cache";

const activeSubscriptionStatuses = ["active", "trialing"] as const;
const freePlanKey = "free";
const defaultRecentLedgerLimit = 20;

export class InsufficientCreditsError extends Error {
  constructor(
    readonly availableCredits: number,
    readonly requestedCredits: number,
  ) {
    super("Insufficient credits.");
    this.name = "InsufficientCreditsError";
  }
}

export class CreditIdempotencyConflictError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(
      "Credit ledger idempotency key was reused for a different operation.",
    );
    this.name = "CreditIdempotencyConflictError";
  }
}

type LedgerEntry = typeof creditLedgerEntries.$inferSelect;
type CreditAccount = typeof creditAccounts.$inferSelect;
type SubscriptionRecord = typeof subscription.$inferSelect;
type UserRecord = typeof user.$inferSelect;
type SubscriptionGrantRecord = Pick<
  SubscriptionRecord,
  "id" | "plan" | "referenceId"
> & {
  periodEnd?: Date | null;
  periodStart?: Date | null;
  stripeSubscriptionId?: null | string;
};

type CreditPeriod = {
  allowance: number;
  key: string;
  periodEnd: Date;
  periodStart: Date;
  plan: string;
  subscriptionId: null | string;
};

type LedgerMetadata = Record<string, unknown>;

type CreditWriteOptions = {
  amount: number;
  carryForwardDelta?: number;
  idempotencyKey: string;
  metadata?: LedgerMetadata;
  periodEnd: Date;
  periodStart: Date;
  reversesLedgerEntryId?: string;
  source: string;
  sourceId?: null | string;
  type: LedgerEntry["type"];
  userId: string;
};

function assertPositiveInteger(amount: number, label: string) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function normalizePlanKey(value: null | string | undefined) {
  const normalized = value?.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const matchingPlan = subscriptionPlans.find((plan) => {
    const planKey =
      "limits" in plan &&
      typeof plan.limits === "object" &&
      plan.limits !== null &&
      "plan" in plan.limits &&
      typeof plan.limits.plan === "string"
        ? plan.limits.plan
        : null;

    return (
      plan.name.toLowerCase() === normalized ||
      planKey?.toLowerCase() === normalized
    );
  });

  if (
    matchingPlan &&
    "limits" in matchingPlan &&
    typeof matchingPlan.limits === "object" &&
    matchingPlan.limits !== null &&
    "plan" in matchingPlan.limits &&
    typeof matchingPlan.limits.plan === "string"
  ) {
    return matchingPlan.limits.plan;
  }

  return normalized;
}

function planAllowance(plan: string) {
  const normalizedPlan = normalizePlanKey(plan);
  const matchingPlan = subscriptionPlans.find((candidate) => {
    const candidatePlan =
      "limits" in candidate &&
      typeof candidate.limits === "object" &&
      candidate.limits !== null &&
      "plan" in candidate.limits &&
      typeof candidate.limits.plan === "string"
        ? candidate.limits.plan
        : candidate.name;

    return normalizePlanKey(candidatePlan) === normalizedPlan;
  });

  const credits =
    matchingPlan &&
    "limits" in matchingPlan &&
    typeof matchingPlan.limits === "object" &&
    matchingPlan.limits !== null &&
    "credits" in matchingPlan.limits
      ? matchingPlan.limits.credits
      : null;

  if (!Number.isInteger(credits) || Number(credits) < 0) {
    return 0;
  }

  return Number(credits);
}

function addMonthsClamped(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function freePeriodForUser(userRecord: UserRecord, now = new Date()) {
  let periodStart = new Date(userRecord.createdAt);
  let periodEnd = addMonthsClamped(periodStart, 1);

  while (periodEnd <= now) {
    periodStart = periodEnd;
    periodEnd = addMonthsClamped(periodStart, 1);
  }

  return {
    allowance: planAllowance(freePlanKey),
    key: `free:${userRecord.id}:${periodStart.toISOString()}`,
    periodEnd,
    periodStart,
    plan: freePlanKey,
    subscriptionId: null,
  } satisfies CreditPeriod;
}

function paidPeriodForSubscription(record: SubscriptionGrantRecord) {
  const plan = normalizePlanKey(record.plan) ?? record.plan;
  const periodStart = record.periodStart;
  const periodEnd = record.periodEnd;

  if (!periodStart || !periodEnd) {
    return null;
  }

  return {
    allowance: planAllowance(plan),
    key: `subscription:${record.id}:${periodStart.toISOString()}:${periodEnd.toISOString()}`,
    periodEnd,
    periodStart,
    plan,
    subscriptionId: record.stripeSubscriptionId ?? record.id,
  } satisfies CreditPeriod;
}

async function getUserRecord(userId: string, tx: DBClient = db) {
  const [record] = await tx.select().from(user).where(eq(user.id, userId));
  return record ?? null;
}

async function getCurrentPaidSubscription(userId: string, tx: DBClient = db) {
  const now = new Date();
  const [record] = await tx
    .select()
    .from(subscription)
    .where(
      and(
        eq(subscription.referenceId, userId),
        inArray(subscription.status, activeSubscriptionStatuses),
        lte(subscription.periodStart, now),
        gt(subscription.periodEnd, now),
      ),
    )
    .orderBy(desc(subscription.periodEnd), desc(subscription.periodStart))
    .limit(1);

  return record ?? null;
}

async function resolveCurrentPeriod(userId: string, tx: DBClient = db) {
  const paidSubscription = await getCurrentPaidSubscription(userId, tx);
  const paidPeriod = paidSubscription
    ? paidPeriodForSubscription(paidSubscription)
    : null;

  if (paidPeriod && paidPeriod.allowance > 0) {
    return paidPeriod;
  }

  const userRecord = await getUserRecord(userId, tx);
  if (!userRecord) {
    throw new Error("User not found.");
  }

  return freePeriodForUser(userRecord);
}

async function ensureCreditAccount(userId: string, tx: DBClient) {
  await tx
    .insert(creditAccounts)
    .values({ userId })
    .onConflictDoNothing({ target: creditAccounts.userId });
}

async function lockCreditAccount(userId: string, tx: DBClient) {
  await ensureCreditAccount(userId, tx);
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

  if (!account) {
    throw new Error("Credit account could not be initialized.");
  }

  return account;
}

function accountTotalsForEntry(
  account: CreditAccount,
  entry: CreditWriteOptions,
) {
  const nextAccount = {
    availableCredits: account.availableCredits + entry.amount,
    carryForwardCredits: account.carryForwardCredits,
    lifetimeExpired: account.lifetimeExpired,
    lifetimeGranted: account.lifetimeGranted,
    lifetimeSpent: account.lifetimeSpent,
  };

  if (typeof entry.carryForwardDelta === "number") {
    nextAccount.carryForwardCredits += entry.carryForwardDelta;
  }

  if (
    entry.type === "grant" ||
    entry.type === "manual_credit" ||
    entry.type === "top_up"
  ) {
    nextAccount.lifetimeGranted += entry.amount;
  }
  if (entry.type === "spend") {
    nextAccount.lifetimeSpent += Math.abs(entry.amount);
  }
  if (entry.type === "expire") {
    nextAccount.lifetimeExpired += Math.abs(entry.amount);
  }

  return nextAccount;
}

function spendMetadataForAccount(account: CreditAccount, amount: number) {
  const requestedCredits = Math.abs(amount);
  const carryForwardAvailable = Math.min(
    account.carryForwardCredits,
    account.availableCredits,
  );
  const periodCreditsAvailable = Math.max(
    0,
    account.availableCredits - carryForwardAvailable,
  );
  const periodCreditsSpent = Math.min(requestedCredits, periodCreditsAvailable);
  const carryForwardCreditsSpent = Math.max(
    0,
    requestedCredits - periodCreditsSpent,
  );

  return {
    carryForwardCreditsSpent,
    periodCreditsSpent,
  };
}

function readCarryForwardCreditsSpent(metadata: LedgerMetadata | null) {
  const value = metadata?.carryForwardCreditsSpent;
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 0;
}

function creditEntryForAccount(
  account: CreditAccount,
  entry: CreditWriteOptions,
) {
  if (entry.type === "spend") {
    const spendMetadata = spendMetadataForAccount(account, entry.amount);

    return {
      ...entry,
      carryForwardDelta: -spendMetadata.carryForwardCreditsSpent,
      metadata: {
        ...entry.metadata,
        ...spendMetadata,
      },
    };
  }

  return entry;
}

async function findEntryByIdempotencyKey(idempotencyKey: string, tx: DBClient) {
  const [entry] = await tx
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.idempotencyKey, idempotencyKey));

  return entry ?? null;
}

function assertMatchingIdempotentEntry(
  existing: LedgerEntry,
  nextEntry: CreditWriteOptions,
) {
  if (
    existing.amount !== nextEntry.amount ||
    existing.reversesLedgerEntryId !==
      (nextEntry.reversesLedgerEntryId ?? null) ||
    existing.source !== nextEntry.source ||
    existing.sourceId !== (nextEntry.sourceId ?? null) ||
    existing.type !== nextEntry.type ||
    existing.userId !== nextEntry.userId
  ) {
    throw new CreditIdempotencyConflictError(nextEntry.idempotencyKey);
  }
}

async function appendLedgerEntryWithResult(
  tx: DBClient,
  entry: CreditWriteOptions,
) {
  const existing = await findEntryByIdempotencyKey(entry.idempotencyKey, tx);
  if (existing) {
    assertMatchingIdempotentEntry(existing, entry);
    return { created: false, entry: existing };
  }

  const account = await lockCreditAccount(entry.userId, tx);
  const existingAfterLock = await findEntryByIdempotencyKey(
    entry.idempotencyKey,
    tx,
  );
  if (existingAfterLock) {
    assertMatchingIdempotentEntry(existingAfterLock, entry);
    return { created: false, entry: existingAfterLock };
  }

  const ledgerWrite = creditEntryForAccount(account, entry);
  const nextAccount = accountTotalsForEntry(account, ledgerWrite);

  if (nextAccount.availableCredits < 0 || nextAccount.carryForwardCredits < 0) {
    throw new InsufficientCreditsError(
      account.availableCredits,
      Math.abs(ledgerWrite.amount),
    );
  }

  const [ledgerEntry] = await tx
    .insert(creditLedgerEntries)
    .values({
      amount: ledgerWrite.amount,
      idempotencyKey: ledgerWrite.idempotencyKey,
      metadata: ledgerWrite.metadata,
      periodEnd: ledgerWrite.periodEnd,
      periodStart: ledgerWrite.periodStart,
      reversesLedgerEntryId: ledgerWrite.reversesLedgerEntryId,
      source: ledgerWrite.source,
      sourceId: ledgerWrite.sourceId,
      type: ledgerWrite.type,
      userId: ledgerWrite.userId,
    })
    .returning();

  await tx
    .update(creditAccounts)
    .set({
      availableCredits: nextAccount.availableCredits,
      carryForwardCredits: nextAccount.carryForwardCredits,
      lifetimeExpired: nextAccount.lifetimeExpired,
      lifetimeGranted: nextAccount.lifetimeGranted,
      lifetimeSpent: nextAccount.lifetimeSpent,
    })
    .where(eq(creditAccounts.userId, entry.userId));

  return { created: true, entry: ledgerEntry };
}

async function appendLedgerEntry(tx: DBClient, entry: CreditWriteOptions) {
  const result = await appendLedgerEntryWithResult(tx, entry);

  return result.entry;
}

async function expirePreviousPeriodCredits({
  account,
  currentPeriod,
  tx,
  userId,
}: {
  account: CreditAccount;
  currentPeriod: CreditPeriod;
  tx: DBClient;
  userId: string;
}) {
  const expirableCredits = Math.max(
    0,
    account.availableCredits - account.carryForwardCredits,
  );

  if (expirableCredits <= 0) {
    return;
  }

  const [latestEntry] = await tx
    .select()
    .from(creditLedgerEntries)
    .where(eq(creditLedgerEntries.userId, userId))
    .orderBy(
      desc(creditLedgerEntries.periodEnd),
      desc(creditLedgerEntries.createdAt),
    )
    .limit(1);

  if (!latestEntry || latestEntry.periodEnd > currentPeriod.periodStart) {
    return;
  }

  await appendLedgerEntry(tx, {
    amount: -expirableCredits,
    idempotencyKey: `expire:${userId}:${currentPeriod.periodStart.toISOString()}`,
    metadata: {
      expiredBeforePeriodKey: currentPeriod.key,
    },
    periodEnd: latestEntry.periodEnd,
    periodStart: latestEntry.periodStart,
    source: "period_reconciliation",
    sourceId: currentPeriod.key,
    type: "expire",
    userId,
  });
}

async function reconcilePeriodGrantForUser(
  userId: string,
  tx: DBClient,
  period?: CreditPeriod,
) {
  const currentPeriod = period ?? (await resolveCurrentPeriod(userId, tx));
  const account = await lockCreditAccount(userId, tx);
  await expirePreviousPeriodCredits({
    account,
    currentPeriod,
    tx,
    userId,
  });

  const [existingGrant] = await tx
    .select()
    .from(creditPeriodGrants)
    .where(eq(creditPeriodGrants.periodKey, currentPeriod.key));

  const previousAllowance = existingGrant?.allowance ?? 0;
  const topUpAmount = Math.max(0, currentPeriod.allowance - previousAllowance);

  if (existingGrant) {
    await tx
      .update(creditPeriodGrants)
      .set({
        allowance: currentPeriod.allowance,
        periodEnd: currentPeriod.periodEnd,
        periodStart: currentPeriod.periodStart,
        plan: currentPeriod.plan,
        subscriptionId: currentPeriod.subscriptionId,
      })
      .where(eq(creditPeriodGrants.id, existingGrant.id));
  } else {
    await tx.insert(creditPeriodGrants).values({
      allowance: currentPeriod.allowance,
      periodEnd: currentPeriod.periodEnd,
      periodKey: currentPeriod.key,
      periodStart: currentPeriod.periodStart,
      plan: currentPeriod.plan,
      subscriptionId: currentPeriod.subscriptionId,
      userId,
    });
  }

  if (topUpAmount > 0) {
    const grantResult = await appendLedgerEntryWithResult(tx, {
      amount: topUpAmount,
      idempotencyKey: `grant:${currentPeriod.key}:allowance:${currentPeriod.allowance}`,
      metadata: {
        allowance: currentPeriod.allowance,
        previousAllowance,
      },
      periodEnd: currentPeriod.periodEnd,
      periodStart: currentPeriod.periodStart,
      source: "period_grant",
      sourceId: currentPeriod.key,
      type: "grant",
      userId,
    });

    return {
      grantCreated: grantResult.created,
      period: currentPeriod,
    };
  }

  return {
    grantCreated: false,
    period: currentPeriod,
  };
}

export async function reconcileCreditGrantsForUser(userId: string) {
  const result = await db.transaction(async (tx) =>
    reconcilePeriodGrantForUser(userId, tx),
  );

  await invalidateCreditBalanceCache(userId);

  return result;
}

export async function reconcileCreditGrantForSubscription(
  record: SubscriptionGrantRecord,
) {
  const period = paidPeriodForSubscription(record);

  if (!period || period.allowance <= 0) {
    return null;
  }

  const result = await db.transaction(async (tx) =>
    reconcilePeriodGrantForUser(record.referenceId, tx, period),
  );

  await invalidateCreditBalanceCache(record.referenceId);

  return result;
}

export async function getCreditBalanceCacheParts(userId: string) {
  const period = await resolveCurrentPeriod(userId);

  return ["period", period.key];
}

export async function spendCredits({
  amount,
  idempotencyKey,
  source,
  sourceId,
  userId,
}: {
  amount: number;
  idempotencyKey: string;
  source: string;
  sourceId?: null | string;
  userId: string;
}) {
  assertPositiveInteger(amount, "Credit spend amount");

  const entry = await db.transaction(async (tx) => {
    const result = await reconcilePeriodGrantForUser(userId, tx);

    return appendLedgerEntry(tx, {
      amount: -amount,
      idempotencyKey,
      periodEnd: result.period.periodEnd,
      periodStart: result.period.periodStart,
      source,
      sourceId,
      type: "spend",
      userId,
    });
  });

  await invalidateCreditBalanceCache(userId);

  return entry;
}

export async function refundCreditSpend({
  amount,
  idempotencyKey,
  metadata,
  source = "refund",
  sourceId,
  spendLedgerEntryId,
  userId,
}: {
  amount?: number;
  idempotencyKey: string;
  metadata?: LedgerMetadata;
  source?: string;
  sourceId?: null | string;
  spendLedgerEntryId: string;
  userId: string;
}) {
  const entry = await db.transaction(async (tx) => {
    const [spendEntry] = await tx
      .select()
      .from(creditLedgerEntries)
      .where(
        and(
          eq(creditLedgerEntries.id, spendLedgerEntryId),
          eq(creditLedgerEntries.userId, userId),
          eq(creditLedgerEntries.type, "spend"),
        ),
      );

    if (!spendEntry) {
      throw new Error("Spend ledger entry not found.");
    }

    const refundAmount = amount ?? Math.abs(spendEntry.amount);
    assertPositiveInteger(refundAmount, "Credit refund amount");
    if (refundAmount > Math.abs(spendEntry.amount)) {
      throw new Error("Refund amount cannot exceed the original spend.");
    }
    const carryForwardCreditsSpent = readCarryForwardCreditsSpent(
      spendEntry.metadata,
    );
    const carryForwardRefunded = Math.min(
      refundAmount,
      carryForwardCreditsSpent,
    );

    return appendLedgerEntry(tx, {
      amount: refundAmount,
      carryForwardDelta: carryForwardRefunded,
      idempotencyKey,
      metadata: {
        ...metadata,
        carryForwardCreditsRefunded: carryForwardRefunded,
      },
      periodEnd: spendEntry.periodEnd,
      periodStart: spendEntry.periodStart,
      reversesLedgerEntryId: spendEntry.id,
      source,
      sourceId: sourceId ?? spendEntry.sourceId,
      type: "refund",
      userId,
    });
  });

  await invalidateCreditBalanceCache(userId);

  return entry;
}

export async function grantCreditTopUp({
  amount,
  idempotencyKey,
  metadata,
  source = "stripe_credit_top_up",
  sourceId,
  userId,
}: {
  amount: number;
  idempotencyKey: string;
  metadata?: LedgerMetadata;
  source?: string;
  sourceId?: null | string;
  userId: string;
}) {
  assertPositiveInteger(amount, "Credit top-up amount");

  const entry = await db.transaction(async (tx) => {
    const result = await reconcilePeriodGrantForUser(userId, tx);

    const topUpResult = await appendLedgerEntryWithResult(tx, {
      amount,
      carryForwardDelta: amount,
      idempotencyKey,
      metadata,
      periodEnd: result.period.periodEnd,
      periodStart: result.period.periodStart,
      source,
      sourceId,
      type: "top_up",
      userId,
    });

    return {
      ...topUpResult.entry,
      created: topUpResult.created,
    };
  });

  await invalidateCreditBalanceCache(userId);

  return entry;
}

export async function adjustCredits({
  amount,
  idempotencyKey,
  metadata,
  source = "manual_adjustment",
  sourceId,
  userId,
}: {
  amount: number;
  idempotencyKey: string;
  metadata?: LedgerMetadata;
  source?: string;
  sourceId?: null | string;
  userId: string;
}) {
  if (!Number.isInteger(amount) || amount === 0) {
    throw new Error("Credit adjustment amount must be a non-zero integer.");
  }

  const entry = await db.transaction(async (tx) => {
    const result = await reconcilePeriodGrantForUser(userId, tx);

    return appendLedgerEntry(tx, {
      amount,
      idempotencyKey,
      metadata,
      periodEnd: result.period.periodEnd,
      periodStart: result.period.periodStart,
      source,
      sourceId,
      type: amount > 0 ? "manual_credit" : "manual_debit",
      userId,
    });
  });

  await invalidateCreditBalanceCache(userId);

  return entry;
}

export async function getCreditBalance(userId: string) {
  return db.transaction(async (tx) => {
    const result = await reconcilePeriodGrantForUser(userId, tx);
    const account = await lockCreditAccount(userId, tx);
    const recentLedger = await tx
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.userId, userId))
      .orderBy(desc(creditLedgerEntries.createdAt))
      .limit(defaultRecentLedgerLimit);

    return {
      account,
      currentPeriod: {
        allowance: result.period.allowance,
        periodEnd: result.period.periodEnd,
        periodStart: result.period.periodStart,
        plan: result.period.plan,
      },
      recentLedger,
    };
  });
}
