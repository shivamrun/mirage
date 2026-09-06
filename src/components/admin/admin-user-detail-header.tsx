import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeRoles } from "@/lib/auth/roles";
import type { AdminUserDetail } from "@/server/db/dal/admin-user-detail";
import { getInitials } from "./admin-users-table-helpers";

type AdminUserDetailHeaderProps = {
  hasActiveBan: boolean;
  isBanned: boolean;
  user: AdminUserDetail["user"];
};

export function AdminUserDetailHeader({
  hasActiveBan,
  isBanned,
  user,
}: AdminUserDetailHeaderProps) {
  return (
    <header className="min-w-0 shrink-0">
      <div className="py-5">
        <Link
          href="/admin/users"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>

        <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar shape="rounded" className="size-12 shrink-0">
              {user.image ? (
                <AvatarImage src={user.image} alt={user.name} />
              ) : null}

              <AvatarFallback className="font-medium text-sm">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-semibold text-base">{user.name}</h1>

              <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground text-sm">
                <span className="min-w-0 truncate">{user.email}</span>
                <span className="text-border">|</span>

                {user.role
                  ? normalizeRoles(user.role).map((role) => (
                      <span
                        key={role}
                        className="text-sky-600 dark:text-sky-400"
                      >
                        [ {role} ]
                      </span>
                    ))
                  : null}

                <span
                  className={
                    user.emailVerified
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }
                >
                  [ email: {user.emailVerified ? "verified" : "unverified"} ]
                </span>

                {isBanned ? (
                  <span
                    className={
                      hasActiveBan
                        ? "text-destructive"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    [ {hasActiveBan ? "banned" : "ban expired"} ]
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    [ active ]
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
