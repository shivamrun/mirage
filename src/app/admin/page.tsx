import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/db/services/auth/access";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

export const metadata = getPageMetadata("Admin", { path: "/admin" });

export default async function AdminPage() {
  const user = await requireAdmin({
    callbackUrl: "/admin",
  });

  return (
    <section className="flex flex-1 items-center justify-center py-16">
      <section className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-sm">
            {siteConfig.name}
          </p>
          <h1 className="text-4xl">Admin</h1>
          <p className="text-muted-foreground">
            Admin access is active for {user.email}.
          </p>
        </div>
        <Button asChild>
          <Link href="/account">Manage account</Link>
        </Button>
      </section>
    </section>
  );
}
