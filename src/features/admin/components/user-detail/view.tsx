import type { PaginationMetadata } from "@evensurface/paginate";
import type {
  AdminUserDetailCreditLedgerEntry,
  AdminUserDetailReferralsView,
  AdminUserDetailViewModel,
} from "@/server/db/services/admin/user-detail";
import { isFutureDate } from "../shared/formatters";
import {
  AdminUserAccountsTab,
  AdminUserCreditLedgerTab,
  AdminUserReferralsTab,
  AdminUserSessionsTab,
} from "./activity-tabs";
import { AdminUserDetailHeader } from "./header";
import { AdminUserDetailOverview } from "./overview";

export type AdminUserDetailSection =
  | "accounts"
  | "ledger"
  | "overview"
  | "referrals"
  | "sessions";

export function AdminUserDetailView({
  currentUserId,
  detail,
  ledger,
  referrals,
  section = "overview",
}: {
  currentUserId: string;
  detail: AdminUserDetailViewModel;
  ledger?: {
    entries: AdminUserDetailCreditLedgerEntry[];
    pagination: PaginationMetadata;
  };
  referrals?: AdminUserDetailReferralsView;
  section?: AdminUserDetailSection;
}) {
  const {
    acceptedInvitation,
    accounts,
    creditBalance,
    referralSummary,
    sessions,
    user,
  } = detail;
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
        referralsLength={referralSummary.totalReferred}
        sessionsLength={sessions.length}
        user={user}
      />

      <div className="min-h-0 min-w-0 flex-1 pt-4 mb-6">
        {section === "overview" ? (
          <AdminUserDetailOverview
            acceptedInvitation={acceptedInvitation}
            creditBalance={creditBalance}
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

        {section === "ledger" && ledger ? (
          <AdminUserCreditLedgerTab
            entries={ledger.entries}
            pagination={ledger.pagination}
            userId={user.id}
          />
        ) : null}

        {section === "referrals" && referrals ? (
          <AdminUserReferralsTab
            referrals={referrals}
            summary={referralSummary}
            userId={user.id}
          />
        ) : null}
      </div>
    </div>
  );
}
