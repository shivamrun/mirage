import { desc, eq, like, or, sql } from "drizzle-orm";

import db from "@/server/db";
import {
  account as accountTable,
  session as sessionTable,
  user as userTable,
  verification as verificationTable,
} from "@/server/db/schema";

const EMAIL_CHANGE_PREFIX = "account-email-change";
const EMAIL_CHANGE_APPROVAL_PREFIX = "account-email-change-approval";

function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function verificationIdentifierPrefix(prefix: string, userId: string) {
  return `${escapeLikePattern(`${prefix}:${userId}:`)}%`;
}

export async function getAdminUserDetail(userId: string) {
  const [record] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (!record) {
    return null;
  }

  const [accounts, sessions, verifications] = await Promise.all([
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
    db
      .select({
        id: verificationTable.id,
        identifier: verificationTable.identifier,
        expiresAt: verificationTable.expiresAt,
        createdAt: verificationTable.createdAt,
        updatedAt: verificationTable.updatedAt,
      })
      .from(verificationTable)
      .where(
        or(
          eq(verificationTable.identifier, record.email),
          like(
            verificationTable.identifier,
            verificationIdentifierPrefix(EMAIL_CHANGE_PREFIX, userId),
          ),
          like(
            verificationTable.identifier,
            verificationIdentifierPrefix(EMAIL_CHANGE_APPROVAL_PREFIX, userId),
          ),
        ),
      )
      .orderBy(desc(verificationTable.createdAt)),
  ]);

  return {
    user: record,
    accounts,
    sessions,
    verifications,
  };
}

export type AdminUserDetail = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetail>>
>;
