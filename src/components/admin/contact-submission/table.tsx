import { Archive, Eye, MailQuestion } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/admin/user-detail/primitives";
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

import { formatDate } from "../user-detail/formatters";
import {
  ADMIN_CONTACT_SUBMISSION_PAGE_PATH,
  type AdminContactSubmissionListItem,
  type ContactSubmissionStatus,
} from "./query";

type AdminContactSubmissionTableProps = {
  hasSearch: boolean;
  query: string;
  submissions: AdminContactSubmissionListItem[];
};

const statusConfig = {
  archived: {
    icon: Archive,
    label: "Archived",
    tone: "neutral",
  },
  new: {
    icon: MailQuestion,
    label: "Unread",
    tone: "warning",
  },
  read: {
    icon: Eye,
    label: "Read",
    tone: "good",
  },
} as const satisfies Record<
  ContactSubmissionStatus,
  {
    icon: typeof MailQuestion;
    label: string;
    tone: "good" | "neutral" | "warning";
  }
>;

function ContactSubmissionStatusBadge({
  status,
}: {
  status: ContactSubmissionStatus;
}) {
  const config = statusConfig[status];

  return (
    <StatusBadge icon={config.icon} tone={config.tone}>
      {config.label}
    </StatusBadge>
  );
}

function getMessagePreview(message: string) {
  const normalizedMessage = message.replace(/\s+/g, " ").trim();

  if (normalizedMessage.length <= 120) {
    return normalizedMessage;
  }

  return `${normalizedMessage.slice(0, 117)}...`;
}

export function AdminContactSubmissionTable({
  hasSearch,
  query,
  submissions,
}: AdminContactSubmissionTableProps) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="h-full rounded-xl border bg-card">
        <Table className="min-w-[920px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[180px] px-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="min-w-[300px]">Message</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[190px] pr-6 text-end">
                Submitted
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {submissions.length > 0 ? (
              submissions.map((submission) => (
                <TableRow
                  key={submission.id}
                  className="transition-colors hover:bg-muted/35"
                >
                  <TableCell className="max-w-[220px] px-4 py-4">
                    <p className="truncate text-sm font-medium">
                      {submission.name}
                    </p>
                  </TableCell>

                  <TableCell className="max-w-[260px] whitespace-normal text-sm text-muted-foreground">
                    {submission.email}
                  </TableCell>

                  <TableCell className="max-w-[220px] whitespace-normal text-sm text-muted-foreground">
                    {submission.company?.trim() || "-"}
                  </TableCell>

                  <TableCell className="max-w-[360px] whitespace-normal text-sm text-muted-foreground">
                    {getMessagePreview(submission.message)}
                  </TableCell>

                  <TableCell className="whitespace-normal">
                    <ContactSubmissionStatusBadge status={submission.status} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap pr-6 text-end text-sm text-muted-foreground">
                    {formatDate(submission.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-72">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="font-medium">No submissions found</p>

                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {hasSearch
                        ? "No contact submissions matched your search."
                        : "Contact form submissions will appear here."}
                    </p>

                    {query ? (
                      <Button
                        asChild
                        className="mt-4"
                        size="sm"
                        variant="outline"
                      >
                        <Link href={ADMIN_CONTACT_SUBMISSION_PAGE_PATH}>
                          Clear search
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </section>
  );
}
