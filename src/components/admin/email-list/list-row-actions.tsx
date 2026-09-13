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
import { api } from "@/lib/api/client";

type StatusMessage = {
  message: string;
  tone: "error" | "success";
};

type EmailListRowActionsProps = {
  list: {
    canDelete: boolean;
    description: string | null;
    emailVerificationRequired: boolean;
    key: string;
    name: string;
    status: "active" | "archived";
  };
};

export function EmailListRowActions({ list }: EmailListRowActionsProps) {
  const router = useRouter();
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

    try {
      const { error } = await api.api.admin["email-list"]({
        key: list.key,
      }).status.patch({ status: nextStatus });

      if (error) {
        console.error(getEdenMessage(error, "Could not update email list."));
        return;
      }

      router.refresh();
    } catch {
      console.error("Could not update email list.");
    }
  }

  async function onUpdateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const { error } = await api.api.admin["email-list"]({
        key: list.key,
      }).patch({
        description: formString(formData, "description"),
        emailVerificationRequired:
          formData.get("emailVerificationRequired") === "true",
        name: requiredFormString(formData, "name"),
      });

      if (error) {
        setStatus({
          message: getEdenMessage(error, "Could not update email list."),
          tone: "error",
        });
        return;
      }

      setDialogMode(null);
      router.refresh();
    } catch {
      setStatus({
        message: "Could not update email list.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteList() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const { error } = await api.api.admin["email-list"]({
        key: list.key,
      }).delete();

      if (error) {
        setStatus({
          message: getEdenMessage(error, "Could not update email list."),
          tone: "error",
        });
        return;
      }

      setDialogMode(null);
      router.refresh();
    } catch {
      setStatus({
        message: "Could not update email list.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
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

          {list.canDelete ? (
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

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : null;
}

function requiredFormString(formData: FormData, key: string) {
  return formString(formData, key) ?? "";
}

function getEdenMessage(error: { value?: unknown } | null, fallback: string) {
  const value = error?.value;

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return fallback;
}
