import { getPageMetadata } from "@/lib/metadata";
import {
  AdminUserDetailPage,
  type AdminUserDetailRouteProps,
} from "../admin-user-detail-page";

export const metadata = getPageMetadata("User Sessions", {
  path: "/admin/users",
});

export default async function AdminUserSessionsPage({
  params,
}: AdminUserDetailRouteProps) {
  return <AdminUserDetailPage params={params} section="sessions" />;
}
