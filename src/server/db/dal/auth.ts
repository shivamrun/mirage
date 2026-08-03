import { drizzleAdapter } from "better-auth/adapters/drizzle";

import db from "@/server/db";

export function createAuthDatabaseAdapter() {
  return drizzleAdapter(db, {
    provider: "pg",
  });
}
