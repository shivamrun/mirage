import { headers } from "next/headers";

import { SecurityControls } from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";
import { getSecurityControlSummary } from "@/server/db/dal/security";

export const metadata = getPageMetadata("Security Controls", {
  path: "/admin/security/controls",
});

export default async function AdminSecurityControlsPage() {
  const requestHeaders = await headers();

  await requireAdmin({
    headers: requestHeaders,
  });

  const summary = await getSecurityControlSummary();

  return (
    <div className="flex min-h-0 flex-col">
      <header className="shrink-0 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Security Controls
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Force password resets and respond to account-wide session incidents.
        </p>
      </header>

      <SecurityControls summary={summary} />
    </div>
  );
}
