"use client";

import * as React from "react";
import { AccountPageShell } from "@/features/account/components/account-page";
import { AccountSectionStack } from "@/features/account/components/account-section";
import { authClient } from "@/features/auth/better-auth/client";
import { ReferralHistorySection } from "./referral-history-section";
import { ReferralLinkSection } from "./referral-link-section";
import {
  AccountReferralsError,
  AccountReferralsSkeleton,
} from "./referral-page-states";
import type { CopyStatus, ReferralDashboard, ReferralList } from "./types";
import { copyText, getReferralLink } from "./utils";

const REFERRALS_LIMIT = 10;

function AccountReferralsContent({
  copyStatus,
  dashboard,
  hasNextPage,
  hasPreviousPage,
  isLoading,
  onCopyReferralLink,
  onNextPage,
  onPreviousPage,
  referralLink,
  referralList,
}: {
  copyStatus: CopyStatus;
  dashboard: ReferralDashboard;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  onCopyReferralLink: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  referralLink: string;
  referralList: ReferralList;
}) {
  return (
    <AccountSectionStack>
      <ReferralLinkSection
        copyStatus={copyStatus}
        onCopy={onCopyReferralLink}
        referralLink={referralLink}
        stats={dashboard.stats}
      />
      <ReferralHistorySection
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
        isLoading={isLoading}
        onNextPage={onNextPage}
        onPreviousPage={onPreviousPage}
        referralList={referralList}
      />
    </AccountSectionStack>
  );
}

function AccountReferralsPage() {
  const [dashboard, setDashboard] = React.useState<ReferralDashboard | null>(
    null,
  );
  const [referralList, setReferralList] = React.useState<ReferralList | null>(
    null,
  );
  const [offset, setOffset] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string>();
  const [copyStatus, setCopyStatus] = React.useState<CopyStatus>("idle");

  const loadReferrals = React.useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const [dashboardResult, referralsResult] = await Promise.all([
        authClient.referrals(),
        authClient.referrals.listReferrals({
          query: {
            limit: REFERRALS_LIMIT,
            offset,
          },
        }),
      ]);

      if (dashboardResult.error || !dashboardResult.data) {
        throw new Error("Could not load referral dashboard.");
      }

      if (referralsResult.error || !referralsResult.data) {
        throw new Error("Could not load referral history.");
      }

      setDashboard(dashboardResult.data);
      setReferralList(referralsResult.data);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "Could not load referrals.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [offset]);

  React.useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  const referralLink = dashboard ? getReferralLink(dashboard.code) : "";
  const hasNextPage = referralList
    ? referralList.offset + referralList.limit < referralList.total
    : false;
  const hasPreviousPage = offset > 0;

  async function copyReferralLink() {
    if (!referralLink) {
      return;
    }

    const didCopy = await copyText(referralLink);
    setCopyStatus(didCopy ? "copied" : "failed");
    window.setTimeout(() => setCopyStatus("idle"), 1800);
  }

  function goToPreviousPage() {
    setOffset((currentOffset) => Math.max(0, currentOffset - REFERRALS_LIMIT));
  }

  function goToNextPage() {
    setOffset((currentOffset) => currentOffset + REFERRALS_LIMIT);
  }

  return (
    <AccountPageShell
      description="Share your invite link and see who has joined through it."
      title="Referrals"
    >
      {() => {
        if (isLoading && !dashboard && !referralList) {
          return <AccountReferralsSkeleton />;
        }

        if (error || !dashboard || !referralList) {
          return <AccountReferralsError onRetry={loadReferrals} />;
        }

        return (
          <AccountReferralsContent
            copyStatus={copyStatus}
            dashboard={dashboard}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            isLoading={isLoading}
            onCopyReferralLink={copyReferralLink}
            onNextPage={goToNextPage}
            onPreviousPage={goToPreviousPage}
            referralLink={referralLink}
            referralList={referralList}
          />
        );
      }}
    </AccountPageShell>
  );
}

export { AccountReferralsPage };
