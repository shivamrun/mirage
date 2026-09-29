import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountSection,
  AccountSectionStack,
} from "@/features/account/components/account-section";

function AccountReferralsSkeleton() {
  return (
    <AccountSectionStack>
      <AccountSection
        description="Share your invite link and track referred signups."
        title="Your referral link"
      >
        <div className="grid gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-full" />
          <div className="grid gap-3 sm:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </AccountSection>

      <AccountSection title="Referral history">
        <Skeleton className="h-44 w-full" />
      </AccountSection>
    </AccountSectionStack>
  );
}

function AccountReferralsError({ onRetry }: { onRetry: () => void }) {
  return (
    <AccountSection title="Referrals">
      <Empty className="border border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RefreshCw />
          </EmptyMedia>
          <EmptyTitle>Could not load referrals</EmptyTitle>
          <EmptyDescription>
            Refresh the page or try again in a moment.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRetry} type="button" variant="outline">
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        </EmptyContent>
      </Empty>
    </AccountSection>
  );
}

export { AccountReferralsError, AccountReferralsSkeleton };
