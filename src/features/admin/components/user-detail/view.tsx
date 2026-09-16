import type { AdminUserDetailViewModel } from "@/server/db/services/admin/user-detail";
import { isFutureDate } from "../shared/formatters";
import { AdminUserAccountsTab, AdminUserSessionsTab } from "./activity-tabs";
import { AdminUserDetailHeader } from "./header";
import { AdminUserDetailOverview } from "./overview";

export type AdminUserDetailSection = "accounts" | "overview" | "sessions";

export function AdminUserDetailView({
  currentUserId,
  detail,
  section = "overview",
}: {
  currentUserId: string;
  detail: AdminUserDetailViewModel;
  section?: AdminUserDetailSection;
}) {
  const { accounts, sessions, user } = detail;
  const now = new Date();
  const isBanned = Boolean(user.banned);
  const hasActiveBan = Boolean(
    user.banned && (!user.banExpires || isFutureDate(user.banExpires, now)),
  );

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <AdminUserDetailHeader
        accountsLength={accounts.length}
        activeSection={section}
        hasActiveBan={hasActiveBan}
        isBanned={isBanned}
        sessionsLength={sessions.length}
        user={user}
      />

      <div className="min-h-0 min-w-0 flex-1 pt-4 mb-6">
        {section === "overview" ? (
          <AdminUserDetailOverview
            currentUserId={currentUserId}
            hasActiveBan={hasActiveBan}
            isBanned={isBanned}
            user={user}
          />
        ) : null}

        {section === "accounts" ? (
          <AdminUserAccountsTab accounts={accounts} userId={user.id} />
        ) : null}

        {section === "sessions" ? (
          <AdminUserSessionsTab
            now={now}
            sessions={sessions}
            userId={user.id}
          />
        ) : null}
      </div>
    </div>
  );
}
