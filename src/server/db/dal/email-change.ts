import { and, eq, gt, like, lte, or } from "drizzle-orm";

import db from "@/server/db";
import { user, verification } from "@/server/db/schema";

function identifierCondition(patterns: string[]) {
  const condition = or(
    ...patterns.map((pattern) => like(verification.identifier, pattern)),
  );

  if (!condition) {
    throw new Error(
      "At least one verification identifier pattern is required.",
    );
  }

  return condition;
}

export async function findActiveVerification({
  identifierPatterns,
  expiresAfter,
}: {
  identifierPatterns: string[];
  expiresAfter: Date;
}) {
  const [record] = await db
    .select()
    .from(verification)
    .where(
      and(
        identifierCondition(identifierPatterns),
        gt(verification.expiresAt, expiresAfter),
      ),
    )
    .limit(1);

  return record;
}

export async function findVerificationByIdentifierPattern(
  identifierPattern: string,
) {
  const [record] = await db
    .select()
    .from(verification)
    .where(like(verification.identifier, identifierPattern))
    .limit(1);

  return record;
}

export async function deleteExpiredVerifications(identifierPatterns: string[]) {
  await db
    .delete(verification)
    .where(
      and(
        lte(verification.expiresAt, new Date()),
        identifierCondition(identifierPatterns),
      ),
    );
}

export async function deleteVerificationsByIdentifierPatterns(
  identifierPatterns: string[],
) {
  await db.delete(verification).where(identifierCondition(identifierPatterns));
}

export async function createVerification(values: {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
}) {
  await db.insert(verification).values(values);
}

export async function deleteVerification(id: string) {
  await db.delete(verification).where(eq(verification.id, id));
}

export async function findUserByEmail(email: string) {
  const [record] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  return record;
}

export async function replaceApprovalWithPending({
  approvalId,
  pending,
}: {
  approvalId: string;
  pending: typeof verification.$inferInsert;
}) {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .delete(verification)
      .where(
        and(
          eq(verification.id, approvalId),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .returning({ id: verification.id });

    if (!claimed) return false;

    await tx.insert(verification).values(pending);
    return true;
  });
}

export async function consumePendingAndUpdateUserEmail({
  currentEmail,
  identifierPatterns,
  newEmail,
  pendingId,
  userId,
}: {
  currentEmail: string;
  identifierPatterns: string[];
  newEmail: string;
  pendingId: string;
  userId: string;
}) {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .delete(verification)
      .where(
        and(
          eq(verification.id, pendingId),
          gt(verification.expiresAt, new Date()),
        ),
      )
      .returning({ id: verification.id });

    if (!claimed) return false;

    const [updated] = await tx
      .update(user)
      .set({
        email: newEmail,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(and(eq(user.id, userId), eq(user.email, currentEmail)))
      .returning({ id: user.id });

    if (!updated) return false;

    await tx
      .delete(verification)
      .where(identifierCondition(identifierPatterns));
    return true;
  });
}
