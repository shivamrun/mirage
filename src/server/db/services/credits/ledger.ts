import {
  type CreditAccount,
  type CreditTransaction,
  findCreditPeriodGrant,
  findCreditUser,
  findCurrentPaidSubscription,
  findLatestCreditLedgerEntry,
  findLedgerEntryByIdempotencyKey,
  findSpendLedgerEntry,
  insertCreditLedgerEntry,
  type LedgerEntry,
  listRecentCreditLedger,
  lockCreditAccount,
  type SubscriptionRecord,
  sumCreditRefunds,
  type UserRecord,
  updateCreditAccount,
  upsertCreditPeriodGrant,
  withCreditTransaction,
} from "@/server/db/dal/credits";
import { getBillingPlanCredits, normalizeBillingPlan } from "@/shared/billing";
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

function operationFingerprint(entry: CreditWriteOptions) {
  return JSON.stringify({
    amount: entry.amount,
    carryForwardDelta: entry.carryForwardDelta ?? null,
    metadata: entry.metadata ?? null,
    reversesLedgerEntryId: entry.reversesLedgerEntryId ?? null,
    source: entry.source,
    sourceId: entry.sourceId ?? null,
    type: entry.type,
    userId: entry.userId,
  });
}

function assertPositiveInteger(amount: number, label: string) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

function normalizePlanKey(value: null | string | undefined) {
  return normalizeBillingPlan(value);
}

