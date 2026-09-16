import {
  ADMIN_USERS_PAGE_SIZE,
  type AdminUsersQueryState,
} from "@/features/admin/query/users-query";
import {
  type AdminUserListItem,
  listAdminUsers,
} from "@/server/db/dal/admin-users";
import { resolveOffsetPagination } from "./pagination";

export type { AdminUserListItem };

export type AdminUsersListView = {
  limit: number;
  offset: number;
  page: number;
  total: number;
  totalPages: number;
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
  const requestedOffset = (page - 1) * limit;
  const result = await listAdminUsers({
    limit,
    offset: requestedOffset,
    state,
  });

  if (result.users.length > 0 || page === 1) {
    const pagination = resolveOffsetPagination({
      limit,
      page,
      total: result.total,
    });

    return {
      ...result,
      ...pagination,
    };
  }

  const firstPageResult = await listAdminUsers({
    limit,
    offset: 0,
    state,
  });
  const pagination = resolveOffsetPagination({
    limit,
    page,
    total: firstPageResult.total,
  });

  return {
    limit,
    offset: pagination.offset,
    page: pagination.page,
    total: firstPageResult.total,
    totalPages: pagination.totalPages,
    users: [],
  };
}
