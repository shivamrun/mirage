import { headers } from "next/headers";

import { AdminEmailSubmissionsPanel } from "@/features/admin/components";
import {
  type AdminEmailListPageSearchParams,
  parseAdminEmailListSearchParams,
} from "@/features/admin/query/email-list-query";
import {
  listAdminEmailListsView,
  listAdminEmailSubscribersView,
} from "@/server/db/services/admin/email-list";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Email Submissions", {
  path: "/admin/email-list/submissions",
});

type AdminEmailListSubmissionsPageProps = {
  searchParams: Promise<AdminEmailListPageSearchParams>;
};

export default async function AdminEmailListSubmissionsPage({
  searchParams,
}: AdminEmailListSubmissionsPageProps) {
  const params = await searchParams;
  const state = parseAdminEmailListSearchParams(params);
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const [lists, subscribers] = await Promise.all([
    listAdminEmailListsView(),
    listAdminEmailSubscribersView({ state }),
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Email Submissions
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review waitlist and newsletter email submissions.
        </p>
      </header>

      <AdminEmailSubmissionsPanel
        lists={lists}
        state={state}
        subscribers={subscribers}
      />
    </div>
  );
}
