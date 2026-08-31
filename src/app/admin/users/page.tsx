import { Plus, Search } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { formatJoinedDate, RoleBadges, UserAvatar } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Users", {
  path: "/admin/users",
});

const PAGE_SIZE = 10;

type AdminUsersPageProps = {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
};

function parsePage(value?: string) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function usersPageHref({ page, query }: { page: number; query?: string }) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (query) {
    params.set("q", query);
  }

  const search = params.toString();

  return search ? `/admin/users?${search}` : "/admin/users";
}

function PaginationButton({
  children,
  disabled,
  href,
}: {
  children: ReactNode;
  disabled?: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <Button disabled size="sm" type="button" variant="ghost">
        {children}
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="ghost">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const params = await searchParams;

  const page = parsePage(params.page);
  const query = params.q?.trim() ?? "";

  const offset = (page - 1) * PAGE_SIZE;

  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const users = await auth.api.listUsers({
    query: {
      limit: PAGE_SIZE,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",

      ...(query
        ? {
            searchValue: query,
            searchField: query.includes("@") ? "email" : "name",
            searchOperator: "contains" as const,
          }
        : {}),
    },
    headers: requestHeaders,
  });

  const totalPages = Math.max(1, Math.ceil(users.total / PAGE_SIZE));

  if (page > totalPages) {
    redirect(
      usersPageHref({
        page: totalPages,
        query,
      }),
    );
  }

  const isFirstPage = page === 1;
  const isLastPage = page >= totalPages;

  const firstResult = users.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;

  const lastResult = Math.min(page * PAGE_SIZE, users.total);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 px-6 pt-6 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage accounts, roles and user access.
        </p>
      </header>

      <div className="shrink-0 px-6 pb-4">
        <form className="flex items-center gap-2" method="GET">
          <div className="relative w-full flex-1">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              className="h-9 bg-muted/30 pl-9 shadow-none"
              defaultValue={query}
              name="q"
              placeholder="Search by name or email..."
              spellCheck={false}
            />
          </div>

          <div className="flex items-center gap-x-2">
            <Button type="submit" className="h-9">
              Search
            </Button>

            {query ? (
              <Button asChild className="h-9" variant="ghost">
                <Link href="/admin/users">Clear</Link>
              </Button>
            ) : null}

            <Button asChild className="h-9" variant="secondary">
              <Link href="/admin/users/new">
                <Plus className="size-4" />
                Create user
              </Link>
            </Button>
          </div>
        </form>
      </div>

      {/* List */}
      <section className="min-h-0 flex-1 overflow-hidden px-6">
        <ScrollArea className="h-full rounded-xl border bg-card">
          <Table className="min-w-[760px]">
            <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                {/* Avatar */}
                <TableHead className="w-14 px-4">
                  <span className="sr-only">Avatar</span>
                </TableHead>

                {/* Name */}
                <TableHead className="min-w-[180px] px-2">Name</TableHead>

                <TableHead>Email</TableHead>

                <TableHead className="text-end pl-1 ">Role</TableHead>

                <TableHead className="w-[190px] text-end pr-6">Joined</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {users.users.length > 0 ? (
                users.users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="group transition-colors hover:bg-muted/35"
                  >
                    {/* Avatar */}
                    <TableCell className="w-14 p-0">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="block w-fit py-3 pr-2 pl-4"
                      >
                        <UserAvatar image={user.image} name={user.name} />
                      </Link>
                    </TableCell>

                    {/* Name */}
                    <TableCell className="min-w-[180px] p-0">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="block min-w-0 h-full py-4 pr-4 pl-2 hover:underline underline-offset-4"
                      >
                        <p className="truncate text-sm font-medium transition-colors">
                          {user.name}
                        </p>
                      </Link>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>

                    {/* Role */}
                    <TableCell className="grid mt-2 justify-end">
                      <RoleBadges role={user.role} />
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground text-end pr-6">
                      {formatJoinedDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-72">
                    <div className="flex flex-col items-center justify-center text-center">
                      <p className="font-medium">No users found</p>

                      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                        {query
                          ? `No users matched "${query}".`
                          : "There are no user accounts yet."}
                      </p>

                      {query ? (
                        <Button
                          asChild
                          className="mt-4"
                          size="sm"
                          variant="outline"
                        >
                          <Link href="/admin/users">Clear search</Link>
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

      {/* Footer */}
      <footer className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
        <p className="text-sm text-muted-foreground">
          {users.total > 0 ? (
            <>
              {firstResult}-{lastResult} of {users.total.toLocaleString()} users
            </>
          ) : (
            "0 users"
          )}
        </p>

        <div className="flex items-center gap-2">
          <span className="mr-2 text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>

          <PaginationButton
            disabled={isFirstPage}
            href={usersPageHref({
              page: page - 1,
              query,
            })}
          >
            Previous
          </PaginationButton>

          <PaginationButton
            disabled={isLastPage}
            href={usersPageHref({
              page: page + 1,
              query,
            })}
          >
            Next
          </PaginationButton>
        </div>
      </footer>
    </div>
  );
}
