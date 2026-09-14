import { sql } from "drizzle-orm";

import db from "@/server/db";

export async function checkDatabaseHealth() {
  await db.execute(sql`select 1`);
}
