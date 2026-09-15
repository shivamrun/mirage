import { headers } from "next/headers";

import { SecurityControls } from "@/components/admin";
import { HeadingBlock } from "@/components/heading-block";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import { getAdminSecurityControlSummaryView } from "@/server/admin/security";

export const metadata = getPageMetadata("Security Controls", {
  path: "/admin/security/controls",
});

export default async function AdminSecurityControlsPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const summary = await getAdminSecurityControlSummaryView();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pt-6 pb-14 ">
      <HeadingBlock
        as="header"
        className="px-6 py-4"
        description="Force password resets and respond to account-wide session incidents."
        size="xl"
        title="Security Controls"
        titleAs="h1"
      />

      <SecurityControls summary={summary} />
    </div>
  );
}
