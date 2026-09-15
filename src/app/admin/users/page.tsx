import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AdminUsersPagination,
  AdminUsersTable,
  AdminUsersToolbar,
} from "@/components/admin";
import {
  type AdminUsersPageSearchParams,
  adminUsersHrefFromSearchParams,
  adminUsersRawHrefFromSearchParams,
  getAdminUsersFilterStatus,
  parseAdminUsersSearchParams,
  usersPageHref,
} from "@/lib/admin/users-query";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import { listAdminUsersView } from "@/server/admin/users";

export const metadata = getPageMetadata("Users", {
  path: "/admin/users",
});

type AdminUsersPageProps = {
  searchParams: Promise<AdminUsersPageSearchParams>;
};

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams;
  const { page, ...listState } = parseAdminUsersSearchParams(params);
  const canonicalHref = adminUsersHrefFromSearchParams(params);
  const filterStatus = getAdminUsersFilterStatus(listState);
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  if (adminUsersRawHrefFromSearchParams(params) !== canonicalHref) {
    redirect(canonicalHref);
  }

  const users = await listAdminUsersView({
    page,
    state: listState,
  });

  if (page !== users.page) {
    redirect(
      usersPageHref({
        page: users.page,
        ...listState,
      }),
    );
  }

  const clearSearchHref = usersPageHref({
    filterField: listState.filterField,
    filterValue: listState.filterValue,
    filterOperator: listState.filterOperator,
    sortBy: listState.sortBy,
    sortDirection: listState.sortDirection,
  });

  const clearFiltersHref = usersPageHref({
    query: listState.query,
    searchField: listState.searchField,
    searchOperator: listState.searchOperator,
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Manage accounts, roles and user access.
        </p>
      </header>

      <AdminUsersToolbar
        clearFiltersHref={clearFiltersHref}
        clearSearchHref={clearSearchHref}
        state={listState}
        status={filterStatus}
      />

      <AdminUsersTable
        hasFilter={filterStatus.hasFilter}
        hasFilters={filterStatus.hasFilters}
        query={listState.query}
        users={users.users}
      />

      <AdminUsersPagination
        page={users.page}
        state={listState}
        total={users.total}
        totalPages={users.totalPages}
      />
    </div>
  );
}
