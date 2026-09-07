import { ListFilter } from "lucide-react";
import Link from "next/link";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { AdminUsersFilterControls } from "./filter-controls";
import type { AdminUsersFilterStatus, AdminUsersQueryState } from "./query";
import {
  ADMIN_USERS_PAGE_PATH,
  ADMIN_USERS_SEARCH_FIELDS,
  ADMIN_USERS_SEARCH_OPERATORS,
  ADMIN_USERS_SORT_FIELDS,
} from "./query";

type AdminUsersFilterDialogProps = {
  state: AdminUsersQueryState;
  status: AdminUsersFilterStatus;
  clearFiltersHref: string;
};

export function AdminUsersFilterDialog({
  clearFiltersHref,
  state,
  status,
}: AdminUsersFilterDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" className="h-9" variant="outline">
          <ListFilter className="size-4" />
          Filters
          {status.hasFilters ? (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]"
            >
              {status.activeCount}
            </Badge>
          ) : null}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
        <form action={ADMIN_USERS_PAGE_PATH} method="get">
          <AlertDialogHeader>
            <AlertDialogTitle>Filter users</AlertDialogTitle>

            <AlertDialogDescription>
              Filter the user list or change how results are sorted.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-5 py-6">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Search</p>

                <p className="text-xs text-muted-foreground">
                  Match the search text against a selected user field.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="search-value"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Text
                </label>

                <Input
                  id="search-value"
                  name="q"
                  defaultValue={state.query}
                  placeholder="Search by name or email..."
                  spellCheck={false}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="search-field"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Search in
                  </label>

                  <Select defaultValue={state.searchField} name="searchField">
                    <SelectTrigger id="search-field" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ADMIN_USERS_SEARCH_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="search-operator"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Match
                  </label>

                  <Select
                    defaultValue={state.searchOperator}
                    name="searchOperator"
                  >
                    <SelectTrigger id="search-operator" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ADMIN_USERS_SEARCH_OPERATORS.map((operator) => (
                        <SelectItem key={operator.value} value={operator.value}>
                          {operator.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t" />

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Filter</p>

                <p className="text-xs text-muted-foreground">
                  Apply one field filter to the current result set.
                </p>
              </div>

              <AdminUsersFilterControls state={state} />
            </div>

            <div className="border-t" />

            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium">Sort</p>

                <p className="text-xs text-muted-foreground">
                  Choose how users should be ordered.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="sort-by"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Sort by
                  </label>

                  <Select defaultValue={state.sortBy} name="sortBy">
                    <SelectTrigger id="sort-by" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      {ADMIN_USERS_SORT_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="sort-direction"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Direction
                  </label>

                  <Select
                    defaultValue={state.sortDirection}
                    name="sortDirection"
                  >
                    <SelectTrigger id="sort-direction" className="w-full">
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value="desc">Descending</SelectItem>
                      <SelectItem value="asc">Ascending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            {status.hasFilters ? (
              <Button
                asChild
                type="button"
                variant="ghost"
                className="sm:mr-auto"
              >
                <Link href={clearFiltersHref}>Reset filters</Link>
              </Button>
            ) : null}

            <AlertDialogCancel>Cancel</AlertDialogCancel>

            <Button type="submit">Apply filters</Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
