import { desc, eq, sql } from "drizzle-orm";

import db from "@/server/db";
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
} from "@/server/db/schema";

export async function getAdminUserDetail(userId: string) {
  const [record] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!record) {
    return null;
  }

  const [accounts, sessions] = await Promise.all([
    db
      .select({
        id: accountTable.id,
        accountId: accountTable.accountId,
        providerId: accountTable.providerId,
        userId: accountTable.userId,
        accessTokenExpiresAt: accountTable.accessTokenExpiresAt,
        refreshTokenExpiresAt: accountTable.refreshTokenExpiresAt,
        scope: accountTable.scope,
        createdAt: accountTable.createdAt,
        updatedAt: accountTable.updatedAt,
        hasAccessToken: sql<boolean>`${accountTable.accessToken} is not null`,
        hasRefreshToken: sql<boolean>`${accountTable.refreshToken} is not null`,
        hasIdToken: sql<boolean>`${accountTable.idToken} is not null`,
        hasPassword: sql<boolean>`${accountTable.password} is not null`,
      })
      .from(accountTable)
      .where(eq(accountTable.userId, userId))
      .orderBy(desc(accountTable.createdAt)),
    db
      .select({
        id: sessionTable.id,
        userId: sessionTable.userId,
        expiresAt: sessionTable.expiresAt,
        createdAt: sessionTable.createdAt,
        updatedAt: sessionTable.updatedAt,
        ipAddress: sessionTable.ipAddress,
        userAgent: sessionTable.userAgent,
        impersonatedBy: sessionTable.impersonatedBy,
        hasToken: sql<boolean>`${sessionTable.token} is not null`,
      })
      .from(sessionTable)
      .where(eq(sessionTable.userId, userId))
      .orderBy(desc(sessionTable.createdAt)),
  ]);

  return {
    user: record,
    accounts,
    sessions,
  };
}

export type AdminUserDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetail>>
>;
