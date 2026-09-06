import {
  CheckCircle2,
  Fingerprint,
  Link2,
  ListChecks,
  XCircle,
} from "lucide-react";

import type { AdminUserDetail } from "@/server/db/dal/admin-user-detail";
import { CopyableId } from "./admin-user-copyable-id";
import {
  formatDate,
  formatProviderName,
  formatValue,
  isFutureDate,
} from "./admin-user-detail-formatters";
import {
  DetailPanel,
  DialogButton,
  EmptyState,
  StatusBadge,
} from "./admin-user-detail-primitives";

type AccountRecord = AdminUserDetail["accounts"][number];
type SessionRecord = AdminUserDetail["sessions"][number];

export function AdminUserAccountsTab({
  accounts,
}: {
  accounts: AdminUserDetail["accounts"];
}) {
  return (
    <DetailPanel
      actions={
        <DialogButton icon={Link2} target="manage-accounts">
          Manage accounts
        </DialogButton>
      }
      description="Authentication providers and stored credential state."
      title="Linked Accounts"
    >
      {accounts.length > 0 ? (
        <AccountsTable accounts={accounts} />
      ) : (
        <EmptyState
          description="This user does not have linked authentication account rows."
          title="No linked accounts"
        />
      )}
    </DetailPanel>
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
    <DetailPanel
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
    >
      {sessions.length > 0 ? (
        <SessionsTable now={now} sessions={sessions} />
      ) : (
        <EmptyState
          description="There are no stored sessions for this user."
          title="No sessions"
        />
      )}
    </DetailPanel>
  );
}

