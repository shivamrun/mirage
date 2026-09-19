import { sql } from "drizzle-orm";

/**
 * Expression for exact filtered counts used by the `countQuery` passed to
 * `paginateList`.
 */
export const totalCount = sql<number>`count(*)`.mapWith(Number);

type LimitOffsetQuery<TRow> = {
  limit: (limit: number) => {
    offset: (offset: number) => PromiseLike<TRow[]>;
  };
};

type CountQuery = PromiseLike<{ total: number }[]>;

export async function paginateList<TRow>({
  countQuery,
  limit,
  offset,
  query,
}: {
  countQuery: CountQuery;
  limit: number;
  offset: number;
  query: LimitOffsetQuery<TRow>;
}) {
  const [items, countRows] = await Promise.all([
    query.limit(limit).offset(offset),
    countQuery,
  ]);

  return {
    items,
    total: countRows[0]?.total ?? 0,
  };
}