function planAllowance(plan: string) {
  return getBillingPlanCredits(plan);
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

function minDate(first: Date, second: Date) {
  return first <= second ? first : second;
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

function monthlyPeriodWithinRange({
  end,
  now = new Date(),
  start,
}: {
  end: Date;
  now?: Date;
  start: Date;
}) {
  let periodStart = start;
  let periodEnd = minDate(addMonthsClamped(periodStart, 1), end);

  while (periodEnd <= now && periodEnd < end) {
    periodStart = periodEnd;
    periodEnd = minDate(addMonthsClamped(periodStart, 1), end);
  }

  return { periodEnd, periodStart };
}

function paidPeriodForSubscription(
  record: SubscriptionGrantRecord,
  now = new Date(),
) {
  const plan = normalizePlanKey(record.plan) ?? record.plan;
  const billingPeriodStart = record.periodStart;
  const billingPeriodEnd = record.periodEnd;

  if (!billingPeriodStart || !billingPeriodEnd) {
    return null;
  }

  const { periodEnd, periodStart } = monthlyPeriodWithinRange({
    end: billingPeriodEnd,
    now,
    start: billingPeriodStart,
  });

  return {
    allowance: planAllowance(plan),
    key: `subscription:${record.id}:${periodStart.toISOString()}:${periodEnd.toISOString()}`,
    periodEnd,
    periodStart,
    plan,
    subscriptionId: record.stripeSubscriptionId ?? record.id,
  } satisfies CreditPeriod;
}

function freeBenefitPeriodForPaidPeriod({
  paidPeriod,
  userId,
}: {
  paidPeriod: CreditPeriod;
  userId: string;
}) {
  return {
    allowance: planAllowance(freePlanKey),
    key: `free-benefit:${userId}:${paidPeriod.subscriptionId ?? "subscription"}:${paidPeriod.periodStart.toISOString()}:${paidPeriod.periodEnd.toISOString()}`,
    periodEnd: paidPeriod.periodEnd,
    periodStart: paidPeriod.periodStart,
    plan: freePlanKey,
    subscriptionId: paidPeriod.subscriptionId,
  } satisfies CreditPeriod;
}

async function resolveCurrentPeriod(userId: string, tx?: CreditTransaction) {
  const paidSubscription = await findCurrentPaidSubscription(
    userId,
    activeSubscriptionStatuses,
    tx,
  );
  const paidPeriod = paidSubscription
    ? paidPeriodForSubscription(paidSubscription)
    : null;

  if (paidPeriod && paidPeriod.allowance > 0) {
    return paidPeriod;
  }

  const userRecord = await findCreditUser(userId, tx);
  if (!userRecord) {
    throw new Error("User not found.");
  }

  return freePeriodForUser(userRecord);
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

function assertMatchingIdempotentEntry(
  existing: LedgerEntry,
  nextEntry: CreditWriteOptions,
) {
  const fingerprint = operationFingerprint(nextEntry);
  if (
    existing.amount !== nextEntry.amount ||
    existing.reversesLedgerEntryId !==
      (nextEntry.reversesLedgerEntryId ?? null) ||
    existing.source !== nextEntry.source ||
    existing.sourceId !== (nextEntry.sourceId ?? null) ||
    existing.type !== nextEntry.type ||
    existing.userId !== nextEntry.userId ||
    (existing.operationFingerprint !== null &&
      existing.operationFingerprint !== fingerprint)
  ) {
    throw new CreditIdempotencyConflictError(nextEntry.idempotencyKey);
  }
}

async function appendLedgerEntryWithResult(
  tx: CreditTransaction,
  entry: CreditWriteOptions,
) {
  const existing = await findLedgerEntryByIdempotencyKey(
    entry.idempotencyKey,
    tx,
  );
  if (existing) {
    assertMatchingIdempotentEntry(existing, entry);
    return { created: false, entry: existing };
  }

  const account = await lockCreditAccount(entry.userId, tx);
  const existingAfterLock = await findLedgerEntryByIdempotencyKey(
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

  const ledgerEntry = await insertCreditLedgerEntry(
    {
      amount: ledgerWrite.amount,
      idempotencyKey: ledgerWrite.idempotencyKey,
      metadata: ledgerWrite.metadata,
      operationFingerprint: operationFingerprint(entry),
      periodEnd: ledgerWrite.periodEnd,
      periodStart: ledgerWrite.periodStart,
      reversesLedgerEntryId: ledgerWrite.reversesLedgerEntryId,
      source: ledgerWrite.source,
      sourceId: ledgerWrite.sourceId,
      type: ledgerWrite.type,
      userId: ledgerWrite.userId,
    },
    tx,
  );

  await updateCreditAccount(
    entry.userId,
    {
      availableCredits: nextAccount.availableCredits,
      carryForwardCredits: nextAccount.carryForwardCredits,
      lifetimeExpired: nextAccount.lifetimeExpired,
      lifetimeGranted: nextAccount.lifetimeGranted,
      lifetimeSpent: nextAccount.lifetimeSpent,
    },
    tx,
  );

  return { created: true, entry: ledgerEntry };
}

async function appendLedgerEntry(
  tx: CreditTransaction,
  entry: CreditWriteOptions,
) {
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
  tx: CreditTransaction;
  userId: string;
}) {
  const expirableCredits = Math.max(
    0,
    account.availableCredits - account.carryForwardCredits,
  );

  if (expirableCredits <= 0) {
    return;
  }

  const latestEntry = await findLatestCreditLedgerEntry(userId, tx);

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

async function grantPeriodCredits({
  currentPeriod,
  tx,
  userId,
}: {
  currentPeriod: CreditPeriod;
  tx: CreditTransaction;
  userId: string;
}) {
  const existingGrant = await findCreditPeriodGrant(currentPeriod.key, tx);

  const previousAllowance = existingGrant?.allowance ?? 0;
  const topUpAmount = Math.max(0, currentPeriod.allowance - previousAllowance);

  await upsertCreditPeriodGrant(
    {
      allowance: currentPeriod.allowance,
      periodEnd: currentPeriod.periodEnd,
      periodKey: currentPeriod.key,
      periodStart: currentPeriod.periodStart,
      plan: currentPeriod.plan,
      subscriptionId: currentPeriod.subscriptionId,
      userId,
    },
    tx,
  );

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

async function reconcilePeriodGrantsForUser(
  userId: string,
  tx: CreditTransaction,
  period?: CreditPeriod,
) {
  const currentPeriod = period ?? (await resolveCurrentPeriod(userId, tx));
  const grantPeriods = [currentPeriod];

  if (currentPeriod.plan !== freePlanKey) {
    const freeBenefitPeriod = freeBenefitPeriodForPaidPeriod({
      paidPeriod: currentPeriod,
      userId,
    });

    if (freeBenefitPeriod.allowance > 0) {
      grantPeriods.push(freeBenefitPeriod);
    }
  }

  const account = await lockCreditAccount(userId, tx);
  await expirePreviousPeriodCredits({
    account,
    currentPeriod,
    tx,
    userId,
  });

  let grantCreated = false;

  for (const grantPeriod of grantPeriods) {
    const result = await grantPeriodCredits({
      currentPeriod: grantPeriod,
      tx,
      userId,
    });
    grantCreated ||= result.grantCreated;
  }

  return {
    grantCreated,
    period: currentPeriod,
  };
}

async function reconcilePeriodGrantForUser(
  userId: string,
  tx: CreditTransaction,
  period?: CreditPeriod,
) {
  return reconcilePeriodGrantsForUser(userId, tx, period);
}

export async function reconcileCreditGrantsForUser(userId: string) {
  const result = await withCreditTransaction(async (tx) =>
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

  const result = await withCreditTransaction(async (tx) =>
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

  const entry = await withCreditTransaction(async (tx) => {
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
  const entry = await withCreditTransaction(async (tx) => {
    await lockCreditAccount(userId, tx);
    const spendEntry = await findSpendLedgerEntry(
      spendLedgerEntryId,
      userId,
      tx,
    );

    if (!spendEntry) {
      throw new Error("Spend ledger entry not found.");
    }

    const refundAmount = amount ?? Math.abs(spendEntry.amount);
    assertPositiveInteger(refundAmount, "Credit refund amount");
    if (refundAmount > Math.abs(spendEntry.amount)) {
      throw new Error("Refund amount cannot exceed the original spend.");
    }
    const alreadyRefunded = await sumCreditRefunds(spendEntry.id, tx);
    if (alreadyRefunded + refundAmount > Math.abs(spendEntry.amount)) {
      throw new Error("Total refunds cannot exceed the original spend.");
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

  const entry = await withCreditTransaction(async (tx) => {
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

export async function grantCreditTopUps(
  topUps: {
    amount: number;
    idempotencyKey: string;
    metadata?: LedgerMetadata;
    source?: string;
    sourceId?: null | string;
    userId: string;
  }[],
) {
  if (topUps.length === 0) {
    return [];
  }

  for (const topUp of topUps) {
    assertPositiveInteger(topUp.amount, "Credit top-up amount");
  }

  const entries = await withCreditTransaction(async (tx) => {
    const ledgerEntries = [];

    for (const topUp of topUps) {
      const result = await reconcilePeriodGrantForUser(topUp.userId, tx);
      const topUpResult = await appendLedgerEntryWithResult(tx, {
        amount: topUp.amount,
        carryForwardDelta: topUp.amount,
        idempotencyKey: topUp.idempotencyKey,
        metadata: topUp.metadata,
        periodEnd: result.period.periodEnd,
        periodStart: result.period.periodStart,
        source: topUp.source ?? "stripe_credit_top_up",
        sourceId: topUp.sourceId,
        type: "top_up",
        userId: topUp.userId,
      });

      ledgerEntries.push({
        ...topUpResult.entry,
        created: topUpResult.created,
      });
    }

    return ledgerEntries;
  });

  await Promise.all(
    [...new Set(topUps.map((topUp) => topUp.userId))].map((userId) =>
      invalidateCreditBalanceCache(userId),
    ),
  );

  return entries;
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

  const entry = await withCreditTransaction(async (tx) => {
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
  return withCreditTransaction(async (tx) => {
    const result = await reconcilePeriodGrantForUser(userId, tx);
    const account = await lockCreditAccount(userId, tx);
    const recentLedger = await listRecentCreditLedger(
      userId,
      defaultRecentLedgerLimit,
      tx,
    );

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
