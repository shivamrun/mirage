"use client";

import { MailPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogCloseButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { emailSchema } from "@/zod/helpers";

export type AdminInvitableRole = "creator" | "moderator";

const roleLabels: Record<
  AdminInvitableRole,
  {
    exampleEmail: string;
    label: string;
  }
> = {
  creator: {
    exampleEmail: "creator@example.com",
    label: "creator",
  },
  moderator: {
    exampleEmail: "moderator@example.com",
    label: "moderator",
  },
};

type InviteStatus =
  | {
      message: string;
      tone: "error" | "success";
    }
  | undefined;

type RoleInviteFormProps = {
  inviteRole: AdminInvitableRole;
};

export function RoleInviteForm({ inviteRole }: RoleInviteFormProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<InviteStatus>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const roleLabel = roleLabels[inviteRole];
  const inputId = `${inviteRole}-invite-email`;
  const formId = `${inviteRole}-invite-form`;

  function resetDialog(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setEmail("");
      setStatus(undefined);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(undefined);

    const validation = emailSchema.safeParse(email);

    if (!validation.success) {
      setStatus({
        tone: "error",
        message: validation.error.issues[0]?.message ?? "Enter a valid email.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await authClient.invite.create({
        email: validation.data,
        role: inviteRole,
      });

      if (result.error) {
        setStatus({
          tone: "error",
          message: getAuthErrorMessage(result.error),
        });
        return;
      }

      setEmail("");
      setStatus({
        tone: "success",
        message: `Invite sent to ${validation.data}.`,
      });
      router.refresh();
    } catch (reason) {
      setStatus({
        tone: "error",
        message: getUnexpectedAuthErrorMessage(reason),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasError = status?.tone === "error";
  const isSuccess = status?.tone === "success";

  return (
    <AlertDialog open={open} onOpenChange={resetDialog}>
      <AlertDialogTrigger asChild>
        <Button type="button">
          <MailPlus aria-hidden="true" />
          Invite {roleLabel.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogCloseButton disabled={isSubmitting} />
        <AlertDialogHeader>
          <AlertDialogTitle>Invite {roleLabel.label}</AlertDialogTitle>
          <AlertDialogDescription>
            {isSuccess
              ? `The ${roleLabel.label} invite is ready in the list.`
              : `Send a private invite that grants the ${roleLabel.label} role.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isSuccess ? (
          <output className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700 text-sm dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            {status.message}
          </output>
        ) : (
          <form className="flex flex-col gap-5" id={formId} onSubmit={onSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={inputId}>Email</FieldLabel>
                <Input
                  aria-invalid={hasError}
                  autoComplete="email"
                  id={inputId}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={roleLabel.exampleEmail}
                  type="email"
                  value={email}
                />
                {status ? <FieldError>{status.message}</FieldError> : null}
              </Field>
            </FieldGroup>
          </form>
        )}
        <AlertDialogFooter>
          {isSuccess ? (
            <>
              <AlertDialogCancel>Close</AlertDialogCancel>
              <Button onClick={() => resetDialog(false)} type="button">
                Done
              </Button>
            </>
          ) : (
            <>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancel
              </AlertDialogCancel>
              <Button disabled={isSubmitting} form={formId} type="submit">
                <MailPlus aria-hidden="true" />
                {isSubmitting ? "Sending..." : "Send invite"}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CreatorInviteForm() {
  return <RoleInviteForm inviteRole="creator" />;
}

export function ModeratorInviteForm() {
  return <RoleInviteForm inviteRole="moderator" />;
}
