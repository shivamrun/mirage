import { Archive, CheckCircle2, Mail, Search } from "lucide-react";
import Link from "next/link";

import { ContactSubmissionCopyButton } from "@/components/admin/contact-submission/copy-button";
import { formatDate } from "@/components/admin/user-detail/formatters";
import { StatusBadge } from "@/components/admin/user-detail/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdminEmailSubscriberQueryState,
  EmailSubscriptionStatus,
} from "@/zod";

import { EmailListCreateDialog } from "./email-list-create-dialog";
import { EmailListRowActions } from "./list-row-actions";
import { emailListPageHref } from "./query";

type EmailListItem = {
  activeSubscribers: number;
  createdAt: Date;
  description: string | null;
  emailVerificationRequired: boolean;
  key: string;
  name: string;
  status: "active" | "archived";
  totalSubscribers: number;
};

type EmailSubscriberItem = {
  createdAt: Date;
  email: string;
  listKey: string;
  listName: string;
  metadata: Record<string, unknown> | null;
  source: string | null;
  status: EmailSubscriptionStatus;
  subscriptionId: string;
};

type AdminEmailListsPanelProps = {
  lists: EmailListItem[];
};

type AdminEmailSubmissionsPanelProps = {
  lists: EmailListItem[];
  state: AdminEmailSubscriberQueryState;
  subscribers: EmailSubscriberItem[];
};

const subscriptionStatusLabels = {
  bounced: "Bounced",
  pending: "Pending",
  subscribed: "Verified",
  unsubscribed: "Unsubscribed",
} as const;

const anyFilterValue = "__any__";

function EmailListStatusBadge({ status }: { status: "active" | "archived" }) {
  return (
    <StatusBadge
      icon={status === "active" ? CheckCircle2 : Archive}
      tone={status === "active" ? "good" : "neutral"}
    >
      {status === "active" ? "Active" : "Archived"}
    </StatusBadge>
  );
}

function SubscriberStatusBadge({
  status,
}: {
  status: EmailSubscriberItem["status"];
}) {
  const tone =
    status === "subscribed"
      ? "good"
      : status === "bounced" || status === "unsubscribed"
        ? "neutral"
        : "warning";

  return (
    <StatusBadge icon={Mail} tone={tone}>
      {subscriptionStatusLabels[status]}
    </StatusBadge>
  );
}

function metadataPreview(metadata: Record<string, unknown> | null) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "-";
  }

  return JSON.stringify(metadata);
}

export function AdminEmailListsPanel({ lists }: AdminEmailListsPanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 justify-end pb-4">
        <EmailListCreateDialog />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <Table className="min-w-[780px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">List</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead>Submissions</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="pr-4 text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {lists.length > 0 ? (
              lists.map((list) => (
                <TableRow key={list.key}>
                  <TableCell className="max-w-[280px] px-4 align-top">
                    <Link
                      className="link-text block break-all font-medium"
                      href={emailListPageHref({ listKey: list.key })}
                    >
                      {list.key}
                    </Link>
                  </TableCell>
                  <TableCell className="align-top">
                    <EmailListStatusBadge status={list.status} />
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">
                    {list.emailVerificationRequired ? "Required" : "Optional"}
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">
                    {list.activeSubscribers} active / {list.totalSubscribers}{" "}
                    total
                  </TableCell>
                  <TableCell className="whitespace-nowrap align-top text-muted-foreground">
                    {formatDate(list.createdAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-end align-top">
                    <EmailListRowActions list={list} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-72 text-center">
                  <p className="font-medium">No lists found</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Create a list to start collecting emails.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export function AdminEmailSubmissionsPanel({
  lists,
  state,
  subscribers,
}: AdminEmailSubmissionsPanelProps) {
  const clearHref = emailListPageHref({});

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <form
        action="/admin/email-list/submissions"
        className="mb-4 flex shrink-0 flex-wrap items-center gap-2"
        method="get"
      >
        <div className="relative min-w-64 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 bg-muted/30 pl-9"
            defaultValue={state.query}
            name="q"
            placeholder="Search email, list, or source..."
            spellCheck={false}
          />
        </div>

        <Select defaultValue={state.listKey ?? anyFilterValue} name="listKey">
          <SelectTrigger className="h-9 min-w-36 bg-background">
            <SelectValue placeholder="All lists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyFilterValue}>All lists</SelectItem>
            {lists.map((list) => (
              <SelectItem key={list.key} value={list.key}>
                {list.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select defaultValue={state.status ?? anyFilterValue} name="status">
          <SelectTrigger className="h-9 min-w-36 bg-background">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={anyFilterValue}>Any status</SelectItem>
            {Object.entries(subscriptionStatusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="h-9" type="submit">
          Search
        </Button>

        {state.query || state.listKey || state.status ? (
          <Button asChild className="h-9" variant="ghost">
            <Link href={clearHref}>Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        <Table className="min-w-[860px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4">Email</TableHead>
              <TableHead>List</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead className="pr-4 text-end">Submitted</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {subscribers.length > 0 ? (
              subscribers.map((subscriber) => (
                <TableRow key={subscriber.subscriptionId}>
                  <TableCell className="max-w-[260px] px-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{subscriber.email}</span>
                      <ContactSubmissionCopyButton
                        label="email"
                        value={subscriber.email}
                      />
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[220px] truncate font-medium">
                      {subscriber.listKey}
                    </span>
                  </TableCell>
                  <TableCell>
                    <SubscriberStatusBadge status={subscriber.status} />
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-muted-foreground">
                    {subscriber.source ?? "-"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-muted-foreground text-xs">
                    {metadataPreview(subscriber.metadata)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap pr-4 text-end text-muted-foreground">
                    {formatDate(subscriber.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-72 text-center">
                  <p className="font-medium">No submissions found</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Email submissions will appear here after signups.
                  </p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
