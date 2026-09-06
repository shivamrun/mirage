import { Search } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { applyAdminUsersListState } from "./actions";
import { AdminUsersFilterDialog } from "./filter-dialog";
import {
  type AdminUsersFilterStatus,
  type AdminUsersQueryState,
  DEFAULT_SEARCH_FIELD,
  DEFAULT_SEARCH_OPERATOR,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
} from "./query";

type AdminUsersToolbarProps = {
  state: AdminUsersQueryState;
  status: AdminUsersFilterStatus;
  clearSearchHref: string;
  clearFiltersHref: string;
};

export function AdminUsersToolbar({
  clearFiltersHref,
  clearSearchHref,
  state,
  status,
}: AdminUsersToolbarProps) {
  return (
    <div className="shrink-0 pb-4">
      <div className="flex items-center gap-2">
        <form
          action={applyAdminUsersListState}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          {state.searchField !== DEFAULT_SEARCH_FIELD ? (
            <input type="hidden" name="searchField" value={state.searchField} />
          ) : null}

          {state.searchOperator !== DEFAULT_SEARCH_OPERATOR ? (
            <input
              type="hidden"
              name="searchOperator"
              value={state.searchOperator}
            />
          ) : null}

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
              <input
                type="hidden"
                name="filterOperator"
                value={state.filterOperator}
              />
            </>
          ) : null}

          {state.sortBy !== DEFAULT_SORT_BY ? (
            <input type="hidden" name="sortBy" value={state.sortBy} />
          ) : null}

          {state.sortDirection !== DEFAULT_SORT_DIRECTION ? (
            <input
              type="hidden"
              name="sortDirection"
              value={state.sortDirection}
            />
          ) : null}

          <div className="relative min-w-0 flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              className="h-9 bg-muted/30 pl-9 shadow-none"
              defaultValue={state.query}
              name="q"
              placeholder="Search by name or email..."
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

        <AdminUsersFilterDialog
          clearFiltersHref={clearFiltersHref}
          state={state}
          status={status}
        />
      </div>
    </div>
  );
}
