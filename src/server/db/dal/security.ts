import { eq, sql } from "drizzle-orm";

import db from "@/server/db";
import { session as sessionTable, user as userTable } from "@/server/db/schema";

export async function getSecurityControlSummary() {
  const [sessionMetrics] = await db
    .select({
      totalSessions: sql<number>`count(*)`.mapWith(Number),
      activeSessions:
        sql<number>`count(*) filter (where ${sessionTable.expiresAt} > now())`.mapWith(
          Number,
        ),
    })
    .from(sessionTable);

  const [banMetrics] = await db
    .select({
      bannedUsers: sql<number>`count(*)`.mapWith(Number),
      activeBans:
        sql<number>`count(*) filter (where ${userTable.banExpires} is null or ${userTable.banExpires} > now())`.mapWith(
          Number,
        ),
    })
    .from(userTable)
    .where(eq(userTable.banned, true));

  return {
    totalSessions: sessionMetrics?.totalSessions ?? 0,
    activeSessions: sessionMetrics?.activeSessions ?? 0,
    bannedUsers: banMetrics?.bannedUsers ?? 0,
    activeBans: banMetrics?.activeBans ?? 0,
  };
}

export async function getUserForPasswordReset(email: string) {
  const [record] = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
    })
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  return record ?? null;
}

export async function revokeUserSessions(userId: string) {
  return db
    .delete(sessionTable)
    .where(eq(sessionTable.userId, userId))
    .returning({ id: sessionTable.id });
}

export async function revokeAllSessions() {
  return db.delete(sessionTable).returning({ id: sessionTable.id });
}
