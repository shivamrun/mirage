import { and, count, desc, eq, sql } from "drizzle-orm";

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

export async function getAdminLinkedAccountForDeletion(
  userId: string,
  accountRowId: string,
) {
  const [account] = await db
    .select({
      accountId: accountTable.accountId,
      id: accountTable.id,
      providerId: accountTable.providerId,
    })
    .from(accountTable)
    .where(
      and(eq(accountTable.id, accountRowId), eq(accountTable.userId, userId)),
    )
    .limit(1);

  if (!account) {
    return { status: "not-found" } as const;
  }

  if (account.providerId === "credential") {
    return { status: "credential" } as const;
  }

  const [signInMethodMetrics] = await db
    .select({ total: count() })
    .from(accountTable)
    .where(eq(accountTable.userId, userId));
  const remainingSignInMethods = (signInMethodMetrics?.total ?? 0) - 1;

  if (remainingSignInMethods < 1) {
    return { account, remainingSignInMethods, status: "last-method" } as const;
  }

  return { account, remainingSignInMethods, status: "deletable" } as const;
}

export async function deleteAdminLinkedAccount(
  userId: string,
  accountRowId: string,
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

    const [account] = await tx
      .select({
        accountId: accountTable.accountId,
        id: accountTable.id,
        providerId: accountTable.providerId,
      })
      .from(accountTable)
      .where(
        and(eq(accountTable.id, accountRowId), eq(accountTable.userId, userId)),
      )
      .limit(1);

    if (!account) {
      return { status: "not-found" } as const;
    }

    if (account.providerId === "credential") {
      return { status: "credential" } as const;
    }

    const [signInMethodMetrics] = await tx
      .select({ total: count() })
      .from(accountTable)
      .where(eq(accountTable.userId, userId));
    const remainingSignInMethods = (signInMethodMetrics?.total ?? 0) - 1;

    if (remainingSignInMethods < 1) {
      return {
        account,
        remainingSignInMethods,
        status: "last-method",
      } as const;
    }

    await tx
      .delete(accountTable)
      .where(
        and(eq(accountTable.id, account.id), eq(accountTable.userId, userId)),
      );

    return { account, remainingSignInMethods, status: "deleted" } as const;
  });
}

export async function getAdminUserSessionForDeletion(
  userId: string,
  sessionId: string,
) {
  const [session] = await db
    .select({
      id: sessionTable.id,
      token: sessionTable.token,
      userId: sessionTable.userId,
    })
    .from(sessionTable)
    .where(and(eq(sessionTable.id, sessionId), eq(sessionTable.userId, userId)))
    .limit(1);

  if (!session) {
    return null;
  }

  return session;
}