function AccountsTable({ accounts }: { accounts: AccountRecord[] }) {
  return (
    <div className="min-w-0 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr className="text-muted-foreground">
              <TableHeader>Provider</TableHeader>
              <TableHeader>Account</TableHeader>
              <TableHeader>Scope</TableHeader>
              <TableHeader>Event Times</TableHeader>
              <TableHeader className="w-0">
                <span className="sr-only">Actions</span>
              </TableHeader>
            </tr>
          </thead>

          <tbody className="divide-y">
            {accounts.map((account) => (
              <AccountRow account={account} key={account.id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountRow({ account }: { account: AccountRecord }) {
  const scopes = parseScopes(account.scope);

  return (
    <tr className="align-top transition-colors hover:bg-muted/20">
      <TableCell>
        <div className="space-y-2">
          <div>
            <p className="font-medium">
              {formatProviderName(account.providerId)}
            </p>

            <p className="mt-0.5 font-mono text-muted-foreground text-xs">
              {account.providerId}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {account.hasPassword ? (
              <StatusBadge icon={CheckCircle2} tone="good">
                Password
              </StatusBadge>
            ) : null}

            {account.hasAccessToken ? <StatusBadge>Access</StatusBadge> : null}

            {account.hasRefreshToken ? (
              <StatusBadge>Refresh</StatusBadge>
            ) : null}

            {account.hasIdToken ? <StatusBadge>ID Token</StatusBadge> : null}

            {!account.hasPassword &&
            !account.hasAccessToken &&
            !account.hasRefreshToken &&
            !account.hasIdToken ? (
              <StatusBadge>No credentials</StatusBadge>
            ) : null}
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="space-y-2.5">
          <IdentifierField label="Account ID" value={account.accountId} />

          <IdentifierField label="Row ID" value={account.id} />
        </div>
      </TableCell>

      <TableCell>
        {scopes.length > 0 ? (
          <div className="flex max-w-[260px] flex-wrap gap-1.5">
            {scopes.map((scope) => (
              <span
                className="inline-flex items-center rounded-md border bg-muted/30 px-2 py-1 font-medium text-xs"
                key={scope}
              >
                {scope}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell>
        <div className="grid min-w-[290px] gap-2">
          <TimeRow
            label="Created"
            value={formatDate(account.createdAt)}
            variant="event"
          />

          <TimeRow
            label="Updated"
            value={formatDate(account.updatedAt)}
            variant="event"
          />

          <TimeRow
            label="Access"
            value={formatDate(account.accessTokenExpiresAt)}
            variant="token"
          />

          <TimeRow
            label="Refresh"
            value={formatDate(account.refreshTokenExpiresAt)}
            variant="token"
          />
        </div>
      </TableCell>

      <TableCell className="text-right">
        <DialogButton icon={Link2} target={`manage-account-${account.id}`}>
          Manage
        </DialogButton>
      </TableCell>
    </tr>
  );
}

function SessionsTable({
  now,
  sessions,
}: {
  now: Date;
  sessions: SessionRecord[];
}) {
  return (
    <div className="min-w-0 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr className="text-muted-foreground">
              <TableHeader>Session</TableHeader>
              <TableHeader>Event Times</TableHeader>
              <TableHeader>Client</TableHeader>
              <TableHeader>Impersonated By</TableHeader>
              <TableHeader className="w-0">
                <span className="sr-only">Actions</span>
              </TableHeader>
            </tr>
          </thead>

          <tbody className="divide-y">
            {sessions.map((session) => (
              <SessionRow key={session.id} now={now} session={session} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SessionRow({ now, session }: { now: Date; session: SessionRecord }) {
  const active = isFutureDate(session.expiresAt, now);

  return (
    <tr className="align-top transition-colors hover:bg-muted/20">
      <TableCell>
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <CopyableId value={session.id} />
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
        </div>
      </TableCell>

      <TableCell>
        <div className="grid min-w-[270px] gap-2">
          <TimeRow
            label="Created"
            value={formatDate(session.createdAt)}
            variant="event"
          />

          <TimeRow
            label="Expires"
            value={formatDate(session.expiresAt)}
            variant="token"
          />
        </div>
      </TableCell>

      <TableCell>
        <div className="min-w-[260px] max-w-[380px] space-y-2.5">
          <p className="mt-0.5 font-mono text-xs">
            {formatValue(session.ipAddress)}
          </p>

          <p className="mt-0.5 break-words text-xs">
            {formatValue(session.userAgent)}
          </p>
        </div>
      </TableCell>

      <TableCell>
        {session.impersonatedBy ? (
          <CopyableId value={session.impersonatedBy} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="text-right">
        <DialogButton icon={ListChecks} target={`manage-session-${session.id}`}>
          Manage
        </DialogButton>
      </TableCell>
    </tr>
  );
}

function IdentifierField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>

      <div className="mt-0.5">
        <CopyableId value={value} />
      </div>
    </div>
  );
}

function TimeRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: React.ReactNode;
  variant: "event" | "token";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={
          variant === "event"
            ? "inline-flex min-w-[76px] items-center justify-center rounded-md bg-muted px-2 py-1 font-medium text-muted-foreground text-xs"
            : "inline-flex min-w-[76px] items-center justify-center rounded-md bg-primary/10 px-2 py-1 font-medium text-primary text-xs"
        }
      >
        {label}
      </span>

      <span className="whitespace-nowrap text-xs">{value}</span>
    </div>
  );
}

function TableHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-6 py-4 font-medium text-xs ${className ?? ""}`}
      scope="col"
    >
      {children}
    </th>
  );
}

function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-6 py-5 ${className ?? ""}`}>{children}</td>;
}

function parseScopes(scope: string | null | undefined): string[] {
  if (!scope) {
    return [];
  }

  const scopes = scope
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(scopes.map(formatScopeLabel))];
}

function formatScopeLabel(scope: string) {
  const knownScopes: Record<string, string> = {
    openid: "OpenID",
    email: "Email",
    profile: "Profile",

    "https://www.googleapis.com/auth/userinfo.email": "Email",

    "https://www.googleapis.com/auth/userinfo.profile": "Profile",
  };

  const known = knownScopes[scope];

  if (known) {
    return known;
  }

  if (scope.startsWith("https://www.googleapis.com/auth/")) {
    return humanizeScope(scope.replace("https://www.googleapis.com/auth/", ""));
  }

  return humanizeScope(scope);
}

function humanizeScope(scope: string) {
  return scope
    .split(/[./:_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
