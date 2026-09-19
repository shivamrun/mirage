import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUsersQueryState,
} from "@/features/admin/query/users-query";
import {
  type AdminUserListItem,
  listAdminUsers,
} from "@/server/db/dal/admin-users";
import type { PaginationMeta } from "@/shared/pagination";
import { resolvePaginatedView } from "../pagination";

export type { AdminUserListItem };

export type AdminUsersListView = PaginationMeta & {
  users: AdminUserListItem[];
};

export async function listAdminUsersView({
  page,
  state,
}: {
  page: number;
  state: AdminUsersQueryState;
}): Promise<AdminUsersListView> {
  const limit = ADMIN_USERS_PAGE_SIZE;
  const result = await resolvePaginatedView({
    limit,
    page,
    loadPage: async ({ limit, offset }) => {
      const result = await listAdminUsers({
        limit,
        offset,
        state,
      });

      return {
        items: result.users,
        total: result.total,
      };
    },
  });

  return {
    ...result.pagination,
    users: result.items,
  };
}
