import { sql } from "drizzle-orm";
import type {
  RateLimitBucket,
  RateLimitResult,
  RateLimitStore,
} from "@/adapters/rate-limit/types";
import db from "@/server/db";
import { applicationRateLimit } from "@/server/db/schema";

type RateLimitBucketState = {
  count: number;
  retryAfterSeconds: number;
};

function bucketKey({ identifierHash, scope }: RateLimitBucket) {
  return `${scope}\0${identifierHash}`;
}

async function consumeRateLimitPolicy(
  buckets: RateLimitBucket[],
): Promise<RateLimitResult> {
  if (buckets.length === 0) {
    return { allowed: true };
  }

  return db.transaction(async (tx) => {
    const states = new Map<string, RateLimitBucketState>();
    const bucketsByLockOrder = [...buckets].sort((left, right) =>
      bucketKey(left).localeCompare(bucketKey(right)),
    );

    for (const bucket of bucketsByLockOrder) {
      const [state] = await tx.execute<RateLimitBucketState>(sql`
        insert into ${applicationRateLimit} (
          "scope",
          "identifier_hash",
          "count",
          "reset_at"
        )
        values (
          ${bucket.scope},
          ${bucket.identifierHash},
          0,
          now() + (${bucket.windowMs}::double precision * interval '1 millisecond')
        )
        on conflict ("scope", "identifier_hash")
        do update set
          "count" = case
            when ${applicationRateLimit.resetAt} <= now() then 0
            else ${applicationRateLimit.count}
          end,
          "reset_at" = case
            when ${applicationRateLimit.resetAt} <= now()
              then now() + (${bucket.windowMs}::double precision * interval '1 millisecond')
            else ${applicationRateLimit.resetAt}
          end
        returning
          "count",
          greatest(
            1,
            ceil(extract(epoch from ("reset_at" - now())))
          )::integer as "retryAfterSeconds"
      `);

      if (!state) {
        throw new Error("Rate limit update did not return a result.");
      }

      states.set(bucketKey(bucket), state);
    }

    for (const bucket of buckets) {
      const state = states.get(bucketKey(bucket));

      if (!state) {
        throw new Error("Rate limit bucket was not evaluated.");
      }

      if (state.count >= bucket.limit) {
        return {
          allowed: false,
          retryAfterSeconds: state.retryAfterSeconds,
        };
      }
    }

    for (const bucket of bucketsByLockOrder) {
      await tx.execute(sql`
        update ${applicationRateLimit}
        set "count" = "count" + 1
        where
          "scope" = ${bucket.scope}
          and "identifier_hash" = ${bucket.identifierHash}
      `);
    }

    return { allowed: true };
  });
}

async function pruneExpiredRateLimits(limit = 100) {
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

export const databaseRateLimitStore: RateLimitStore = {
  consumePolicy: consumeRateLimitPolicy,
  pruneExpired: pruneExpiredRateLimits,
};
