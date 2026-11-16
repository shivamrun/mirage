import {
  getAdminUserDetail,
  listAdminUserCreditLedger,
} from "@/server/db/dal/admin-user-detail";
import { findAcceptedInvitationForUser } from "@/server/db/dal/invitations";
import { getCreditBalance } from "../credits/ledger";

const ADMIN_USER_DETAIL_PAGE_SIZE = 10;

export async function getAdminUserDetailView(userId: string) {
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    return null;
  }

  const [creditBalance, acceptedInvitation] = await Promise.all([
    getCreditBalance(userId),
    findAcceptedInvitationForUser(userId),
  ]);

  return {
    accounts: detail.accounts,
    acceptedInvitation,
    creditBalance,
    sessions: detail.sessions,
    user: detail.user,
  };
}

export async function getAdminUserCreditLedgerView({
  page,
  userId,
}: {
  page: number;
  userId: string;
}) {
  return listAdminUserCreditLedger({
    limit: ADMIN_USER_DETAIL_PAGE_SIZE,
    page,
    userId,
  });
}

export type AdminUserDetailViewModel = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetailView>>
>;
export type AdminUserDetailUser = AdminUserDetailViewModel["user"];
export type AdminUserDetailAcceptedInvitation =
  AdminUserDetailViewModel["acceptedInvitation"];
export type AdminUserDetailCreditBalance =
  AdminUserDetailViewModel["creditBalance"];
export type AdminUserDetailCreditLedgerEntry = Awaited<
  ReturnType<typeof getAdminUserCreditLedgerView>
>["items"][number];
export type AdminUserDetailAccount =
  AdminUserDetailViewModel["accounts"][number];
export type AdminUserDetailSession =
  AdminUserDetailViewModel["sessions"][number];
