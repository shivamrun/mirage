export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export type SearchParamValue = string | string[] | undefined;

export type PaginationMeta = {
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

export type PaginationWindowItem = "ellipsis" | number;

function firstParamValue(value?: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function parsePageParam(value?: SearchParamValue) {
  return parsePositiveInteger(firstParamValue(value)) ?? DEFAULT_PAGE;
}

export function parseLimitParam(
  value?: SearchParamValue,
  {
    defaultLimit = DEFAULT_PAGE_SIZE,
    maxLimit = MAX_PAGE_SIZE,
  }: {
    defaultLimit?: number;
    maxLimit?: number;
  } = {},
) {
  const limit = parsePositiveInteger(firstParamValue(value)) ?? defaultLimit;

  return Math.min(limit, maxLimit);
}

export function getPaginationOffset({
  limit,
  page,
}: {
  limit: number;
  page: number;
}) {
  return (Math.max(page, DEFAULT_PAGE) - 1) * limit;
}

export function createPaginationMeta({
  limit,
  page,
  total,
}: {
  limit: number;
  page: number;
  total: number;
}): PaginationMeta {
  const safeLimit = Math.max(1, limit);
  const safeTotal = Math.max(0, total);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  const currentPage = Math.min(Math.max(page, DEFAULT_PAGE), totalPages);
  const offset = getPaginationOffset({ limit: safeLimit, page: currentPage });
  const firstItem = safeTotal === 0 ? 0 : offset + 1;
  const lastItem = Math.min(offset + safeLimit, safeTotal);

  return {
    page: currentPage,
    limit: safeLimit,
    offset,
    total: safeTotal,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > DEFAULT_PAGE,
    firstItem,
    lastItem,
  };
}

export function getPaginationWindow({
  boundaries = 1,
  page,
  siblings = 1,
  totalPages,
}: {
  boundaries?: number;
  page: number;
  siblings?: number;
  totalPages: number;
}): PaginationWindowItem[] {
  const safeTotalPages = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(page, DEFAULT_PAGE), safeTotalPages);
  const safeBoundaries = Math.max(0, boundaries);
  const safeSiblings = Math.max(0, siblings);
  const visiblePages = new Set<number>();

  for (let index = 1; index <= safeBoundaries; index += 1) {
    visiblePages.add(index);
    visiblePages.add(safeTotalPages - index + 1);
  }

  for (
    let index = currentPage - safeSiblings;
    index <= currentPage + safeSiblings;
    index += 1
  ) {
    visiblePages.add(index);
  }

  const pages = Array.from(visiblePages)
    .filter((item) => item >= 1 && item <= safeTotalPages)
    .sort((left, right) => left - right);
  const windowItems: PaginationWindowItem[] = [];
  let previousPage = 0;

  for (const item of pages) {
    if (previousPage > 0 && item - previousPage > 1) {
      windowItems.push("ellipsis");
    }

    windowItems.push(item);
    previousPage = item;
  }

  return windowItems;
}
