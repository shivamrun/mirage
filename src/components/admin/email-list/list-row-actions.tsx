"use client";

import {
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  PauseCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AuthStatusMessage } from "@/components/auth";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type StatusMessage = {
  message: string;
  tone: "error" | "success";
};

type EmailListRowActionsProps = {
  list: {
    description: string | null;
    emailVerificationRequired: boolean;
    key: string;
    name: string;
    status: "active" | "archived";
  };
};

const protectedEmailListKeys = new Set(["waitlist", "newsletter"]);

async function readErrorMessage(response: Response) {
  try {
    const body = (await response.json()) as { message?: unknown };

    return typeof body.message === "string"
      ? body.message
      : "Could not update email list.";
  } catch {
    return "Could not update email list.";
  }
}

export function EmailListRowActions({ list }: EmailListRowActionsProps) {
  const router = useRouter();
  const isProtectedList = protectedEmailListKeys.has(list.key);
  const [dialogMode, setDialogMode] = React.useState<
    "delete" | "update" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();

  React.useEffect(() => {
    if (!dialogMode) {
      setStatus(undefined);
      setIsSubmitting(false);
    }
  }, [dialogMode]);

  async function updateStatus() {
    const nextStatus = list.status === "active" ? "archived" : "active";
    const response = await fetch(
      `/api/admin/email-list/${encodeURIComponent(list.key)}/status`,
      {
        body: JSON.stringify({ status: nextStatus }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      },
    );

    if (!response.ok) {
      console.error(await readErrorMessage(response));
      return;
    }

    router.refresh();
  }

  async function onUpdateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(
      `/api/admin/email-list/${encodeURIComponent(list.key)}`,
      {
        body: JSON.stringify({
          description: formData.get("description"),
          emailVerificationRequired:
            formData.get("emailVerificationRequired") === "true",
          name: formData.get("name"),
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "PATCH",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setStatus({
        message: await readErrorMessage(response),
        tone: "error",
      });
      return;
    }

    setDialogMode(null);
    router.refresh();
  }

  async function deleteList() {
    setStatus(undefined);
    setIsSubmitting(true);

    const response = await fetch(
      `/api/admin/email-list/${encodeURIComponent(list.key)}`,
      {
        method: "DELETE",
      },
    );

    setIsSubmitting(false);

    if (!response.ok) {
      setStatus({
        message: await readErrorMessage(response),
        tone: "error",
      });
      return;
    }

    setDialogMode(null);
    router.refresh();
  }

  return (
    <AlertDialog
      open={dialogMode !== null}
      onOpenChange={(open) => setDialogMode(open ? dialogMode : null)}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for ${list.key}`}
            size="icon-sm"
            title="Actions"
            type="button"
            variant="ghost"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setDialogMode("update")}>
            <Pencil />
            Update
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => void updateStatus()}>
            {list.status === "active" ? <Archive /> : <ArchiveRestore />}
            {list.status === "active" ? "Archive all" : "Activate all"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem disabled>
            <PauseCircle />
            Pause submissions
          </DropdownMenuItem>

          {!isProtectedList ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => setDialogMode("delete")}
                variant="destructive"
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialogContent>
        {dialogMode === "delete" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete email list</AlertDialogTitle>
              <AlertDialogDescription>
                Delete {list.key} and all subscriptions collected for it. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {status ? (
              <AuthStatusMessage tone={status.tone}>
                {status.message}
              </AuthStatusMessage>
            ) : null}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <Button
                disabled={isSubmitting}
                onClick={() => void deleteList()}
                type="button"
                variant="destructive"
              >
                {isSubmitting ? "Deleting..." : "Delete list"}
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Update email list</AlertDialogTitle>
              <AlertDialogDescription>
                Change the settings for {list.key}.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <form className="space-y-4" onSubmit={onUpdateSubmit}>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.message}
                </AuthStatusMessage>
              ) : null}
              <Input
                defaultValue={list.name}
                name="name"
                placeholder="Newsletter"
                required
              />
              <Input
                defaultValue={list.description ?? ""}
                name="description"
                placeholder="Optional description"
              />
              <label
                className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                htmlFor={`email-list-verification-required-${list.key}`}
              >
                <Checkbox
                  defaultChecked={list.emailVerificationRequired}
                  id={`email-list-verification-required-${list.key}`}
                  name="emailVerificationRequired"
                  value="true"
                />
                Require email verification
              </label>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>
                  Cancel
                </AlertDialogCancel>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Updating..." : "Update"}
                </Button>
              </AlertDialogFooter>
            </form>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
