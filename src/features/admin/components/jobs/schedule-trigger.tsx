"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { AuthStatusMessage } from "@/features/auth/components";
import type { AdminSchedule } from "@/shared/schemas";

export function ScheduleTrigger({ schedule }: { schedule: AdminSchedule }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function trigger() {
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch("/api/admin/jobs/schedules/trigger", {
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          scheduleId: schedule.id,
        }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? "Could not trigger scheduled job.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not trigger scheduled job.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} size="sm" variant="outline">
        <Play /> Run now
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Run scheduled job now?</AlertDialogTitle>
          <AlertDialogDescription>
            Enqueue {schedule.name} once without changing its schedule.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button disabled={pending} onClick={() => void trigger()}>
            {pending ? "Enqueuing…" : "Run now"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
