import { redirect } from "next/navigation";

export default function AdminBannedUsersPage() {
  redirect("/admin/users?filterField=banned&filterValue=true");
}
