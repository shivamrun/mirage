import { headers } from "next/headers";
import Link from "next/link";

import { formatJoinedDate, RoleBadges, UserAvatar } from "@/components/admin";
import { Button } from "@/components/ui/button";
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

export const metadata = getPageMetadata("Users", { path: "/admin/users" });

const usersPageSize = 10;

type AdminUsersPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

function parsePage(value?: string) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function usersPageHref(page: number) {
  return `/admin/users?page=${page}`;
}

function PaginationButton({
  children,
  disabled,
  href,
}: {
  children: React.ReactNode;
  disabled: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <Button disabled type="button" variant="outline">
        {children}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: AdminUsersPageProps) {
  const { page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const offset = (page - 1) * usersPageSize;
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const users = await auth.api.listUsers({
    query: {
      limit: usersPageSize,
      offset,
      sortBy: "createdAt",
      sortDirection: "desc",
    },
    headers: requestHeaders,
  });

  const totalPages = Math.max(1, Math.ceil(users.total / usersPageSize));
  const currentPage = Math.min(page, totalPages);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-medium text-2xl">Users</h1>
          <p className="text-muted-foreground text-sm">
            {users.total} {users.total === 1 ? "account" : "accounts"}
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="min-w-190">
          <TableHeader className="bg-muted/45">
            <TableRow>
              <TableHead className="h-11 px-4">User</TableHead>
              <TableHead className="h-11 px-4">Email</TableHead>
              <TableHead className="h-11 px-4">Role</TableHead>
              <TableHead className="h-11 px-4">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.users.map((user) => (
              <TableRow
                className="bg-background hover:bg-muted/30"
                key={user.id}
              >
                <TableCell className="px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <UserAvatar image={user.image} name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {user.email}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <RoleBadges role={user.role} />
                </TableCell>
                <TableCell className="px-4 py-3 text-muted-foreground">
                  {formatJoinedDate(user.createdAt)}
                </TableCell>
              </TableRow>
            ))}
            {users.users.length === 0 ? (
              <TableRow>
                <TableCell
                  className="px-4 py-10 text-center text-muted-foreground"
                  colSpan={4}
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </section>

      <footer className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Page {currentPage} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <PaginationButton
            disabled={isFirstPage}
            href={usersPageHref(currentPage - 1)}
          >
            Previous
          </PaginationButton>
          <PaginationButton
            disabled={isLastPage}
            href={usersPageHref(currentPage + 1)}
          >
            Next
          </PaginationButton>
        </div>
      </footer>
    </>
  );
}
