"use client";

import { Fingerprint } from "lucide-react";

import { StopImpersonatingButton } from "@/components/auth/stop-impersonating-button";

type AccountImpersonationNoticeProps = {
  impersonatedBy?: null | string;
};

export function AccountImpersonationNotice({
  impersonatedBy,
}: AccountImpersonationNoticeProps) {
  if (!impersonatedBy) {
    return null;
  }

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-amber-500/20 bg-background/70 text-amber-700 dark:text-amber-300">
          <Fingerprint className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-medium text-sm">Impersonation active</h2>
          <p className="mt-1 break-all text-muted-foreground text-sm">
            Admin session: {impersonatedBy}
          </p>
        </div>
      </div>

      <StopImpersonatingButton className="sm:items-end" />
    </section>
  );
}
