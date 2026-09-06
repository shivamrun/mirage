import { Ban, CheckCircle2, CircleOff } from "lucide-react";

import { AdminUserImpersonateDialog } from "@/components/admin/admin-user-impersonation-controls";
import {
  AdminUserBanDialog,
  AdminUserEmailUpdateDialog,
  AdminUserImageUpdateDialog,
  AdminUserNameUpdateDialog,
  AdminUserPasswordResetDialog,
  AdminUserPasswordUpdateDialog,
  AdminUserRoleUpdateDialog,
} from "@/components/admin/admin-user-name-update-dialog";
import { normalizeRoles } from "@/lib/auth/roles";
import type { AdminUserDetail } from "@/server/db/dal/admin-user-detail";
import { formatDate, formatValue } from "./admin-user-detail-formatters";
import {
  DetailPanel,
  DetailRow,
  DetailSection,
  StatusBadge,
} from "./admin-user-detail-primitives";
import { formatRoleName } from "./admin-users-table-helpers";

type AdminUserDetailOverviewProps = {
  currentUserId: string;
  hasActiveBan: boolean;
  isBanned: boolean;
  user: AdminUserDetail["user"];
};

export function AdminUserDetailOverview({
  currentUserId,
  hasActiveBan,
  isBanned,
  user,
}: AdminUserDetailOverviewProps) {
  return (
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
        <DetailRow label="Email verified">
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
        <DetailRow label="Ban expires">{formatDate(user.banExpires)}</DetailRow>
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
    </DetailPanel>
  );
}
