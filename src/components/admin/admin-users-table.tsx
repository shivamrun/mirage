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
import {
  ADMIN_USERS_PAGE_PATH,
  type AdminUserListItem,
} from "./admin-users-query";
import {
  formatJoinedDate,
  RoleBadges,
  UserAvatar,
} from "./admin-users-table-helpers";

type AdminUsersTableProps = {
  users: AdminUserListItem[];
  query: string;
  hasFilter: boolean;
  hasFilters: boolean;
};

export function AdminUsersTable({
  hasFilter,
  hasFilters,
  query,
  users,
}: AdminUsersTableProps) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden">
      <ScrollArea className="h-full rounded-xl border bg-card">
        <Table className="min-w-[760px]">
          <TableHeader className="sticky top-0 z-20 bg-muted/80 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-14 px-4">
                <span className="sr-only">Avatar</span>
              </TableHead>

              <TableHead className="min-w-[180px] px-2">Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="pl-1 text-end">Role</TableHead>
              <TableHead className="w-[190px] pr-6 text-end">Joined</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {users.length > 0 ? (
              users.map((user) => {
                const userHref = `${ADMIN_USERS_PAGE_PATH}/${user.id}`;

                return (
                  <TableRow
                    key={user.id}
                    className="group transition-colors hover:bg-muted/35"
                  >
                    <TableCell className="w-14 p-0">
                      <Link
                        href={userHref}
                        className="block w-fit py-3 pr-2 pl-4"
                      >
                        <UserAvatar image={user.image} name={user.name} />
                      </Link>
                    </TableCell>

                    <TableCell className="min-w-[180px] p-0">
                      <Link
                        href={userHref}
                        className="block h-full min-w-0 py-4 pr-4 pl-2 underline-offset-4 hover:underline"
                      >
                        <p className="truncate text-sm font-medium">
                          {user.name}
                        </p>
                      </Link>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {user.email}
                    </TableCell>

                    <TableCell className="text-end">
                      <div className="flex justify-end">
                        <RoleBadges role={user.role} />
                      </div>
                    </TableCell>

                    <TableCell className="whitespace-nowrap pr-6 text-end text-sm text-muted-foreground">
                      {formatJoinedDate(user.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="h-72">
                  <div className="flex flex-col items-center justify-center text-center">
                    <p className="font-medium">No users found</p>

                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {query || hasFilter
                        ? "No users matched your current search and filters."
                        : "There are no user accounts yet."}
                    </p>

                    {query || hasFilters ? (
                      <Button
                        asChild
                        className="mt-4"
                        size="sm"
                        variant="outline"
                      >
                        <Link href={ADMIN_USERS_PAGE_PATH}>
                          Clear everything
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
