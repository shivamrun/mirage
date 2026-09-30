"use client";

import { MailPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthStatusMessage } from "@/features/auth/components";
import { api } from "@/shared/api/client";
import { invitationsPageHref } from "./query";

type StatusMessage = {
  message: string;
  tone: "error" | "success";
};

export function InvitationCreateDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState("user");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();

  React.useEffect(() => {
    if (!open) {
      setRole("user");
      setStatus(undefined);
      setIsSubmitting(false);
    }
  }, [open]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const formData = new FormData(event.currentTarget);
      const { error } = await api.api.admin.invitations.post({
        email: requiredFormString(formData, "email"),
        role,
      });

      if (error) {
        setStatus({
          message: getEdenMessage(error, "Could not create invitation."),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.push(invitationsPageHref({ effectiveStatus: "pending" }));
      router.refresh();
    } catch {
      setStatus({
        message: "Could not create invitation.",
        tone: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button">
          <MailPlus data-icon="inline-start" />
          Invite user
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Invite user</AlertDialogTitle>
          <AlertDialogDescription>
            Send a signup invitation with a role assignment.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          {status ? (
            <AuthStatusMessage tone={status.tone}>
              {status.message}
            </AuthStatusMessage>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="invitation-email">Email</Label>
            <Input
              autoComplete="email"
              id="invitation-email"
              name="email"
              placeholder="person@example.com"
              required
              type="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invitation-role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full" id="invitation-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Cancel
            </AlertDialogCancel>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Sending..." : "Send invite"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function requiredFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
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
