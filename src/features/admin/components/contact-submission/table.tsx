import {
  Archive,
  ArchiveRestore,
  Eye,
  MailQuestion,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/features/admin/components/user-detail/primitives";

import { formatDate } from "../shared/formatters";
import { RecordField, RecordGrid } from "../user-detail/primitives";
import { ContactSubmissionCopyButton } from "./copy-button";
import type {
  AdminContactSubmissionListItem,
  ContactSubmissionStatus,
} from "./query";

type ContactSubmissionStatusAction = (
  formData: FormData,
) => Promise<void> | void;

type AdminContactSubmissionTableProps = {
  clearSearchHref: string;
  hasSearch: boolean;
  query: string;
  rowAction: ContactSubmissionStatusAction;
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
    label: "New",
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

function getRowActions(status: ContactSubmissionStatus) {
  if (status === "archived") {
    return [
      {
        icon: ArchiveRestore,
        label: "Unarchive",
        status: "read",
      },
    ] as const;
  }

  return [
    ...(status === "new"
      ? [
          {
            icon: Eye,
            label: "Mark read",
            status: "read",
          } as const,
        ]
      : []),
    {
      icon: Archive,
      label: "Archive",
      status: "archived",
    } as const,
  ];
}

function ContactSubmissionRowActions({
  rowAction,
  submission,
}: {
  rowAction: ContactSubmissionStatusAction;
  submission: AdminContactSubmissionListItem;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${submission.name}`}
          size="icon-sm"
          title="Actions"
          type="button"
          variant="ghost"
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <form action={rowAction}>
          <input type="hidden" name="id" value={submission.id} />

          {getRowActions(submission.status).map((action) => (
            <DropdownMenuItem asChild key={action.label}>
              <button
                className="w-full cursor-pointer justify-start"
                name="status"
                type="submit"
                value={action.status}
              >
                <action.icon />
                {action.label}
              </button>
            </DropdownMenuItem>
          ))}
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContactSubmissionDetailTrigger({
  align = "start",
  children,
}: {
  align?: "end" | "start";
  children: ReactNode;
}) {
  return (
    <AlertDialogTrigger asChild>
      <button
        className={[
          "block min-w-0 max-w-full cursor-pointer text-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          align === "end" ? "ml-auto text-right" : "text-left",
        ].join(" ")}
        type="button"
      >
        {children}
      </button>
    </AlertDialogTrigger>
  );
}

function ContactSubmissionDetails({
  submission,
}: {
  submission: AdminContactSubmissionListItem;
}) {
  return (
    <AlertDialogContent className="grid max-h-[calc(100vh-2rem)] max-w-2xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0">
      <AlertDialogCloseButton />
      <AlertDialogHeader className="border-b p-4 pr-12">
        <AlertDialogTitle>Contact Submission Details</AlertDialogTitle>
        <AlertDialogDescription>
          Review the submitted contact form message.
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden p-4">
        <RecordGrid compact>
          <RecordField label="Name">{submission.name}</RecordField>
          <RecordField label="Email">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 break-all">{submission.email}</span>
              <ContactSubmissionCopyButton
                label="email"
                value={submission.email}
              />
            </span>
          </RecordField>
          <RecordField label="Company">
            {submission.company?.trim() || "-"}
          </RecordField>
          <RecordField label="Status">
            <ContactSubmissionStatusBadge status={submission.status} />
          </RecordField>
          <RecordField label="Submitted">
            {formatDate(submission.createdAt)}
          </RecordField>
          <RecordField label="Submission ID" mono>
            {submission.id}
          </RecordField>
        </RecordGrid>

        <div className="flex min-h-0 min-w-0 flex-col">
          <h3 className="font-medium text-sm">Message</h3>
          <ScrollArea className="mt-2 h-72 min-h-0 rounded-lg border bg-muted/20">
            <p className="whitespace-pre-wrap break-words p-3 text-sm leading-6">
              {submission.message}
            </p>
          </ScrollArea>
        </div>
      </div>
    </AlertDialogContent>
  );
}

function ContactSubmissionDetailCell({
  align,
  children,
  className,
}: {
  align?: "end" | "start";
  children: ReactNode;
  className?: string;
}) {
  return (
    <TableCell className={className}>
      <ContactSubmissionDetailTrigger align={align}>
        {children}
      </ContactSubmissionDetailTrigger>
    </TableCell>
  );
}

export function AdminContactSubmissionTable({
  clearSearchHref,
  hasSearch,
  query,
  rowAction,
  submissions,
}: AdminContactSubmissionTableProps) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      <div className="h-full overflow-auto rounded-xl border bg-card">
        <Table className="min-w-[720px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-[180px] px-4">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[190px] pr-6 text-end">
                Submitted
              </TableHead>
              <TableHead className="w-[72px] pr-4 text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {submissions.length > 0 ? (
              submissions.map((submission) => (
                <AlertDialog key={submission.id}>
                  <TableRow className="transition-colors hover:bg-muted/35">
                    <ContactSubmissionDetailCell className="max-w-[220px] px-4 py-4">
                      <span className="block truncate font-medium">
                        {submission.name}
                      </span>
                    </ContactSubmissionDetailCell>

                    <ContactSubmissionDetailCell className="max-w-[260px] text-muted-foreground">
                      <span className="block truncate">{submission.email}</span>
                    </ContactSubmissionDetailCell>

                    <ContactSubmissionDetailCell className="max-w-[220px] text-muted-foreground">
                      <span className="block truncate">
                        {submission.company?.trim() || "-"}
                      </span>
                    </ContactSubmissionDetailCell>

                    <ContactSubmissionDetailCell>
                      <ContactSubmissionStatusBadge
                        status={submission.status}
                      />
                    </ContactSubmissionDetailCell>

                    <ContactSubmissionDetailCell
                      align="end"
                      className="whitespace-nowrap pr-6 text-muted-foreground"
                    >
                      {formatDate(submission.createdAt)}
                    </ContactSubmissionDetailCell>

                    <TableCell className="pr-4 text-end">
                      <ContactSubmissionRowActions
                        rowAction={rowAction}
                        submission={submission}
                      />
                    </TableCell>
                  </TableRow>

                  <ContactSubmissionDetails submission={submission} />
                </AlertDialog>
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
                        <Link href={clearSearchHref}>Clear search</Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
