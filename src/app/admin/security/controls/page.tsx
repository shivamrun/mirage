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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="max-w-2xl space-y-2">
        <h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">
          Security Controls
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Force password resets and respond to account-wide session incidents.
        </p>
      </header>

      <SecurityControls summary={summary} />
    </div>
  );
}
