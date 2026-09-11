import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import db from "@/server/db";
import * as schema from "@/server/db/schema";
import { user as userTable } from "@/server/db/schema";

export type AuthUserRecord = typeof userTable.$inferSelect;

export function createAuthDatabaseAdapter() {
  return drizzleAdapter(db, {
    provider: "pg",
    schema,
  });
}

export async function getAuthUserById(id: string) {
  const [user] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, id))
    .limit(1);

  return user ?? null;
}
