"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function SchedulesRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
      size="sm"
      type="button"
      variant="outline"
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
