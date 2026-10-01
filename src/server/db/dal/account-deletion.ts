import { sql } from "drizzle-orm";
import type { DBTransaction } from "@/server/db";

export async function lockAccountDeletionUser(
  tx: DBTransaction,
  userId: string,
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
  );
}
