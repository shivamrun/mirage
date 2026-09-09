import {
  Archive,
  ArchiveRestore,
  Eye,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import {
  ADMIN_CONTACT_SUBMISSION_PAGE_PATH,
  type AdminContactSubmissionQueryState,
} from "./query";

type ContactSubmissionStatusAction = (
  formData: FormData,
) => Promise<void> | void;

type AdminContactSubmissionToolbarProps = {
  bulkAction: ContactSubmissionStatusAction;
  clearSearchHref: string;
  hasSubmissions: boolean;
  state: AdminContactSubmissionQueryState;
};

const bulkActions = [
  {
    fromStatus: "new",
    icon: Eye,
    label: "Mark all read",
    status: "read",
  },
  {
    fromStatus: undefined,
    icon: Archive,
    label: "Archive all",
    status: "archived",
  },
  {
    fromStatus: "archived",
    icon: ArchiveRestore,
    label: "Unarchive all",
    status: "read",
  },
] as const;

function ContactSubmissionBulkActionFields({
  state,
}: {
  state: AdminContactSubmissionQueryState;
}) {
  return (
    <>
      {state.query ? (
        <input type="hidden" name="q" value={state.query} />
      ) : null}

      {state.filterValue ? (
        <>
          <input type="hidden" name="filterField" value={state.filterField} />
          <input type="hidden" name="filterValue" value={state.filterValue} />
        </>
      ) : null}
    </>
  );
}

function ContactSubmissionBulkActionsMenu({
  bulkAction,
  disabled,
  state,
}: {
  bulkAction: ContactSubmissionStatusAction;
  disabled: boolean;
  state: AdminContactSubmissionQueryState;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Bulk actions"
          className="h-9"
          disabled={disabled}
          title="Bulk actions"
          type="button"
          variant="outline"
        >
          <MoreHorizontal />
          Actions
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        {bulkActions.map((action) => (
          <form action={bulkAction} key={action.label}>
            <ContactSubmissionBulkActionFields state={state} />
            <input type="hidden" name="status" value={action.status} />
            {action.fromStatus ? (
              <input
                type="hidden"
                name="fromStatus"
                value={action.fromStatus}
              />
            ) : null}

            <DropdownMenuItem asChild key={action.label}>
              <button type="submit">
                <action.icon />
                {action.label}
              </button>
            </DropdownMenuItem>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminContactSubmissionToolbar({
  bulkAction,
  clearSearchHref,
  hasSubmissions,
  state,
}: AdminContactSubmissionToolbarProps) {
  return (
    <div className="shrink-0 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={ADMIN_CONTACT_SUBMISSION_PAGE_PATH}
          className="flex min-w-0 flex-1 items-center gap-2"
          method="get"
        >
          {state.filterValue ? (
            <>
              <input
                type="hidden"
                name="filterField"
                value={state.filterField}
              />
              <input
                type="hidden"
                name="filterValue"
                value={state.filterValue}
              />
            </>
          ) : null}

          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              className="h-9 bg-muted/30 pl-9 shadow-none"
              defaultValue={state.query}
              name="q"
              placeholder="Search by name, email, company or message..."
              spellCheck={false}
            />
          </div>

          <Button type="submit" className="h-9">
            Search
          </Button>

          {state.query ? (
            <Button asChild className="h-9" variant="ghost">
              <Link href={clearSearchHref}>Clear</Link>
            </Button>
          ) : null}
        </form>

        <ContactSubmissionBulkActionsMenu
          bulkAction={bulkAction}
          disabled={!hasSubmissions}
          state={state}
        />
      </div>
    </div>
  );
}
