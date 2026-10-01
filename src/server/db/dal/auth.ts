import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { and, eq } from "drizzle-orm";

import db, { type DBClient } from "@/server/db";
import * as schema from "@/server/db/schema";
import { account as accountTable, user as userTable } from "@/server/db/schema";

export type AuthUserRecord = typeof userTable.$inferSelect;

export function createAuthDatabaseAdapter() {
  return drizzleAdapter(db, {
    provider: "pg",
    schema,
  });
}

export async function getAuthUserById(id: string, executor: DBClient = db) {
  const [user] = await executor
    .select()
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);

  return user ?? null;
}

export async function getAuthUserByEmail(
  email: string,
  executor: DBClient = db,
) {
  const [user] = await executor
    .select()
    .from(userTable)
    .where(eq(userTable.email, email))
    .limit(1);

  return user ?? null;
}

export async function hasCredentialAccount(
  userId: string,
  executor: DBClient = db,
) {
  const [credential] = await executor
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(
      and(
        eq(accountTable.userId, userId),
        eq(accountTable.providerId, "credential"),
      ),
    )
    .limit(1);

  return Boolean(credential);
}
