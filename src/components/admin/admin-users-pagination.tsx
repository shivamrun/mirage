import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUsersQueryState,
  usersPageHref,
} from "./admin-users-query";

type PaginationButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  href: string;
};

type AdminUsersPaginationProps = {
  page: number;
  total: number;
  totalPages: number;
  state: AdminUsersQueryState;
};

function PaginationButton({ children, disabled, href }: PaginationButtonProps) {
  if (disabled) {
    return (
      <Button disabled size="sm" type="button" variant="ghost">
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export function AdminUsersPagination({
  page,
  state,
  total,
  totalPages,
}: AdminUsersPaginationProps) {
  const isFirstPage = page === 1;
  const isLastPage = page >= totalPages;
  const firstResult = total === 0 ? 0 : (page - 1) * ADMIN_USERS_PAGE_SIZE + 1;
  const lastResult = Math.min(page * ADMIN_USERS_PAGE_SIZE, total);

  return (
    <footer className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
      <p className="text-sm text-muted-foreground">
        {total > 0 ? (
          <>
            {firstResult}-{lastResult} of {total.toLocaleString()} users
          </>
        ) : (
          "0 users"
        )}
      </p>

      <div className="flex items-center gap-2">
        <span className="mr-2 text-xs text-muted-foreground">
          Page {page} of {totalPages}
        </span>

        <PaginationButton
          disabled={isFirstPage}
          href={usersPageHref({
            page: page - 1,
            ...state,
          })}
        >
          Previous
        </PaginationButton>

        <PaginationButton
          disabled={isLastPage}
          href={usersPageHref({
            page: page + 1,
            ...state,
          })}
        >
          Next
        </PaginationButton>
      </div>
    </footer>
  );
}
