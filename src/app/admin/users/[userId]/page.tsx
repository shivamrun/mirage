import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CircleOff,
  Fingerprint,
  Link2,
  ListChecks,
  type LucideIcon,
  Monitor,
  UserRound,
  XCircle,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";

import {
  AdminUserBanDialog,
  AdminUserEmailUpdateDialog,
  AdminUserImageUpdateDialog,
  AdminUserNameUpdateDialog,
  AdminUserPasswordResetDialog,
  AdminUserPasswordUpdateDialog,
  AdminUserRoleUpdateDialog,
  getInitials,
} from "@/components/admin";
import { formatRoleName } from "@/components/admin/admin-users-table-helpers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requireAdmin } from "@/lib/auth/access";
import { normalizeRoles } from "@/lib/auth/roles";
import { getPageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import {
  type AdminUserDetail,
  getAdminUserDetail,
} from "@/server/db/dal/admin-user-detail";

export const metadata = getPageMetadata("User Detail", {
  path: "/admin/users",
});

type AdminUserDetailPageProps = {
  params: Promise<{
    userId: string;
  }>;
};

type AccountRecord = AdminUserDetail["accounts"][number];
type SessionRecord = AdminUserDetail["sessions"][number];
type VerificationRecord = AdminUserDetail["verifications"][number];
type DateValue = Date | string | null | undefined;

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const EMAIL_CHANGE_PREFIX = "account-email-change";
const EMAIL_CHANGE_APPROVAL_PREFIX = "account-email-change-approval";

function toDate(value: DateValue) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: DateValue, fallback = "Not set") {
  const date = toDate(value);

  return date ? dateTimeFormatter.format(date) : fallback;
}

function isFutureDate(value: DateValue, now: Date) {
  const date = toDate(value);

  return Boolean(date && date > now);
}

