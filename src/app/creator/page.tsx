import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireCreator } from "@/lib/auth/access";

export const metadata: Metadata = {
  title: "Creator | Grove",
};

export default async function CreatorPage() {
  const user = await requireCreator({
    callbackUrl: "/creator",
  });

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <section className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <p className="font-medium text-muted-foreground text-sm">Grove</p>
          <h1 className="text-4xl">Creator</h1>
          <p className="text-muted-foreground">
            Creator access is active for {user.email}.
          </p>
        </div>
        <Button asChild>
          <Link href="/account">Manage account</Link>
        </Button>
      </section>
    </main>
  );
}
