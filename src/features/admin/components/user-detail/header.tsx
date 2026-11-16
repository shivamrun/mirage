import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { resolveUploadPublicUrl } from "@/adapters/uploads";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { normalizeRoles } from "@/features/auth/roles";
import type { AdminUserDetailUser } from "@/server/db/services/admin/user-detail";
import { cn } from "@/shared/utils";
import { getInitials } from "../shared/user-display";
import type { AdminUserDetailSection } from "./view";

type AdminUserDetailHeaderProps = {
  accountsLength: number;
  activeSection: AdminUserDetailSection;
  hasActiveBan: boolean;
  isBanned: boolean;
  sessionsLength: number;
  user: AdminUserDetailUser;
};

export function AdminUserDetailHeader({
  accountsLength,
  activeSection,
  hasActiveBan,
  isBanned,
  sessionsLength,
  user,
}: AdminUserDetailHeaderProps) {
  const detailPath = `/admin/users/${user.id}`;
  const imageUrl = resolveUploadPublicUrl(user.image);
  const navLinkClass = (section: AdminUserDetailSection) =>
    cn(
      "link-text",
      activeSection === section && "text-foreground hover:text-foreground",
    );

  return (
    <header className="z-20 min-w-0 shrink-0">
      <div className="bg-background pb-3 pt-4">
        <Link
          href="/admin/users"
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>

        <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 w-full">
            <Avatar shape="rounded" className="size-12 shrink-0">
              {imageUrl ? <AvatarImage src={imageUrl} alt={user.name} /> : null}

              <AvatarFallback className="font-medium text-sm">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-semibold text-base">{user.name}</h1>

              <div className="mt-1 flex min-w-0 flex-col gap-2 text-muted-foreground text-sm lg:flex-row lg:items-center justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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

                <nav className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <Link
                    aria-current={
                      activeSection === "overview" ? "page" : undefined
                    }
                    className={navLinkClass("overview")}
                    href={detailPath}
                  >
                    [ view details ]
                  </Link>
                  <Link
                    aria-current={
                      activeSection === "accounts" ? "page" : undefined
                    }
                    className={navLinkClass("accounts")}
                    href={`${detailPath}/accounts`}
                  >
                    [ accounts: {accountsLength} ]
                  </Link>
                  <Link
                    aria-current={
                      activeSection === "sessions" ? "page" : undefined
                    }
                    className={navLinkClass("sessions")}
                    href={`${detailPath}/sessions`}
                  >
                    [ sessions: {sessionsLength} ]
                  </Link>
                  <Link
                    aria-current={
                      activeSection === "ledger" ? "page" : undefined
                    }
                    className={navLinkClass("ledger")}
                    href={`${detailPath}/ledger`}
                  >
                    [ ledger ]
                  </Link>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
