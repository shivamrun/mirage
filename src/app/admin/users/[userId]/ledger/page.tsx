import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AdminUserDetailView } from "@/features/admin/components";
import type { SearchParamValue } from "@/features/admin/query/query-params";
import {
  getAdminUserCreditLedgerView,
  getAdminUserDetailView,
} from "@/server/db/services/admin/user-detail";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";
import { parsePageParam } from "@/shared/pagination";

export const metadata = getPageMetadata("User Credit Ledger", {
  path: "/admin/users",
});

type AdminUserLedgerPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    page?: SearchParamValue;
  }>;
};

function ledgerPageHref(userId: string, page: number) {
  return page > 1
    ? `/admin/users/${userId}/ledger?page=${page}`
    : `/admin/users/${userId}/ledger`;
}

export default async function AdminUserLedgerPage({
  params,
  searchParams,
}: AdminUserLedgerPageProps) {
  const requestHeaders = await headers();
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const page = parsePageParam(query.page);

  const currentUser = await requireAdmin({
    headers: requestHeaders,
  });

  const detail = await getAdminUserDetailView(userId);

  if (!detail) {
    notFound();
  }

  const ledger = await getAdminUserCreditLedgerView({ page, userId });

  if (page !== ledger.pagination.page) {
    redirect(ledgerPageHref(userId, ledger.pagination.page));
  }

  return (
    <AdminUserDetailView
      currentUserId={currentUser.id}
      detail={detail}
      ledger={{
        entries: ledger.items,
        pagination: ledger.pagination,
      }}
      section="ledger"
    />
  );
}
