import { getAdminUserDetail } from "@/server/db/dal/admin-user-detail";

export async function getAdminUserDetailView(userId: string) {
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    return null;
  }

  return {
    accounts: detail.accounts,
    sessions: detail.sessions,
    user: detail.user,
  };
}

export type AdminUserDetailViewModel = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetailView>>
>;
export type AdminUserDetailUser = AdminUserDetailViewModel["user"];
export type AdminUserDetailAccount =
  AdminUserDetailViewModel["accounts"][number];
export type AdminUserDetailSession =
  AdminUserDetailViewModel["sessions"][number];
