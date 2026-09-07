import { headers } from "next/headers";

import { AdminUserCreateForm } from "@/components/admin";
import { requireAdmin } from "@/lib/auth/access";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Create User", {
  path: "/admin/users/new",
});

export default async function AdminCreateUserPage() {
  await requireAdmin({
    headers: await headers(),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Create user
            </h1>

            <p className="mt-1 text-sm text-muted-foreground">
              Add a password user and assign their starting roles.
            </p>
          </div>
        </div>
      </header>

      <section>
        <AdminUserCreateForm />
      </section>
    </div>
  );
}
