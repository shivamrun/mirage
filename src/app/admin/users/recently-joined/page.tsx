import { redirect } from "next/navigation";

import { usersPageHref } from "@/lib/admin/users-query";

const recentlyJoinedWindowDays = 3;

export default function RecentlyJoinedUsersPage() {
  const recentlyJoinedSince = new Date(
    Date.now() - recentlyJoinedWindowDays * 24 * 60 * 60 * 1000,
  );

  redirect(
    usersPageHref({
      filterField: "createdAt",
      filterValue: recentlyJoinedSince.toISOString().slice(0, 10),
    }),
  );
}
