import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

function AppHeaderAuthActions({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  if (isAuthenticated) {
    return (
      <Button asChild size="sm">
        <Link href="/account">
          Account
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild className="hidden sm:inline-flex" variant="ghost">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/register">
          Create account
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
    </>
  );
}

export { AppHeaderAuthActions };
