"use client";

import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/features/auth/client";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { cn } from "@/shared/utils";
import { AuthStatusMessage } from "./auth-form-shell";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

type StopImpersonatingButtonProps = {
  className?: string;
  redirectTo?: string;
};

export function StopImpersonatingButton({
  className,
  redirectTo = "/admin/users",
}: StopImpersonatingButtonProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function stopImpersonating() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.admin.stopImpersonating();

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {status ? (
        <AuthStatusMessage className="text-left" tone={status.tone}>
          {status.text}
        </AuthStatusMessage>
      ) : null}

      <Button
        disabled={isSubmitting}
        onClick={stopImpersonating}
        type="button"
        variant="outline"
      >
        <ShieldCheck data-icon="inline-start" />
        {isSubmitting ? "Restoring admin..." : "Stop impersonating"}
      </Button>
    </div>
  );
}
