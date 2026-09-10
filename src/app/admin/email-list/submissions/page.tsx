import { headers } from "next/headers";

import {
  type AdminEmailListPageSearchParams,
  AdminEmailSubmissionsPanel,
  parseAdminEmailListSearchParams,
} from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import {
  listEmailLists,
  listEmailSubscribers,
} from "@/server/db/dal/email-list";

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
    listEmailLists(),
    listEmailSubscribers({ state }),
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
