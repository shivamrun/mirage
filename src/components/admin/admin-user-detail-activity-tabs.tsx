import {
  CheckCircle2,
  CircleOff,
  Fingerprint,
  Link2,
  ListChecks,
  XCircle,
} from "lucide-react";

import type { AdminUserDetail } from "@/server/db/dal/admin-user-detail";
import {
  formatDate,
  formatProviderName,
  formatValue,
  getVerificationLabel,
  isFutureDate,
  maskVerificationIdentifier,
} from "./admin-user-detail-formatters";
import {
  DialogButton,
  EmptyState,
  RecordField,
  RecordGrid,
  StatusBadge,
  TabHeader,
} from "./admin-user-detail-primitives";

type AccountRecord = AdminUserDetail["accounts"][number];
type SessionRecord = AdminUserDetail["sessions"][number];
type VerificationRecord = AdminUserDetail["verifications"][number];

export function AdminUserAccountsTab({
  accounts,
}: {
  accounts: AdminUserDetail["accounts"];
}) {
  return (
    <>
      <TabHeader
        actions={
          <DialogButton icon={Link2} target="manage-accounts">
            Manage accounts
          </DialogButton>
        }
        description="Authentication providers and stored credential state."
        title="Linked Accounts"
      />

      {accounts.length > 0 ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          {accounts.map((account) => (
            <AccountCard account={account} key={account.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="This user does not have linked authentication account rows."
          title="No linked accounts"
        />
      )}
    </>
  );
}

export function AdminUserSessionsTab({
  now,
  sessions,
}: {
  now: Date;
  sessions: AdminUserDetail["sessions"];
}) {
  return (
    <>
      <TabHeader
        actions={
          <>
            <DialogButton icon={ListChecks} target="manage-sessions">
              Manage sessions
            </DialogButton>
            <DialogButton
              icon={XCircle}
              target="revoke-all-sessions"
              variant="destructive"
            >
              Revoke all
            </DialogButton>
          </>
        }
        description="Devices, expiry, and impersonation metadata."
        title="Sessions"
      />

      {sessions.length > 0 ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          {sessions.map((session) => (
            <SessionCard key={session.id} now={now} session={session} />
          ))}
        </div>
      ) : (
        <EmptyState
          description="There are no stored sessions for this user."
          title="No sessions"
        />
      )}
    </>
  );
}

export function AdminUserVerificationTab({
  now,
  user,
  verifications,
}: {
  now: Date;
  user: AdminUserDetail["user"];
  verifications: AdminUserDetail["verifications"];
}) {
  return (
    <>
      <TabHeader
        description="Email verification and email-change records."
        title="Verification Activity"
      />

      {verifications.length > 0 ? (
        <div className="grid min-w-0 gap-3 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
          {verifications.map((verification) => (
            <VerificationCard
              email={user.email}
              key={verification.id}
              now={now}
              userId={user.id}
              verification={verification}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          description="No email verification or email-change records are stored for this user."
          title="No verification activity"
        />
      )}
    </>
  );
}

function AccountCard({ account }: { account: AccountRecord }) {
  const credentialLabels = [
    account.hasPassword ? "Password" : null,
    account.hasAccessToken ? "Access token" : null,
    account.hasRefreshToken ? "Refresh token" : null,
    account.hasIdToken ? "ID token" : null,
  ].filter((label): label is string => Boolean(label));

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
            <Link2 className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="font-medium text-sm">
              {formatProviderName(account.providerId)}
            </h3>
            <p className="mt-1 break-all font-mono text-muted-foreground text-xs">
              {account.accountId}
            </p>
          </div>
        </div>

        <DialogButton
          className="w-full sm:w-auto"
          icon={Link2}
          target={`manage-account-${account.id}`}
        >
          Manage
        </DialogButton>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {credentialLabels.length > 0 ? (
          credentialLabels.map((label) => (
            <StatusBadge
              icon={label === "Password" ? CheckCircle2 : CircleOff}
              key={label}
              tone={label === "Password" ? "good" : "neutral"}
            >
              {label}
            </StatusBadge>
          ))
        ) : (
          <StatusBadge>No credentials</StatusBadge>
        )}
      </div>

      <RecordGrid className="mt-3" compact>
        <RecordField label="Row ID" mono>
          {account.id}
        </RecordField>
        <RecordField label="Provider">{account.providerId}</RecordField>
        <RecordField label="Created">
          {formatDate(account.createdAt)}
        </RecordField>
        <RecordField label="Updated">
          {formatDate(account.updatedAt)}
        </RecordField>
        <RecordField label="Access token expires">
          {formatDate(account.accessTokenExpiresAt)}
        </RecordField>
        <RecordField label="Refresh token expires">
          {formatDate(account.refreshTokenExpiresAt)}
        </RecordField>
        <RecordField label="Scope" mono>
          {formatValue(account.scope)}
        </RecordField>
      </RecordGrid>
    </article>
  );
}

function SessionCard({ now, session }: { now: Date; session: SessionRecord }) {
  const active = isFutureDate(session.expiresAt, now);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              icon={active ? CheckCircle2 : XCircle}
              tone={active ? "good" : "neutral"}
            >
              {active ? "Active" : "Expired"}
            </StatusBadge>
            {session.impersonatedBy ? (
              <StatusBadge icon={Fingerprint} tone="warning">
                Impersonated
              </StatusBadge>
            ) : null}
          </div>

          <p className="mt-2 break-all font-mono text-muted-foreground text-xs">
            {session.id}
          </p>
        </div>

        <DialogButton
          className="w-full sm:w-auto"
          icon={ListChecks}
          target={`manage-session-${session.id}`}
        >
          Manage
        </DialogButton>
      </div>

      <RecordGrid className="mt-3" compact>
        <RecordField label="Created">
          {formatDate(session.createdAt)}
        </RecordField>
        <RecordField label="Expires">
          {formatDate(session.expiresAt)}
        </RecordField>
        <RecordField label="IP address" mono>
          {formatValue(session.ipAddress)}
        </RecordField>
        <RecordField label="Impersonated by" mono>
          {formatValue(session.impersonatedBy)}
        </RecordField>
        <RecordField label="User agent">
          {formatValue(session.userAgent)}
        </RecordField>
      </RecordGrid>
    </article>
  );
}

function VerificationCard({
  email,
  now,
  userId,
  verification,
}: {
  email: string;
  now: Date;
  userId: string;
  verification: VerificationRecord;
}) {
  const active = isFutureDate(verification.expiresAt, now);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border bg-card p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-medium text-sm">
            {getVerificationLabel(verification.identifier, userId, email)}
          </h3>
          <p className="mt-1 break-all font-mono text-muted-foreground text-xs">
            {maskVerificationIdentifier(verification.identifier, userId, email)}
          </p>
        </div>

        <StatusBadge
          icon={active ? CheckCircle2 : XCircle}
          tone={active ? "good" : "neutral"}
        >
          {active ? "Active" : "Expired"}
        </StatusBadge>
      </div>

      <RecordGrid className="mt-3" compact>
        <RecordField label="Created">
          {formatDate(verification.createdAt)}
        </RecordField>
        <RecordField label="Expires">
          {formatDate(verification.expiresAt)}
        </RecordField>
        <RecordField label="Record ID" mono>
          {verification.id}
        </RecordField>
      </RecordGrid>
    </article>
  );
}
