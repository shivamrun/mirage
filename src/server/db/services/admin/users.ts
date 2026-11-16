import type { PaginatedResult } from "@evensurface/paginate";
import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUsersQueryState,
} from "@/features/admin/query/users-query";
import {
  type AdminUserListItem,
  listAdminUsers,
} from "@/server/db/dal/admin-users";

export type { AdminUserListItem };

export type AdminUsersListView = PaginatedResult<AdminUserListItem>;

export async function listAdminUsersView({
  page,
  state,
}: {
  page: number;
  state: AdminUsersQueryState;
}): Promise<AdminUsersListView> {
  return listAdminUsers({
    limit: ADMIN_USERS_PAGE_SIZE,
    page,
    state,
  });
}
