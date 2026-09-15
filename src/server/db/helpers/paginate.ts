import { sql } from "drizzle-orm";

/**
 * Window expression that returns the total filtered row count alongside each
 * paginated result row, eliminating the need for a separate COUNT query.
 *
 * @example
 * const rows = await db
 *   .select({ ...getTableColumns(table), _total: totalCountWindow })
 *   .from(table)
 *   .where(condition)
 *   .orderBy(orderExpr)
 *   .limit(limit)
 *   .offset(offset);
 *
 * const total = rows[0]?._total ?? 0;
 * const items = rows.map(({ _total: _, ...row }) => row);
 */
export const totalCountWindow = sql<number>`count(*) over()`.mapWith(Number);
