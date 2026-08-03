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

export async function updateUserEmail({
  email,
  userId,
}: {
  email: string;
  userId: string;
}) {
  await db
    .update(user)
    .set({
      email,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(user.id, userId));
}
