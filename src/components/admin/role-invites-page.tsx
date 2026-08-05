import { count, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import {
  type AdminInvitableRole,
  AdminSidebar,
  RoleInviteForm,
} from "@/components/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/access";
import db from "@/server/db";
import { invite as inviteTable } from "@/server/db/schema";

type RoleInvitesPageProps = {
  emptyMessage: string;
  inviteRole: AdminInvitableRole;
  title: string;
};

function formatInviteDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

type InviteRecipient = Pick<
  typeof inviteTable.$inferSelect,
  "email" | "emails"
>;

type InviteStatusTarget = Pick<
  typeof inviteTable.$inferSelect,
  "expiresAt" | "status"
>;

function getInviteRecipient(invitation: InviteRecipient) {
  return invitation.emails?.join(", ") ?? invitation.email ?? "No recipient";
}

function getInviteStatus(invitation: InviteStatusTarget) {
  if (invitation.status === "pending" && invitation.expiresAt < new Date()) {
    return "expired";
  }

  return invitation.status;
}

const statusBadgeClassNames: Record<string, string> = {
  canceled: "border-border bg-muted text-muted-foreground",
  expired: "border-border bg-muted text-muted-foreground",
  pending: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive",
  used: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
};

function InviteStatusBadge({
  status,
}: {
  status: ReturnType<typeof getInviteStatus>;
}) {
  return (
    <span
      className={`inline-flex h-6 items-center rounded-md border px-2 font-medium text-xs ${
        statusBadgeClassNames[status] ?? statusBadgeClassNames.pending
      }`}
    >
      {status}
    </span>
  );
}

export async function RoleInvitesPage({
  emptyMessage,
  inviteRole,
  title,
}: RoleInvitesPageProps) {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const [totalResult, invitations] = await Promise.all([
    db
      .select({ value: count() })
      .from(inviteTable)
      .where(eq(inviteTable.role, inviteRole)),
    db.query.invite.findMany({
      columns: {
        token: false,
      },
      limit: 100,
      orderBy: [desc(inviteTable.createdAt)],
      where: eq(inviteTable.role, inviteRole),
      with: {
        creator: {
          columns: {
            email: true,
            name: true,
          },
        },
        uses: {
          columns: {
            id: true,
          },
        },
      },
    }),
  ]);

  const total = totalResult[0]?.value ?? 0;

  return (
    <main className="flex">
      <AdminSidebar />
      <div className="mx-auto flex w-full max-w-265 flex-col px-14 py-4 sm:py-8 lg:py-18">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-medium text-2xl">{title}</h1>
            <p className="text-muted-foreground text-sm">
              {total} {total === 1 ? "invite" : "invites"}
            </p>
          </div>
          <RoleInviteForm inviteRole={inviteRole} />
        </header>

        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <Table className="min-w-230">
            <TableHeader className="bg-muted/45">
              <TableRow>
                <TableHead className="h-11 px-4">Recipient</TableHead>
                <TableHead className="h-11 px-4">Status</TableHead>
                <TableHead className="h-11 px-4">Uses</TableHead>
                <TableHead className="h-11 px-4">Invited by</TableHead>
                <TableHead className="h-11 px-4">Created</TableHead>
                <TableHead className="h-11 px-4">Expires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const status = getInviteStatus(invitation);

                return (
                  <TableRow
                    className="bg-background hover:bg-muted/30"
                    key={invitation.id}
                  >
                    <TableCell className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {getInviteRecipient(invitation)}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {invitation.newAccount
                            ? "New account"
                            : "Existing account"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <InviteStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {invitation.uses.length} / {invitation.maxUses}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {invitation.creator?.name ||
                        invitation.creator?.email ||
                        "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatInviteDate(invitation.createdAt)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {formatInviteDate(invitation.expiresAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {invitations.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-4 py-10 text-center text-muted-foreground"
                    colSpan={6}
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
