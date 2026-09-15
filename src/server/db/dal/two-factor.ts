import { timingSafeEqual } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { parseTwoFactorEmailCodeValue } from "@/server/account/verification-schemas";
import db from "@/server/db";
import {
  twoFactor as twoFactorTable,
  user as userTable,
  verification,
} from "@/server/db/schema";

export async function verifyAndConsumeEmailCode({
  expectedHash,
  identifier,
  maxFailedAttempts,
}: {
  expectedHash: string;
  identifier: string;
  maxFailedAttempts: number;
}) {
  return db.transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(verification)
      .where(eq(verification.identifier, identifier))
      .for("update")
      .limit(1);

    if (!record) return false;

    const value = parseTwoFactorEmailCodeValue(record.value);
    if (
      record.expiresAt <= new Date() ||
      value.failedAttempts >= maxFailedAttempts
    ) {
      await tx.delete(verification).where(eq(verification.id, record.id));
      return false;
    }

    const actual = Buffer.from(value.codeHash);
    const expected = Buffer.from(expectedHash);
    const matches =
      actual.length === expected.length && timingSafeEqual(actual, expected);

    if (!matches) {
      const failedAttempts = value.failedAttempts + 1;
      if (failedAttempts >= maxFailedAttempts) {
        await tx.delete(verification).where(eq(verification.id, record.id));
      } else {
        await tx
          .update(verification)
          .set({
            value: JSON.stringify({ ...value, failedAttempts }),
            updatedAt: new Date(),
          })
          .where(eq(verification.id, record.id));
      }
      return false;
    }

    await tx.delete(verification).where(eq(verification.id, record.id));
    return true;
  });
}

export async function deleteTwoFactorRows(userId: string) {
  await db.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
}

export async function findPendingTwoFactorSetup(userId: string) {
  const [record] = await db
    .select()
    .from(twoFactorTable)
    .where(
      and(
        eq(twoFactorTable.userId, userId),
        eq(twoFactorTable.verified, false),
      ),
    )
    .limit(1);

  return record ?? null;
}

export async function findVerifiedTwoFactor(userId: string) {
  const [record] = await db
    .select()
    .from(twoFactorTable)
    .where(
      and(eq(twoFactorTable.userId, userId), eq(twoFactorTable.verified, true)),
    )
    .limit(1);

  return record ?? null;
}

export function getTwoFactorLockState(
  twoFactor: Pick<typeof twoFactorTable.$inferSelect, "lockedUntil">,
) {
  if (!twoFactor.lockedUntil) {
    return null;
  }

  const retryAfterSeconds = Math.ceil(
    (twoFactor.lockedUntil.getTime() - Date.now()) / 1000,
  );

  return retryAfterSeconds > 0 ? { retryAfterSeconds } : null;
}

export async function recordTwoFactorVerificationFailure({
  lockUntil,
  maxFailedAttempts,
  twoFactorId,
}: {
  lockUntil: Date;
  maxFailedAttempts: number;
  twoFactorId: string;
}) {
  const [updated] = await db
    .update(twoFactorTable)
    .set({
      failedVerificationCount: sql`${twoFactorTable.failedVerificationCount} + 1`,
    })
    .where(eq(twoFactorTable.id, twoFactorId))
    .returning({
      failedVerificationCount: twoFactorTable.failedVerificationCount,
    });

  if ((updated?.failedVerificationCount ?? 0) < maxFailedAttempts) {
    return;
  }

  await db
    .update(twoFactorTable)
    .set({
      lockedUntil: lockUntil,
    })
    .where(eq(twoFactorTable.id, twoFactorId));
}

export async function resetTwoFactorVerificationFailures(twoFactorId: string) {
  await db
    .update(twoFactorTable)
    .set({
      failedVerificationCount: 0,
      lockedUntil: null,
    })
    .where(eq(twoFactorTable.id, twoFactorId));
}

export async function createTwoFactorSetup(values: {
  id: string;
  backupCodes: string;
  secret: string;
  userId: string;
}) {
  await db.insert(twoFactorTable).values({ ...values, verified: false });
}

export async function completeTwoFactorSetup(userId: string, setupId: string) {
  return db.transaction(async (tx) => {
    const [setup] = await tx
      .update(twoFactorTable)
      .set({ failedVerificationCount: 0, lockedUntil: null, verified: true })
      .where(
        and(
          eq(twoFactorTable.id, setupId),
          eq(twoFactorTable.userId, userId),
          eq(twoFactorTable.verified, false),
        ),
      )
      .returning({ id: twoFactorTable.id });
    if (!setup) return false;

    await tx
      .update(userTable)
      .set({ twoFactorEnabled: true, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
    return true;
  });
}

export async function disableTwoFactorForUser(userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(twoFactorTable).where(eq(twoFactorTable.userId, userId));
    await tx
      .update(userTable)
      .set({ twoFactorEnabled: false, updatedAt: new Date() })
      .where(eq(userTable.id, userId));
  });
}
