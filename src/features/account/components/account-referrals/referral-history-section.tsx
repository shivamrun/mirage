import { Gift, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountSection } from "@/features/account/components/account-section";
import type { ReferralList, ReferralListItem } from "./types";
import { formatDate } from "./utils";

function ReferralHistoryEmpty() {
  return (
    <Empty className="border border-border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Gift />
        </EmptyMedia>
        <EmptyTitle>No referrals yet</EmptyTitle>
        <EmptyDescription>
          Share your link to start inviting people.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function ReferralHistoryTable({
  referrals,
}: {
  referrals: ReferralListItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Person</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((referral) => (
          <TableRow key={referral.id}>
            <TableCell>
              <div className="font-medium">
                {referral.referredUser.name || "New user"}
              </div>
              <div className="text-muted-foreground text-xs">
                {referral.referredUser.email}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  referral.status === "completed" ? "secondary" : "outline"
                }
              >
                {referral.status === "completed" ? "Completed" : "Pending"}
              </Badge>
            </TableCell>
            <TableCell>{formatDate(referral.createdAt)}</TableCell>
            <TableCell>{formatDate(referral.completedAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReferralPagination({
  hasNextPage,
  hasPreviousPage,
  isLoading,
  onNextPage,
  onPreviousPage,
  total,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <UsersRound className="size-4" />
        {total} total
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={!hasPreviousPage || isLoading}
          onClick={onPreviousPage}
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <Button
          disabled={!hasNextPage || isLoading}
          onClick={onNextPage}
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function ReferralHistorySection({
  hasNextPage,
  hasPreviousPage,
  isLoading,
  onNextPage,
  onPreviousPage,
  referralList,
}: {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  referralList: ReferralList;
}) {
  return (
    <AccountSection
      description="Pending referrals complete once the referred user verifies their email."
      title="Referral history"
    >
      {referralList.items.length === 0 ? (
        <ReferralHistoryEmpty />
      ) : (
        <div className="grid gap-4">
          <ReferralHistoryTable referrals={referralList.items} />
          <ReferralPagination
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            isLoading={isLoading}
            onNextPage={onNextPage}
            onPreviousPage={onPreviousPage}
            total={referralList.pagination.total}
          />
        </div>
      )}
    </AccountSection>
  );
}

export { ReferralHistorySection };
