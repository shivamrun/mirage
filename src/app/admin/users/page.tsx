import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import {
  AdminUsersTable,
  AdminUsersToolbar,
} from "@/features/admin/components";
import {
  type AdminUsersPageSearchParams,
  adminUsersHrefFromSearchParams,
  adminUsersRawHrefFromSearchParams,
  getAdminUsersFilterStatus,
  parseAdminUsersSearchParams,
  usersPageHref,
} from "@/features/admin/query/users-query";
import { listAdminUsersView } from "@/server/db/services/admin/users";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

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

      <Pagination
        entityLabel="users"
        getPageHref={(page) =>
          usersPageHref({
            page,
            ...listState,
          })
        }
        pagination={users}
      />
    </div>
  );
}
