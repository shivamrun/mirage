# Pagination

This app uses page/limit pagination with a small attach-on kit. The goal is to
keep list-specific code focused on filters, joins, and ordering while shared
helpers handle page math, `limit`/`offset`, total counts, out-of-range pages,
and UI controls.

## How It Works

Pagination is split across five layers:

| Layer | File | Owns |
| --- | --- | --- |
| Shared math | `src/shared/pagination.ts` | Page parsing, offsets, metadata, and page-number windows |
| Shared schemas | `src/shared/schemas/pagination.ts` | Reusable query and response contracts for future APIs |
| DAL helper | `src/server/db/helpers/paginate.ts` | Runs page and count queries, then returns `{ items, total }` |
| Service helper | `src/server/db/services/pagination.ts` | Builds a paginated view and clamps out-of-range pages |
| UI | `src/components/ui/pagination.tsx` | Renders result count, page numbers, ellipses, previous, and next |

The DAL passes two queries to `paginateList`: one query for the page rows and
one query for the exact filtered count. `paginateList` applies `limit` and
`offset` to the page query, runs the count query in parallel, and returns:

```ts
{
  items,
  total,
}
```

The service layer wraps that result with pagination metadata:

```ts
{
  items,
  pagination: {
    page,
    limit,
    offset,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    firstItem,
    lastItem,
  },
}
```

If a requested page is out of range, the service helper resolves the real last
page so the route can redirect to the canonical URL.

## Adding Pagination To A List

### 1. Add Page Parsing To The Feature Query Module

Keep URL parsing browser-safe in `src/features/<feature>/query/...`.

```ts
import { DEFAULT_PAGE_SIZE, parsePageParam } from "@/shared/pagination";

export const MY_LIST_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type MyListPageSearchParams = {
  [key: string]: SearchParamValue;
  page?: SearchParamValue;
  q?: SearchParamValue;
};

export function parseMyListSearchParams(params: MyListPageSearchParams) {
  return {
    page: parsePageParam(params.page),
    query: firstParamValue(params.q)?.trim() ?? "",
  };
}
```

### 2. Preserve Page In URL Builders

Only include `page` when it is greater than 1. This keeps first-page URLs clean.

```ts
export function myListPageHref({
  page = 1,
  query,
}: {
  page?: number;
  query?: string;
}) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (query) {
    params.set("q", query);
  }

  const search = params.toString();

  return search ? `/admin/my-list?${search}` : "/admin/my-list";
}
```

Also add raw/canonical helpers when the route should redirect malformed query
params:

```ts
export function myListRawHrefFromSearchParams(params: MyListPageSearchParams) {
  return rawHrefFromSearchParams("/admin/my-list", params);
}

export function myListHrefFromSearchParams(params: MyListPageSearchParams) {
  return myListPageHref(parseMyListSearchParams(params));
}
```

### 3. Add `limit` And `offset` To The DAL Options

The DAL owns filters, joins, selected fields, and ordering. It should not own
page clamping or redirect behavior.

```ts
import { paginateList, totalCount } from "@/server/db/helpers/paginate";

export async function listMyItems({
  limit,
  offset,
  state,
}: {
  limit: number;
  offset: number;
  state: MyListQueryState;
}) {
  const whereClause = getWhereClause(state);
  let query = db
    .select({
      id: myTable.id,
      name: myTable.name,
      createdAt: myTable.createdAt,
    })
    .from(myTable)
    .$dynamic();
  let totalQuery = db
    .select({ total: totalCount })
    .from(myTable)
    .$dynamic();

  if (whereClause) {
    query = query.where(whereClause);
    totalQuery = totalQuery.where(whereClause);
  }

  const result = await paginateList({
    countQuery: totalQuery,
    limit,
    offset,
    query: query.orderBy(desc(myTable.createdAt), asc(myTable.id)),
  });

  return {
    items: result.items,
    total: result.total,
  };
}
```

Use a stable tie-breaker in `orderBy`, usually `asc(table.id)`, so rows do not
jump between pages when several rows share the same sort value.

### 4. Wrap The DAL In A Service View

Use `resolvePaginatedView` to turn a DAL loader into page metadata and
out-of-range handling.

```ts
import { resolvePaginatedView } from "@/server/db/services/pagination";

export async function listMyItemsView({
  page,
  state,
}: {
  page: number;
  state: MyListQueryState;
}) {
  const result = await resolvePaginatedView({
    limit: MY_LIST_PAGE_SIZE,
    page,
    loadPage: async ({ limit, offset }) => {
      const result = await listMyItems({ limit, offset, state });

      return {
        items: result.items,
        total: result.total,
      };
    },
  });

  return {
    ...result.pagination,
    items: result.items,
  };
}
```

### 5. Redirect Non-Canonical URLs In The Page

Routes should parse `page` separately from the rest of the list state.

```tsx
const params = await searchParams;
const { page, ...state } = parseMyListSearchParams(params);
const canonicalHref = myListHrefFromSearchParams(params);

if (myListRawHrefFromSearchParams(params) !== canonicalHref) {
  redirect(canonicalHref);
}

const result = await listMyItemsView({ page, state });

if (page !== result.page) {
  redirect(myListPageHref({ page: result.page, ...state }));
}
```

### 6. Render The Shared Component

Pass the whole paginated view object to `Pagination`; it satisfies the shared
metadata shape.

```tsx
<Pagination
  entityLabel="items"
  getPageHref={(page) =>
    myListPageHref({
      page,
      ...state,
    })
  }
  pagination={result}
/>
```

Forms that change filters or search should not preserve the current page.
Submitting a new search should naturally return to page 1.

## Testing Checklist

For a new paginated list, cover:

- invalid `page` values parse to page 1
- page links preserve search/filter/sort state
- first-page URLs omit `page`
- filtered totals are correct
- out-of-range pages clamp to the last valid page
- page queries and count queries use the same filter conditions

`tests/pagination.test.ts` has examples for users, contact submissions, email
submissions, and the low-level `paginateList` helper.

## Current Paginated Lists

- `/admin/users`
- `/admin/contact-submission/all`
- `/admin/email-list/submissions`

Email list management at `/admin/email-list/all` is intentionally unpaginated
because it is a small configuration table rather than a high-volume feed.
