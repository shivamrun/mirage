# Pagination

The app uses numbered-page pagination from `@evensurface/paginate` and its
Drizzle integration, `@evensurface/paginate-drizzle`.

Every paginated result uses the library contract:

```ts
{
  items: TItem[];
  pagination: {
    page: number;
    limit: number;
    offset: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    firstItem: number;
    lastItem: number;
  };
}
```

For an empty result, `page` is `1` and `totalPages`, `firstItem`, and
`lastItem` are `0`. Requests beyond the final page are resolved to the final
available page.

## Database lists

DAL functions call `paginateDrizzle()` directly. The item query must be a
factory that returns a fresh Drizzle query, and the count query must use the
same filters:

```ts
import { asc, desc } from "drizzle-orm";
import { paginateDrizzle } from "@evensurface/paginate-drizzle";

return paginateDrizzle({
  query: () =>
    db
      .select({ id: records.id, createdAt: records.createdAt })
      .from(records)
      .where(whereClause)
      .orderBy(desc(records.createdAt), asc(records.id)),
  countQuery: db.$count(records, whereClause),
  page,
  limit,
});
```

Always add a unique tie-breaker to `orderBy`. When a filtered count needs
joins, use a matching Drizzle `select({ total: count() })` query instead of
`db.$count()`.

Services may transform item values, but must preserve the result envelope and
the library-generated `pagination` object. They must not recalculate page
metadata.

## URL handling and UI

URL query modules use `parsePage()` from `@evensurface/paginate` after taking
the first value from a Next.js search parameter. Existing canonical URL
builders continue to omit page 1 and preserve filters and sorting.

Pages redirect when the requested page differs from
`result.pagination.page`. Pass `result.pagination` to the shared
`Pagination` component. The component uses the library's `createPageWindow()`
for numbered links and ellipses.

## Testing

Focused pagination tests should cover:

- invalid pages resolving to page 1;
- the exact `{ items, pagination }` result shape;
- filtered counts matching item filters;
- stable ordering with a unique tie-breaker;
- empty-list metadata (`totalPages: 0`);
- out-of-range pages resolving to the last page with its items;
- canonical URLs preserving filters and sorting.
