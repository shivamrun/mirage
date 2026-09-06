import { Fingerprint, Link2, Monitor, UserRound } from "lucide-react";

import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import type { AdminUserDetail } from "@/server/db/dal/admin-user-detail";
import {
  AdminUserAccountsTab,
  AdminUserSessionsTab,
  AdminUserVerificationTab,
} from "./admin-user-detail-activity-tabs";
import { isFutureDate } from "./admin-user-detail-formatters";
import { AdminUserDetailHeader } from "./admin-user-detail-header";
import { AdminUserDetailOverview } from "./admin-user-detail-overview";
import { WorkspaceTabTrigger } from "./admin-user-detail-primitives";

export function AdminUserDetailView({
  currentUserId,
  detail,
}: {
  currentUserId: string;
  detail: AdminUserDetail;
}) {
  const { accounts, sessions, user, verifications } = detail;
  const now = new Date();
  const isBanned = Boolean(user.banned);
  const hasActiveBan = Boolean(
    user.banned && (!user.banExpires || isFutureDate(user.banExpires, now)),
  );

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <AdminUserDetailHeader
        hasActiveBan={hasActiveBan}
        isBanned={isBanned}
        user={user}
      />

      <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-5">
        <TabsList className="flex h-10! w-full gap-1 overflow-hidden rounded-none rounded-t-md border-0 border-b bg-transparent p-0">
          <WorkspaceTabTrigger
            icon={UserRound}
            label="Overview"
            value="overview"
          />
          <WorkspaceTabTrigger
            count={accounts.length}
            icon={Link2}
            label="Accounts"
            value="accounts"
          />
          <WorkspaceTabTrigger
            count={sessions.length}
            icon={Monitor}
            label="Sessions"
            value="sessions"
          />
          <WorkspaceTabTrigger
            count={verifications.length}
            icon={Fingerprint}
            label="Verification"
            value="verification"
          />
        </TabsList>

        <div className="min-h-0 min-w-0">
          <TabsContent className="mt-0 min-h-0 min-w-0" value="overview">
            <AdminUserDetailOverview
              currentUserId={currentUserId}
              hasActiveBan={hasActiveBan}
              isBanned={isBanned}
              user={user}
            />
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="accounts">
            <AdminUserAccountsTab accounts={accounts} />
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="sessions">
            <AdminUserSessionsTab now={now} sessions={sessions} />
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="verification">
            <AdminUserVerificationTab
              now={now}
              user={user}
              verifications={verifications}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
