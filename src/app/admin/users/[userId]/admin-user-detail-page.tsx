import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  type AdminUserDetailSection,
  AdminUserDetailView,
} from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getAdminUserDetail } from "@/server/db/dal/admin-user-detail";

type AdminUserDetailRouteProps = {
  params: Promise<{
    userId: string;
  }>;
};

export async function AdminUserDetailPage({
  params,
  section,
}: AdminUserDetailRouteProps & {
  section: AdminUserDetailSection;
}) {
  const requestHeaders = await headers();
  const { userId } = await params;

  const currentUser = await requireAdmin({
    headers: requestHeaders,
  });

  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    notFound();
  }

  return (
    <AdminUserDetailView
      currentUserId={currentUser.id}
      detail={detail}
      section={section}
    />
  );
}

export type { AdminUserDetailRouteProps };
