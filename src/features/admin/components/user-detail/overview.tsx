import {
  Ban,
  CheckCircle2,
  CircleDollarSign,
  CircleOff,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { normalizeRoles } from "@/features/auth/roles";
import type {
  AdminUserDetailAcceptedInvitation,
  AdminUserDetailCreditBalance,
  AdminUserDetailUser,
} from "@/server/db/services/admin/user-detail";
import { formatDate, formatValue } from "../shared/formatters";
import { formatRoleName } from "../shared/user-display";
import { AdminCreditAdjustmentDialog } from "./dialogs/credit-adjustment-dialog";
import { AdminUserImpersonateDialog } from "./dialogs/impersonation-dialog";
import {
  AdminUserBanDialog,
  AdminUserEmailUpdateDialog,
  AdminUserEmailVerificationDialog,
  AdminUserImageUpdateDialog,
  AdminUserNameUpdateDialog,
  AdminUserPasswordResetDialog,
  AdminUserPasswordUpdateDialog,
  AdminUserRemoveDialog,
  AdminUserRoleUpdateDialog,
} from "./dialogs/user-management-dialogs";
import {
  DetailPanel,
  DetailRow,
  DetailSection,
  StatusBadge,
} from "./primitives";

type AdminUserDetailOverviewProps = {
  acceptedInvitation: AdminUserDetailAcceptedInvitation;
  currentUserId: string;
  creditBalance: AdminUserDetailCreditBalance;
  hasActiveBan: boolean;
  isBanned: boolean;
  user: AdminUserDetailUser;
};

function formatPlanName(value: string) {
  return value
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function AdminUserCreditsSection({
  creditBalance,
  userId,
}: {
  creditBalance: AdminUserDetailCreditBalance;
  userId: string;
}) {
  return (
    <DetailPanel
      actions={
        <Button asChild size="sm" type="button" variant="outline">
          <Link href={`/admin/users/${userId}/ledger`}>Show all ledger</Link>
        </Button>
      }
      description="Current balance, period allowance, and lifetime totals."
      title="Credits"
    >
      <DetailSection title="Balance">
        <DetailRow
          action={<AdminCreditAdjustmentDialog userId={userId} />}
          label="Available credits"
        >
          <StatusBadge icon={CircleDollarSign} tone="good">
            {creditBalance.account.availableCredits}
          </StatusBadge>
        </DetailRow>
        <DetailRow label="Current period allowance">
          {creditBalance.currentPeriod.allowance}
        </DetailRow>
        <DetailRow label="Current plan">
          {formatPlanName(creditBalance.currentPeriod.plan)}
        </DetailRow>
        <DetailRow label="Period start">
          {formatDate(creditBalance.currentPeriod.periodStart)}
        </DetailRow>
        <DetailRow label="Period end">
          {formatDate(creditBalance.currentPeriod.periodEnd)}
        </DetailRow>
      </DetailSection>

      <DetailSection title="Lifetime">
        <DetailRow label="Granted">
          {creditBalance.account.lifetimeGranted}
        </DetailRow>
        <DetailRow label="Spent">
          {creditBalance.account.lifetimeSpent}
        </DetailRow>
        <DetailRow label="Expired">
          {creditBalance.account.lifetimeExpired}
        </DetailRow>
      </DetailSection>
    </DetailPanel>
  );
}

export function AdminUserDetailOverview({
  acceptedInvitation,
  currentUserId,
  creditBalance,
  hasActiveBan,
  isBanned,
  user,
}: AdminUserDetailOverviewProps) {
  return (
    <div className="space-y-4">
      <DetailPanel
        description="Core Better Auth user record."
        title="User Details"
      >
        <DetailSection title="Identity">
          <DetailRow
            action={
              <AdminUserNameUpdateDialog
                currentName={user.name}
                userId={user.id}
              />
            }
            label="Name"
          >
            {user.name}
          </DetailRow>
          <DetailRow
            action={
              <AdminUserEmailUpdateDialog
                currentEmail={user.email}
                userId={user.id}
              />
            }
            label="Email"
          >
            <span className="break-all">{user.email}</span>
          </DetailRow>
          <DetailRow label="User ID" mono>
            {user.id}
          </DetailRow>
          <DetailRow
            action={
              <AdminUserRoleUpdateDialog
                currentRole={user.role}
                userId={user.id}
              />
            }
            label="Role"
          >
            {normalizeRoles(user.role)
              .map((role) => formatRoleName(role))
              .join(", ")}
          </DetailRow>
          <DetailRow
            action={
              <AdminUserImageUpdateDialog
                currentImage={user.image}
                userId={user.id}
              />
            }
            label="Profile image"
            mono
          >
            {formatValue(user.image)}
          </DetailRow>
        </DetailSection>

        <DetailSection title="Status">
          <DetailRow
            action={
              <AdminUserEmailVerificationDialog
                currentEmail={user.email}
                emailVerified={user.emailVerified}
                userId={user.id}
              />
            }
            label="Email verified"
          >
            <StatusBadge
              icon={user.emailVerified ? CheckCircle2 : CircleOff}
              tone={user.emailVerified ? "good" : "warning"}
            >
              {user.emailVerified ? "Verified" : "Not verified"}
            </StatusBadge>
          </DetailRow>
          <DetailRow
            action={
              <AdminUserBanDialog
                isBanned={isBanned}
                userId={user.id}
                userName={user.name}
              />
            }
            label="Account access"
          >
            <StatusBadge
              icon={isBanned ? Ban : CheckCircle2}
              tone={isBanned ? "danger" : "good"}
            >
              {isBanned ? (hasActiveBan ? "Banned" : "Ban expired") : "Active"}
            </StatusBadge>
          </DetailRow>
          <DetailRow label="Ban state">
            {isBanned ? (hasActiveBan ? "Active" : "Expired") : "Clear"}
          </DetailRow>
          <DetailRow label="Ban reason">
            {formatValue(user.banReason, "None")}
          </DetailRow>
          <DetailRow label="Ban expires">
            {formatDate(user.banExpires)}
          </DetailRow>
          <DetailRow label="Two-factor authentication">
            <StatusBadge
              icon={user.twoFactorEnabled ? ShieldCheck : ShieldOff}
              tone={user.twoFactorEnabled ? "good" : "neutral"}
            >
              {user.twoFactorEnabled ? "Enabled" : "Disabled"}
            </StatusBadge>
          </DetailRow>
          <DetailRow
            action={
              <div className="flex flex-wrap gap-2">
                <AdminUserPasswordUpdateDialog userId={user.id} />
                <AdminUserPasswordResetDialog
                  currentEmail={user.email}
                  userId={user.id}
                />
              </div>
            }
            label="Password"
          >
            Protected credential
          </DetailRow>
          <DetailRow
            action={
              <AdminUserImpersonateDialog
                currentUserId={currentUserId}
                userId={user.id}
                userName={user.name}
              />
            }
            label="Impersonation"
          >
            Admin session
          </DetailRow>
        </DetailSection>

        <DetailSection title="Timestamps">
          <DetailRow label="Created">{formatDate(user.createdAt)}</DetailRow>
          <DetailRow label="Updated">{formatDate(user.updatedAt)}</DetailRow>
        </DetailSection>

        <DetailSection title="Danger Zone">
          <DetailRow
            action={
              <AdminUserRemoveDialog
                currentUserId={currentUserId}
                userId={user.id}
                userName={user.name}
              />
            }
            label="Remove user"
          >
            Permanently delete this account.
          </DetailRow>
        </DetailSection>
      </DetailPanel>

      {acceptedInvitation ? (
        <DetailPanel
          description="How this account was invited."
          title="Invitation"
        >
          <DetailRow label="Invited by">
            {acceptedInvitation.invitedBy ? (
              <Link
                className="link-text"
                href={`/admin/users/${acceptedInvitation.invitedBy.id}`}
              >
                {acceptedInvitation.invitedBy.name} (
                {acceptedInvitation.invitedBy.email})
              </Link>
            ) : (
              "Unavailable"
            )}
          </DetailRow>
          <DetailRow label="Invited email">
            <span className="break-all">{acceptedInvitation.email}</span>
          </DetailRow>
          <DetailRow label="Invited role">{acceptedInvitation.role}</DetailRow>
          <DetailRow label="Invited at">
            {formatDate(acceptedInvitation.createdAt)}
          </DetailRow>
          <DetailRow label="Accepted at">
            {formatDate(acceptedInvitation.acceptedAt)}
          </DetailRow>
          <DetailRow label="Expires at">
            {formatDate(acceptedInvitation.expiresAt)}
          </DetailRow>
          <DetailRow label="Invitation ID" mono>
            {acceptedInvitation.id}
          </DetailRow>
        </DetailPanel>
      ) : null}

      <AdminUserCreditsSection creditBalance={creditBalance} userId={user.id} />
    </div>
  );
}
