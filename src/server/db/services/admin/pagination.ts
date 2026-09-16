export function resolveOffsetPagination({
  page,
  limit,
  total,
}: {
  page: number;
  limit: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  return {
    page: currentPage,
    totalPages,
    offset: (currentPage - 1) * limit,
  };
}
