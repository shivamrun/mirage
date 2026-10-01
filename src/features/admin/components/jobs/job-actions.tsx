"use client";

import { Eye, MoreHorizontal, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AuthStatusMessage } from "@/features/auth/components";
import type { AdminJob, AdminJobDetail } from "@/shared/schemas";
import { formatDate } from "../shared/formatters";
import { RecordField, RecordGrid } from "../user-detail/primitives";

type Mode = "details" | "remove" | "retry";

function removeLabel(job: AdminJob) {
  return ["waiting", "delayed"].includes(job.status) ? "Cancel" : "Remove";
}

export function JobActions({ job }: { job: AdminJob }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>();
  const [detail, setDetail] = useState<AdminJobDetail>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const canRemove =
    ["waiting", "delayed", "completed", "failed"].includes(job.status) &&
    !job.schedulerId;

  async function openDetails() {
    setMode("details");
    setError(undefined);
    setDetail(undefined);
    setPending(true);
    try {
      const params = new URLSearchParams({ jobId: job.id, queue: job.queue });
      const response = await fetch(`/api/admin/jobs/detail?${params}`, {
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => null)) as {
        job?: AdminJobDetail;
        message?: string;
      } | null;
      if (!response.ok || !body?.job) {
        setError(body?.message ?? "Could not load job details.");
      } else {
        setDetail(body.job);
      }
    } catch {
      setError("Could not load job details.");
    } finally {
      setPending(false);
    }
  }

  async function mutate() {
    if (mode !== "retry" && mode !== "remove") return;
    setPending(true);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/jobs/${mode}`, {
        body: JSON.stringify({ jobId: job.id, queue: job.queue }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      if (!response.ok) {
        setError(body?.message ?? `Could not ${mode} job.`);
        return;
      }
      setMode(undefined);
      router.refresh();
    } catch {
      setError(`Could not ${mode} job.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog
      open={Boolean(mode)}
      onOpenChange={(open) => {
        if (!open) {
          setMode(undefined);
          setDetail(undefined);
          setError(undefined);
        }
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for job ${job.id}`}
            size="icon-sm"
            variant="ghost"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void openDetails()}>
            <Eye /> Details
          </DropdownMenuItem>
          {job.status === "failed" ? (
            <DropdownMenuItem onSelect={() => setMode("retry")}>
              <RefreshCw /> Retry
            </DropdownMenuItem>
          ) : null}
          {canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setMode("remove")}
                variant="destructive"
              >
                <Trash2 /> {removeLabel(job)}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent
        className={mode === "details" ? "max-w-2xl sm:max-w-2xl" : undefined}
      >
        {mode === "details" ? <AlertDialogCloseButton /> : null}
        <AlertDialogHeader>
          <AlertDialogTitle>
            {mode === "details"
              ? "Job details"
              : mode === "retry"
                ? "Retry failed job"
                : `${removeLabel(job)} job`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "details"
              ? "Only an admin-safe, redacted representation is shown."
              : mode === "retry"
                ? "Return this failed job to its queue for another attempt?"
                : "This removes the retained queue record and cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <AuthStatusMessage tone="error">{error}</AuthStatusMessage>
        ) : null}
        {mode === "details" && pending ? (
          <p className="text-sm text-muted-foreground">Loading details…</p>
        ) : null}
        {mode === "details" && detail ? (
          <ScrollArea className="max-h-[60vh]">
            <RecordGrid compact>
              <RecordField label="Job ID" mono>
                {detail.id}
              </RecordField>
              <RecordField label="Queue">{detail.queue}</RecordField>
              <RecordField label="Name" mono>
                {detail.name}
              </RecordField>
              <RecordField label="Status">{detail.status}</RecordField>
              <RecordField label="Created">
                {formatDate(detail.createdAt)}
              </RecordField>
              <RecordField label="Processed">
                {formatDate(detail.processedAt, "-")}
              </RecordField>
              <RecordField label="Finished">
                {formatDate(detail.finishedAt, "-")}
              </RecordField>
              <RecordField label="Attempts">
                {detail.attemptsMade} / {detail.maxAttempts}
              </RecordField>
              <RecordField label="Scheduler ID" mono>
                {detail.schedulerId ?? "-"}
              </RecordField>
              <RecordField label="Failure reason">
                {detail.failureReason ?? "-"}
              </RecordField>
            </RecordGrid>
            <div className="mt-5 rounded-lg border bg-muted/20 p-3">
              <p className="font-medium text-sm">Safe payload</p>
              {Object.keys(detail.payload.fields).length ? (
                <dl className="mt-2 space-y-2">
                  {Object.entries(detail.payload.fields).map(([key, value]) => (
                    <div
                      className="grid grid-cols-[10rem_1fr] gap-3 text-xs"
                      key={key}
                    >
                      <dt className="text-muted-foreground">{key}</dt>
                      <dd className="break-all font-mono">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-1 text-muted-foreground text-sm">
                  {detail.payload.redacted
                    ? "Payload withheld."
                    : "No payload fields."}
                </p>
              )}
            </div>
          </ScrollArea>
        ) : null}
        {mode !== "details" ? (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              disabled={pending}
              onClick={() => void mutate()}
              variant={mode === "remove" ? "destructive" : "default"}
            >
              {pending
                ? "Working…"
                : mode === "retry"
                  ? "Retry job"
                  : removeLabel(job)}
            </Button>
          </AlertDialogFooter>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
