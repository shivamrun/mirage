import { desc, eq } from "drizzle-orm";
import db from "@/server/db";
import { getAdminUserDetail } from "@/server/db/dal/admin-user-detail";
import { paginateList, totalCount } from "@/server/db/helpers/paginate";
import { creditLedgerEntries } from "@/server/db/schema";
import { resolvePaginatedView } from "@/server/db/services/pagination";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";
import { getCreditBalance } from "../credits/ledger";

export async function getAdminUserDetailView(userId: string) {
  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    return null;
  }

  const creditBalance = await getCreditBalance(userId);

  return {
    accounts: detail.accounts,
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
  return resolvePaginatedView({
    limit: DEFAULT_PAGE_SIZE,
    page,
    loadPage: ({ limit, offset }) =>
      paginateList({
        countQuery: db
          .select({ total: totalCount })
          .from(creditLedgerEntries)
          .where(eq(creditLedgerEntries.userId, userId)),
        limit,
        offset,
        query: db
          .select()
          .from(creditLedgerEntries)
          .where(eq(creditLedgerEntries.userId, userId))
          .orderBy(desc(creditLedgerEntries.createdAt)),
      }),
  });
}

export type AdminUserDetailViewModel = NonNullable<
  Awaited<ReturnType<typeof getAdminUserDetailView>>
>;
export type AdminUserDetailUser = AdminUserDetailViewModel["user"];
export type AdminUserDetailCreditBalance =
  AdminUserDetailViewModel["creditBalance"];
export type AdminUserDetailCreditLedgerEntry = Awaited<
  ReturnType<typeof getAdminUserCreditLedgerView>
>["items"][number];
export type AdminUserDetailAccount =
  AdminUserDetailViewModel["accounts"][number];
export type AdminUserDetailSession =
  AdminUserDetailViewModel["sessions"][number];
