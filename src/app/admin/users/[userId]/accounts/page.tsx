import { getPageMetadata } from "@/lib/metadata";
import {
  AdminUserDetailPage,
  type AdminUserDetailRouteProps,
} from "../admin-user-detail-page";

export const metadata = getPageMetadata("User Accounts", {
  path: "/admin/users",
});

export default async function AdminUserAccountsPage({
  params,
}: AdminUserDetailRouteProps) {
  return <AdminUserDetailPage params={params} section="accounts" />;
}
