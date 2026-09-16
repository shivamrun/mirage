import { headers } from "next/headers";

import { AdminEmailListsPanel } from "@/features/admin/components";
import { listAdminEmailListsView } from "@/server/db/services/admin/email-list";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Email Lists", {
  path: "/admin/email-list/all",
});

export default async function AdminEmailListAllPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const lists = await listAdminEmailListsView();

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Email Lists</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage built-in and custom lists, pause submissions, and review signup
          counts.
        </p>
      </header>

      <AdminEmailListsPanel lists={lists} />
    </div>
  );
}
