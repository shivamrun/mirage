import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  TimerOff,
  UserRound,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/features/admin/components/shared/formatters";
import { StatusBadge } from "@/features/admin/components/user-detail/primitives";
import type {
  AdminInvitationResponse,
  InvitationEffectiveStatus,
} from "@/shared/schemas";
import { cn } from "@/shared/utils";
import { InvitationCreateDialog } from "./invitation-create-dialog";
import { invitationsPageHref } from "./query";

type AdminInvitationsPanelProps = {
  invitations: AdminInvitationResponse[];
  status?: InvitationEffectiveStatus;
};

const statusFilters: {
  label: string;
  value?: InvitationEffectiveStatus;
}[] = [
  { label: "All" },
  { label: "Pending", value: "pending" },
  { label: "Expired", value: "expired" },
  { label: "Accepted", value: "accepted" },
  { label: "Revoked", value: "revoked" },
];

function InvitationStatusBadge({
  status,
}: {
  status: InvitationEffectiveStatus;
}) {
  if (status === "pending") {
    return (
      <StatusBadge icon={Clock} tone="warning">
        Pending
      </StatusBadge>
    );
  }

  if (status === "expired") {
    return (
      <StatusBadge icon={TimerOff} tone="neutral">
        Expired
      </StatusBadge>
    );
  }

  if (status === "accepted") {
    return (
      <StatusBadge icon={CheckCircle2} tone="good">
        Accepted
      </StatusBadge>
    );
  }

  return (
    <StatusBadge icon={XCircle} tone="danger">
      Revoked
    </StatusBadge>
  );
}

function RoleBadge({ role }: { role: AdminInvitationResponse["role"] }) {
  return (
    <StatusBadge
      icon={role === "admin" ? ShieldCheck : UserRound}
      tone="neutral"
    >
      {role === "admin" ? "Admin" : "User"}
    </StatusBadge>
  );
}

export function AdminInvitationsPanel({
  invitations,
  status,
}: AdminInvitationsPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {statusFilters.map((item) => (
            <Button
              asChild
              key={item.label}
              size="sm"
              variant={status === item.value ? "default" : "outline"}
            >
              <Link href={invitationsPageHref({ effectiveStatus: item.value })}>
                {item.label}
              </Link>
            </Button>
          ))}
        </div>

        <InvitationCreateDialog />
      </div>

      <ScrollArea className="min-h-0 flex-1 rounded-lg border bg-card">
        <Table className="min-w-[840px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-12 px-5">Email</TableHead>
              <TableHead className="h-12 px-4">Status</TableHead>
              <TableHead className="h-12 px-4">Role</TableHead>
              <TableHead className="h-12 px-4">Invited</TableHead>
              <TableHead className="h-12 px-4">Expires</TableHead>
              <TableHead className="h-12 px-4">Accepted</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {invitations.length > 0 ? (
              invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="max-w-[280px] px-5 py-4">
                    {invitation.acceptedByUserId ? (
                      <Link
                        className={cn(
                          "link-text block break-all font-medium text-sm",
                          invitation.effectiveStatus === "revoked" &&
                            "text-muted-foreground",
                        )}
                        href={`/admin/users/${invitation.acceptedByUserId}`}
                      >
                        {invitation.email}
                      </Link>
                    ) : (
                      <p
                        className={cn(
                          "break-all font-medium text-sm",
                          invitation.effectiveStatus === "revoked" &&
                            "text-muted-foreground",
                        )}
                      >
                        {invitation.email}
                      </p>
                    )}
                  </TableCell>

                  <TableCell className="px-4 py-4">
                    <InvitationStatusBadge
                      status={invitation.effectiveStatus}
                    />
                  </TableCell>

                  <TableCell className="px-4 py-4">
                    <RoleBadge role={invitation.role} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-4 py-4 text-muted-foreground text-sm">
                    {formatDate(invitation.createdAt)}
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-4 py-4 text-muted-foreground text-sm">
                    {formatDate(invitation.expiresAt)}
                  </TableCell>

                  <TableCell className="whitespace-nowrap px-4 py-4 text-muted-foreground text-sm">
                    {formatDate(invitation.acceptedAt, "-")}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-72 px-6 text-center">
                  <p className="font-medium">No invitations found</p>
                  <p className="mt-2 text-muted-foreground text-sm">
                    Send an invite or adjust the current status filter.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </section>
  );
}
