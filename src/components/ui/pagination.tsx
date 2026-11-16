import {
  createPageWindow,
  type PaginationMetadata,
} from "@evensurface/paginate";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type PageHref = (page: number) => string;

type PaginationProps = {
  entityLabel: string;
  getPageHref: PageHref;
  pagination: PaginationMetadata;
};

function PaginationLinkButton({
  children,
  disabled,
  href,
  label,
}: {
  children: ReactNode;
  disabled?: boolean;
  href: string;
  label: string;
}) {
  if (disabled) {
    return (
      <Button
        aria-label={label}
        disabled
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size="icon-sm" variant="ghost">
      <Link aria-label={label} href={href}>
        {children}
      </Link>
    </Button>
  );
}

function PaginationPageButton({
  getPageHref,
  page,
  selected,
}: {
  getPageHref: PageHref;
  page: number;
  selected: boolean;
}) {
  if (selected) {
    return (
      <Button
        aria-current="page"
        aria-label={`Page ${page}`}
        disabled
        size="icon-sm"
        type="button"
        variant="outline"
      >
        {page}
      </Button>
    );
  }

  return (
    <Button asChild size="icon-sm" variant="ghost">
      <Link aria-label={`Go to page ${page}`} href={getPageHref(page)}>
        {page}
      </Link>
    </Button>
  );
}

function Pagination({ entityLabel, getPageHref, pagination }: PaginationProps) {
  const pages = createPageWindow({
    page: pagination.page,
    totalPages: pagination.totalPages,
  });
  const resultLabel =
    pagination.total > 0
      ? `${pagination.firstItem}-${pagination.lastItem} of ${pagination.total.toLocaleString()} ${entityLabel}`
      : `0 ${entityLabel}`;

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-4 pt-4">
      <p className="text-sm text-muted-foreground">{resultLabel}</p>

      <nav
        aria-label={`${entityLabel} pagination`}
        className="flex items-center gap-1"
      >
        <PaginationLinkButton
          disabled={!pagination.hasPreviousPage}
          href={getPageHref(pagination.page - 1)}
          label="Go to previous page"
        >
          <ChevronLeftIcon />
        </PaginationLinkButton>

        <div className="flex items-center gap-1">
          {pages.map((item, index) =>
            item === "ellipsis" ? (
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center text-muted-foreground"
                key={`ellipsis-${pages[index - 1]}-${pages[index + 1]}`}
              >
                <MoreHorizontalIcon className="size-3.5" />
              </span>
            ) : (
              <PaginationPageButton
                getPageHref={getPageHref}
                key={item}
                page={item}
                selected={item === pagination.page}
              />
            ),
          )}
        </div>

        <PaginationLinkButton
          disabled={!pagination.hasNextPage}
          href={getPageHref(pagination.page + 1)}
          label="Go to next page"
        >
          <ChevronRightIcon />
        </PaginationLinkButton>
      </nav>
    </footer>
  );
}

export { Pagination };
