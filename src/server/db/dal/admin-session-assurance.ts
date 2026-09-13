import { and, eq, gt } from "drizzle-orm";

import db from "@/server/db";
import { adminSessionAssurance } from "@/server/db/schema";

// Admin step-up is deliberately shorter than the Better Auth session lifetime.
const ADMIN_ASSURANCE_EXPIRES_IN_MS = 1000 * 60 * 60 * 12;

export function getAdminAssuranceExpiresAt() {
  return new Date(Date.now() + ADMIN_ASSURANCE_EXPIRES_IN_MS);
}

export async function hasAdminSessionAssurance({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  const [record] = await db
    .select({ id: adminSessionAssurance.id })
    .from(adminSessionAssurance)
    .where(
      and(
        eq(adminSessionAssurance.sessionId, sessionId),
        eq(adminSessionAssurance.userId, userId),
        eq(adminSessionAssurance.method, "totp"),
        gt(adminSessionAssurance.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return Boolean(record);
}

export async function markAdminSessionAssurance({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  await db
    .insert(adminSessionAssurance)
    .values({
      expiresAt: getAdminAssuranceExpiresAt(),
      method: "totp",
      sessionId,
      userId,
    })
    .onConflictDoUpdate({
      set: {
        expiresAt: getAdminAssuranceExpiresAt(),
        method: "totp",
        updatedAt: new Date(),
        userId,
      },
      target: adminSessionAssurance.sessionId,
    });
}
