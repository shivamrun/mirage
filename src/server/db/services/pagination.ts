import {
  createPaginationMeta,
  getPaginationOffset,
  type PaginationMeta,
} from "@/shared/pagination";

type PageLoader<TItem> = ({
  limit,
  offset,
}: {
  limit: number;
  offset: number;
}) => Promise<{
  items: TItem[];
  total: number;
}>;

export type PaginatedView<TItem> = {
  items: TItem[];
  pagination: PaginationMeta;
};

export async function resolvePaginatedView<TItem>({
  limit,
  loadPage,
  page,
}: {
  limit: number;
  loadPage: PageLoader<TItem>;
  page: number;
}): Promise<PaginatedView<TItem>> {
  const requestedPage = Math.max(1, page);
  const result = await loadPage({
    limit,
    offset: getPaginationOffset({ limit, page: requestedPage }),
  });

  if (result.items.length > 0 || requestedPage === 1) {
    return {
      items: result.items,
      pagination: createPaginationMeta({
        limit,
        page: requestedPage,
        total: result.total,
      }),
    };
  }

  const firstPage = await loadPage({
    limit,
    offset: 0,
  });

  return {
    items: [],
    pagination: createPaginationMeta({
      limit,
      page: requestedPage,
      total: firstPage.total,
    }),
  };
}
