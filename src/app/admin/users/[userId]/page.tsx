import { getPageMetadata } from "@/shared/metadata";
import {
  AdminUserDetailPage as AdminUserDetailPageContent,
  type AdminUserDetailRouteProps,
} from "./admin-user-detail-page";

export const metadata = getPageMetadata("User Detail", {
  path: "/admin/users",
});

export default async function UserDetailPage({
  params,
}: AdminUserDetailRouteProps) {
  return <AdminUserDetailPageContent params={params} section="overview" />;
}
