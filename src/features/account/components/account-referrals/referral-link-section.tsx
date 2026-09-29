import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountSection } from "@/features/account/components/account-section";
import type { CopyStatus, ReferralDashboard } from "./types";

function ReferralStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/25 px-4 py-3">
      <div className="font-semibold text-2xl leading-8">{value}</div>
      <div className="text-muted-foreground text-sm leading-5">{label}</div>
    </div>
  );
}

function ReferralStatsGrid({ stats }: { stats: ReferralDashboard["stats"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <ReferralStat label="Total" value={stats.total} />
      <ReferralStat label="Completed" value={stats.completed} />
      <ReferralStat label="Pending" value={stats.pending} />
      <ReferralStat label="Joined today" value={stats.joinedToday} />
    </div>
  );
}

function ReferralLinkSection({
  copyStatus,
  onCopy,
  referralLink,
  stats,
}: {
  copyStatus: CopyStatus;
  onCopy: () => void;
  referralLink: string;
  stats: ReferralDashboard["stats"];
}) {
  const isCopied = copyStatus === "copied";
  const isFailed = copyStatus === "failed";

  return (
    <AccountSection
      description="Invite people with this link. A referral completes after their email is verified."
      title="Your referral link"
    >
      <div className="grid gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            aria-label="Referral link"
            className="font-mono"
            readOnly
            value={referralLink}
          />
          <Button
            className="shrink-0"
            onClick={onCopy}
            type="button"
            variant="outline"
          >
            {isCopied ? (
              <Check data-icon="inline-start" />
            ) : (
              <Copy data-icon="inline-start" />
            )}
            {isCopied ? "Copied" : isFailed ? "Copy failed" : "Copy link"}
          </Button>
        </div>

        {isFailed ? (
          <p className="text-muted-foreground text-sm">
            Copy was blocked by the browser. Select the link and copy it
            manually.
          </p>
        ) : null}

        <ReferralStatsGrid stats={stats} />
      </div>
    </AccountSection>
  );
}

export { ReferralLinkSection };
