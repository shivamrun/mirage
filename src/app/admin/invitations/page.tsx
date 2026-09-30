import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Pagination } from "@/components/ui/pagination";
import { AdminInvitationsPanel } from "@/features/admin/components/invitations";
import {
  type AdminInvitationsPageSearchParams,
  invitationsPageHref,
  parseAdminInvitationsSearchParams,
} from "@/features/admin/components/invitations/query";
import { listAdminInvitationsView } from "@/server/db/services/admin/invitations";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";
import { DEFAULT_PAGE_SIZE } from "@/shared/pagination";

export const metadata = getPageMetadata("Invitations", {
  path: "/admin/invitations",
});

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<AdminInvitationsPageSearchParams>;
}) {
  const { effectiveStatus, page } = parseAdminInvitationsSearchParams(
    await searchParams,
  );

  await requireAdmin({ headers: await headers() });

  const invitations = await listAdminInvitationsView({
    effectiveStatus,
    limit: DEFAULT_PAGE_SIZE,
    page,
  });

  if (page !== invitations.page) {
    redirect(invitationsPageHref({ effectiveStatus, page: invitations.page }));
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Invitations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage invitations and access before signup.
        </p>
      </header>

      <AdminInvitationsPanel
        invitations={invitations.invitations}
        status={effectiveStatus}
      />

      <Pagination
        entityLabel="invitations"
        getPageHref={(page) => invitationsPageHref({ effectiveStatus, page })}
        pagination={invitations}
      />
    </div>
  );
}
