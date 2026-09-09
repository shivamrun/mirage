import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  ADMIN_CONTACT_SUBMISSION_PAGE_PATH,
  type AdminContactSubmissionQueryState,
} from "./query";

type AdminContactSubmissionToolbarProps = {
  clearSearchHref: string;
  state: AdminContactSubmissionQueryState;
};

export function AdminContactSubmissionToolbar({
  clearSearchHref,
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
      </div>
    </div>
  );
}
