import { parsePage } from "@evensurface/paginate";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AdminUserDetailView } from "@/features/admin/components";
import {
  firstParamValue,
  type SearchParamValue,
} from "@/features/admin/query/query-params";
import {
  getAdminUserDetailView,
  getAdminUserReferralsView,
} from "@/server/db/services/admin/user-detail";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("User Referrals", {
  path: "/admin/users",
});

type AdminUserReferralsPageProps = {
  params: Promise<{
    userId: string;
  }>;
  searchParams: Promise<{
    page?: SearchParamValue;
  }>;
};

function referralsPageHref(userId: string, page: number) {
  return page > 1
    ? `/admin/users/${userId}/referrals?page=${page}`
    : `/admin/users/${userId}/referrals`;
}

export default async function AdminUserReferralsPage({
  params,
  searchParams,
}: AdminUserReferralsPageProps) {
  const requestHeaders = await headers();
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const page = parsePage(firstParamValue(query.page));

  const currentUser = await requireAdmin({
    headers: requestHeaders,
  });

  const detail = await getAdminUserDetailView(userId);

  if (!detail) {
    notFound();
  }

  const referrals = await getAdminUserReferralsView({ page, userId });

  if (page !== referrals.pagination.page) {
    redirect(referralsPageHref(userId, referrals.pagination.page));
  }

  return (
    <AdminUserDetailView
      currentUserId={currentUser.id}
      detail={detail}
      referrals={referrals}
      section="referrals"
    />
  );
}