function formatProviderName(providerId: string) {
  if (providerId === "credential") {
    return "Email and password";
  }

  return providerId
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatValue(value: string | null | undefined, fallback = "-") {
  return value?.trim() ? value : fallback;
}

function getVerificationLabel(
  identifier: string,
  userId: string,
  email: string,
) {
  if (identifier === email) {
    return "Email verification";
  }

  if (identifier.startsWith(`${EMAIL_CHANGE_PREFIX}:${userId}:`)) {
    return "Email change confirmation";
  }

  if (identifier.startsWith(`${EMAIL_CHANGE_APPROVAL_PREFIX}:${userId}:`)) {
    return "Email change approval";
  }

  return "Verification";
}

function maskVerificationIdentifier(
  identifier: string,
  userId: string,
  email: string,
) {
  if (identifier === email) {
    return email;
  }

  const prefixes = [
    `${EMAIL_CHANGE_PREFIX}:${userId}:`,
    `${EMAIL_CHANGE_APPROVAL_PREFIX}:${userId}:`,
  ];

  const prefix = prefixes.find((value) => identifier.startsWith(value));

  if (prefix) {
    return `${prefix}[token]`;
  }

  return identifier.length > 72
    ? `${identifier.slice(0, 48)}...${identifier.slice(-12)}`
    : identifier;
}

function StatusBadge({
  children,
  icon: Icon,
  tone = "neutral",
}: {
  children: ReactNode;
  icon?: LucideIcon;
  tone?: "danger" | "good" | "neutral" | "warning";
}) {
  return (
    <Badge
      className={cn(
        "h-6 min-w-0 rounded-md px-2 font-medium text-xs",
        tone === "good" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" &&
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "danger" &&
          "border-destructive/20 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-border bg-muted/50 text-muted-foreground",
      )}
      variant="outline"
    >
      {Icon ? <Icon className="size-3 shrink-0" /> : null}
      <span className="truncate">{children}</span>
    </Badge>
  );
}

function DialogButton({
  children,
  className,
  icon: Icon,
  target,
  size = "sm",
  variant = "outline",
}: {
  children: ReactNode;
  className?: string;
  icon: LucideIcon;
  target: string;
  size?: ComponentProps<typeof Button>["size"];
  variant?: ComponentProps<typeof Button>["variant"];
}) {
  return (
    <Button
      aria-haspopup="dialog"
      className={cn("min-w-0 gap-2", className)}
      data-dialog-target={target}
      size={size}
      type="button"
      variant={variant}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </Button>
  );
}

function DetailSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="min-w-0">
      <div className="border-b bg-muted/30 px-4 py-2 font-medium text-muted-foreground text-xs">
        {title}
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function DetailRow({
  action,
  children,
  label,
  mono = false,
}: {
  action?: ReactNode;
  children: ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center sm:gap-6">
      <div className="text-muted-foreground text-sm">{label}</div>
      <div
        className={cn(
          "min-w-0 break-words text-sm",
          mono && "break-all font-mono text-xs",
        )}
      >
        {children}
      </div>
      {action ? (
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex min-h-44 min-w-0 items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center">
      <div className="max-w-sm">
        <p className="font-medium text-sm">{title}</p>
        <p className="mt-1 text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}

function RecordGrid({
  children,
  className,
  compact = false,
}: {
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <dl
      className={cn(
        "grid min-w-0 grid-cols-1 gap-x-5 gap-y-3",
        compact
          ? "sm:grid-cols-[repeat(2,minmax(0,1fr))]"
          : "md:grid-cols-[repeat(2,minmax(0,1fr))]",
        className,
      )}
    >
      {children}
    </dl>
  );
}

function RecordField({
  children,
  label,
  mono = false,
}: {
  children: ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={cn(
          "mt-1 min-w-0 break-words text-sm",
          mono && "break-all font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
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

function TabHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="font-semibold text-base">{title}</h2>
        <p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
      </div>

      {actions ? (
        <div className="flex min-w-0 flex-wrap gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceTabTrigger({
  count,
  icon: Icon,
  label,
  value,
}: {
  count?: number;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <TabsTrigger
      className="h-10 min-w-0 justify-center border-0 border-b-2 rounded-none px-2.5 text-left text-sm data-[state=active]:bg-muted data-[state=active]:text-foreground lg:w-full"
      value={value}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        {label}{" "}
        {typeof count === "number" ? (
          <span className="text-muted-foreground">[ {count} ]</span>
        ) : null}
      </span>
    </TabsTrigger>
  );
}

export default async function AdminUserDetailPage({
  params,
}: AdminUserDetailPageProps) {
  const requestHeaders = await headers();
  const { userId } = await params;

  await requireAdmin({
    headers: requestHeaders,
  });

  const detail = await getAdminUserDetail(userId);

  if (!detail) {
    notFound();
  }

  const { accounts, sessions, user, verifications } = detail;
  const now = new Date();
  const isBanned = Boolean(user.banned);
  const hasActiveBan = Boolean(
    user.banned && (!user.banExpires || isFutureDate(user.banExpires, now)),
  );

  return (
    <div className="flex min-h-full min-w-0 flex-col">
      <header className="min-w-0 shrink-0">
        <div className="py-5">
          {/* Back */}
          <Link
            href="/admin/users"
            className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Users
          </Link>

          <div className="flex min-w-0 flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Identity */}
            <div className="flex min-w-0 items-center gap-3">
              <Avatar shape="rounded" className="size-12 shrink-0">
                {user.image ? (
                  <AvatarImage src={user.image} alt={user.name} />
                ) : null}

                <AvatarFallback className="text-sm font-medium">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-semibold">
                  {user.name}
                </h1>

                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                  <span className="min-w-0 truncate">{user.email}</span>
                  <span className="text-border">|</span>

                  {user.role
                    ? normalizeRoles(user.role).map((role) => (
                        <span
                          key={role}
                          className="text-sky-600 dark:text-sky-400"
                        >
                          [ {role} ]
                        </span>
                      ))
                    : null}

                  <span
                    className={
                      user.emailVerified
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }
                  >
                    [ email: {user.emailVerified ? "verified" : "unverified"} ]
                  </span>

                  {isBanned ? (
                    <span
                      className={
                        hasActiveBan
                          ? "text-destructive"
                          : "text-amber-600 dark:text-amber-400"
                      }
                    >
                      [ {hasActiveBan ? "banned" : "ban expired"} ]
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      [ active ]
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Tabs defaultValue="overview" className="min-h-0 flex-1 gap-5">
        <TabsList className="flex h-10! w-full gap-1 border-0 rounded-none rounded-t-md overflow-hidden p-0 border-b bg-transparent">
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
            <section className="flex h-[clamp(20rem,calc(100svh-15rem),44rem)] min-w-0 flex-col overflow-hidden rounded-lg border bg-card">
              <div className="shrink-0 border-b px-4 py-3">
                <h2 className="font-semibold text-base">User Details</h2>
                <p className="mt-0.5 text-muted-foreground text-sm">
                  Core Better Auth user record.
                </p>
              </div>

              <ScrollArea className="min-h-0 flex-1 overflow-hidden">
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
                      {isBanned
                        ? hasActiveBan
                          ? "Banned"
                          : "Ban expired"
                        : "Active"}
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
                      <DialogButton
                        icon={Fingerprint}
                        size="xs"
                        target="impersonate-user"
                      >
                        Impersonate
                      </DialogButton>
                    }
                    label="Impersonation"
                  >
                    Admin session
                  </DetailRow>
                </DetailSection>

                <DetailSection title="Timestamps">
                  <DetailRow label="Created">
                    {formatDate(user.createdAt)}
                  </DetailRow>
                  <DetailRow label="Updated">
                    {formatDate(user.updatedAt)}
                  </DetailRow>
                </DetailSection>
              </ScrollArea>
            </section>
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="accounts">
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
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="sessions">
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
          </TabsContent>

          <TabsContent className="mt-0 min-w-0" value="verification">
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
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
