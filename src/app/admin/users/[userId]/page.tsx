import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { AdminUserDetailView } from "@/components/admin/admin-user-detail-view";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import { getAdminUserDetail } from "@/server/db/dal/admin-user-detail";

export const metadata = getPageMetadata("User Detail", {
  path: "/admin/users",
});

type AdminUserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const requestHeaders = await headers();
  const { userId } = await params;

  const currentUser = await requireAdmin({
    headers: requestHeaders,
  });

  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    notFound();
  }

  return <AdminUserDetailView currentUserId={currentUser.id} detail={detail} />;
}
