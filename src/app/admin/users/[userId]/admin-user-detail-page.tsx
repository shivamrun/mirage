import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  type AdminUserDetailSection,
  AdminUserDetailView,
} from "@/features/admin/components";
import { getAdminUserDetailView } from "@/server/db/services/admin/user-detail";
import { requireAdmin } from "@/server/db/services/auth/access";

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

  const detail = await getAdminUserDetailView(userId);

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
