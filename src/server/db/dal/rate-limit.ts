import { sql } from "drizzle-orm";

import db from "@/server/db";
import { applicationRateLimit } from "@/server/db/schema";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function consumeRateLimit({
  identifierHash,
  limit,
  scope,
  windowMs,
}: {
  identifierHash: string;
  limit: number;
  scope: string;
  windowMs: number;
}): Promise<RateLimitResult> {
  const [result] = await db.execute<{
    count: number;
    retryAfterSeconds: number;
  }>(sql`
    insert into ${applicationRateLimit} (
      "scope",
      "identifier_hash",
      "count",
      "reset_at"
    )
    values (
      ${scope},
      ${identifierHash},
      1,
      now() + (${windowMs}::double precision * interval '1 millisecond')
    )
    on conflict ("scope", "identifier_hash")
    do update set
      "count" = case
        when ${applicationRateLimit.resetAt} <= now() then 1
        else ${applicationRateLimit.count} + 1
      end,
      "reset_at" = case
        when ${applicationRateLimit.resetAt} <= now()
          then now() + (${windowMs}::double precision * interval '1 millisecond')
        else ${applicationRateLimit.resetAt}
      end
    returning
      "count",
      greatest(
        1,
        ceil(extract(epoch from ("reset_at" - now())))
      )::integer as "retryAfterSeconds"
  `);

  if (!result) {
    throw new Error("Rate limit update did not return a result.");
  }

  if (result.count <= limit) {
    return { allowed: true };
  }

  return {
    allowed: false,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

export async function pruneExpiredRateLimits(limit = 100) {
  const deleted = await db.execute<{ identifierHash: string }>(sql`
    delete from ${applicationRateLimit}
    where ctid in (
      select ctid
      from ${applicationRateLimit}
      where "reset_at" <= now()
      order by "reset_at"
      limit ${limit}
    )
    returning "identifier_hash" as "identifierHash"
  `);

  return deleted.length;
}
