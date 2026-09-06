"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Ban,
  CheckCircle2,
  ImageIcon,
  KeyRound,
  type LucideIcon,
  Mail,
  Pencil,
  Save,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";

import {
  AuthInputField,
  AuthStatusMessage,
  EmailField,
  PasswordField,
} from "@/components/auth";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/components/auth/auth-errors";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth/client";
import { authRoles, normalizeRoles, type RoleValue } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import {
  type AdminUserBanInput,
  type AdminUserBanValues,
  type AdminUserEmailUpdateInput,
  type AdminUserEmailUpdateValues,
  type AdminUserImageUpdateInput,
  type AdminUserImageUpdateValues,
  type AdminUserNameUpdateInput,
  type AdminUserNameUpdateValues,
  type AdminUserPasswordUpdateInput,
  type AdminUserPasswordUpdateValues,
  type AdminUserRoleUpdateInput,
  type AdminUserRoleUpdateValues,
  adminUserBanSchema,
  adminUserEmailUpdateSchema,
  adminUserImageUpdateSchema,
  adminUserNameUpdateSchema,
  adminUserPasswordUpdateSchema,
  adminUserRoleUpdateSchema,
} from "@/zod";
import { formatRoleName } from "./admin-users-table-helpers";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

type AdminUserNameUpdateDialogProps = {
  className?: string;
  currentName: string;
  userId: string;
};

type AdminUserEmailUpdateDialogProps = {
  className?: string;
  currentEmail: string;
  userId: string;
};

type AdminUserImageUpdateDialogProps = {
  className?: string;
  currentImage?: null | string;
  userId: string;
};

type AdminUserPasswordUpdateDialogProps = {
  className?: string;
  userId: string;
};

type AdminUserRoleUpdateDialogProps = {
  className?: string;
  currentRole: RoleValue;
  userId: string;
};

type AdminUserBanDialogProps = {
  className?: string;
  isBanned: boolean;
  userId: string;
  userName: string;
};

export function AdminUserNameUpdateDialog({
  className,
  currentName,
  userId,
}: AdminUserNameUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminUserNameUpdateInput,
    undefined,
    AdminUserNameUpdateValues
  >({
    resolver: zodResolver(adminUserNameUpdateSchema),
    defaultValues: {
      name: currentName,
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({ name: currentName });
    setStatus(undefined);
  }, [currentName, form, open]);

  async function onSubmit(values: AdminUserNameUpdateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.updateUser({
        userId,
        data: {
          name: values.name,
        },
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton
          aria-haspopup="dialog"
          className={className}
          icon={UserRound}
        >
          Update
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Update name</AlertDialogTitle>
            <AlertDialogDescription>
              Change this user's display name.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <AuthInputField
                autoComplete="name"
                error={form.formState.errors.name?.message}
                id="admin-user-name"
                label="Name"
                placeholder="Jane Appleseed"
                required
                {...form.register("name")}
              />
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save name"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserBanDialog({
  className,
  isBanned,
  userId,
  userName,
}: AdminUserBanDialogProps) {
  return isBanned ? (
    <AdminUserUnbanDialog
      className={className}
      userId={userId}
      userName={userName}
    />
  ) : (
    <AdminUserBanUserDialog
      className={className}
      userId={userId}
      userName={userName}
    />
  );
}

function AdminUserBanUserDialog({
  className,
  userId,
  userName,
}: Omit<AdminUserBanDialogProps, "isBanned">) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<AdminUserBanInput, undefined, AdminUserBanValues>({
    resolver: zodResolver(adminUserBanSchema),
    defaultValues: {
      banExpiresInDays: "",
      banReason: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      banExpiresInDays: "",
      banReason: "",
    });
    setStatus(undefined);
  }, [form, open]);

  async function onSubmit(values: AdminUserBanValues) {
    setStatus(undefined);

    try {
      const banExpiresIn = values.banExpiresInDays
        ? values.banExpiresInDays * 24 * 60 * 60
        : undefined;
      const result = await authClient.admin.banUser({
        userId,
        banReason: values.banReason,
        banExpiresIn,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton
          className={className}
          icon={Ban}
          variant="destructive"
        >
          Ban
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban user</AlertDialogTitle>
            <AlertDialogDescription>
              Ban {userName} and revoke their active sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <Field data-invalid={Boolean(form.formState.errors.banReason)}>
                <FieldLabel htmlFor="admin-user-ban-reason">
                  Ban reason
                </FieldLabel>
                <Textarea
                  aria-invalid={
                    Boolean(form.formState.errors.banReason) || undefined
                  }
                  id="admin-user-ban-reason"
                  placeholder="Reason shown in admin records"
                  {...form.register("banReason")}
                />
                {form.formState.errors.banReason?.message ? (
                  <FieldError>
                    {form.formState.errors.banReason.message}
                  </FieldError>
                ) : null}
              </Field>

              <AuthInputField
                error={form.formState.errors.banExpiresInDays?.message}
                id="admin-user-ban-expires-in-days"
                label="Duration in days"
                min={1}
                placeholder="Leave empty for permanent"
                type="number"
                {...form.register("banExpiresInDays")}
              />
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button
              disabled={form.formState.isSubmitting}
              type="submit"
              variant="destructive"
            >
              <Ban data-icon="inline-start" />
              {form.formState.isSubmitting ? "Banning..." : "Ban user"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AdminUserUnbanDialog({
  className,
  userId,
  userName,
}: Omit<AdminUserBanDialogProps, "isBanned">) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function unbanUser() {
    setStatus(undefined);
    setIsSubmitting(true);

    try {
      const result = await authClient.admin.unbanUser({
        userId,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
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
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={CheckCircle2}>
          Unban
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unban user</AlertDialogTitle>
          <AlertDialogDescription>
            Restore account access for {userName}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>

          <Button disabled={isSubmitting} onClick={unbanUser} type="button">
            <CheckCircle2 data-icon="inline-start" />
            {isSubmitting ? "Unbanning..." : "Unban user"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserRoleUpdateDialog({
  className,
  currentRole,
  userId,
}: AdminUserRoleUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminUserRoleUpdateInput,
    undefined,
    AdminUserRoleUpdateValues
  >({
    resolver: zodResolver(adminUserRoleUpdateSchema),
    defaultValues: {
      roles: normalizeRoles(currentRole),
    },
  });
  const selectedRoles = form.watch("roles");

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({ roles: normalizeRoles(currentRole) });
    setStatus(undefined);
  }, [currentRole, form, open]);

  function setRoleChecked(role: (typeof authRoles)[number], checked: boolean) {
    if (role === "user") {
      return;
    }

    const currentRoles = form.getValues("roles");
    const nextRoles = checked
      ? Array.from(new Set([...currentRoles, role]))
      : currentRoles.filter((currentRole) => currentRole !== role);

    form.setValue("roles", nextRoles, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }

  async function onSubmit(values: AdminUserRoleUpdateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.setRole({
        userId,
        role: values.roles,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={Pencil}>
          Edit
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit roles</AlertDialogTitle>
            <AlertDialogDescription>
              Choose the roles assigned to this user.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2">
                {authRoles.map((role) => (
                  <Field
                    className="rounded-lg border p-3"
                    key={role}
                    orientation="horizontal"
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role)}
                      disabled={role === "user"}
                      id={`admin-user-role-${role}`}
                      onCheckedChange={(checked) =>
                        setRoleChecked(role, checked === true)
                      }
                    />
                    <FieldLabel htmlFor={`admin-user-role-${role}`}>
                      <FieldContent>
                        <FieldTitle>{formatRoleName(role)}</FieldTitle>
                      </FieldContent>
                    </FieldLabel>
                  </Field>
                ))}
              </div>

              {form.formState.errors.roles?.message ? (
                <FieldError>{form.formState.errors.roles.message}</FieldError>
              ) : null}
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save roles"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserEmailUpdateDialog({
  className,
  currentEmail,
  userId,
}: AdminUserEmailUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminUserEmailUpdateInput,
    undefined,
    AdminUserEmailUpdateValues
  >({
    resolver: zodResolver(adminUserEmailUpdateSchema),
    defaultValues: {
      email: currentEmail,
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({ email: currentEmail });
    setStatus(undefined);
  }, [currentEmail, form, open]);

  async function onSubmit(values: AdminUserEmailUpdateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.updateUser({
        userId,
        data: {
          email: values.email,
        },
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={Mail}>
          Update
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Update email</AlertDialogTitle>
            <AlertDialogDescription>
              Change this user's email address.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <EmailField
                error={form.formState.errors.email?.message}
                id="admin-user-email"
                required
                {...form.register("email")}
              />
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save email"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserImageUpdateDialog({
  className,
  currentImage,
  userId,
}: AdminUserImageUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminUserImageUpdateInput,
    undefined,
    AdminUserImageUpdateValues
  >({
    resolver: zodResolver(adminUserImageUpdateSchema),
    defaultValues: {
      image: currentImage ?? "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({ image: currentImage ?? "" });
    setStatus(undefined);
  }, [currentImage, form, open]);

  async function onSubmit(values: AdminUserImageUpdateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.updateUser({
        userId,
        data: {
          image: values.image,
        },
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={ImageIcon}>
          Update
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Update profile image</AlertDialogTitle>
            <AlertDialogDescription>
              Change or clear this user's profile image URL.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <AuthInputField
                error={form.formState.errors.image?.message}
                id="admin-user-image"
                label="Image URL"
                placeholder="https://example.com/avatar.png"
                type="url"
                {...form.register("image")}
              />
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save image"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserPasswordUpdateDialog({
  className,
  userId,
}: AdminUserPasswordUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const form = useForm<
    AdminUserPasswordUpdateInput,
    undefined,
    AdminUserPasswordUpdateValues
  >({
    resolver: zodResolver(adminUserPasswordUpdateSchema),
    defaultValues: {
      confirmPassword: "",
      newPassword: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      confirmPassword: "",
      newPassword: "",
    });
    setStatus(undefined);
  }, [form, open]);

  async function onSubmit(values: AdminUserPasswordUpdateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.setUserPassword({
        userId,
        newPassword: values.newPassword,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={KeyRound}>
          Update
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Update password</AlertDialogTitle>
            <AlertDialogDescription>
              Set a new password for this user.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-5">
            <FieldGroup>
              {status ? (
                <AuthStatusMessage tone={status.tone}>
                  {status.text}
                </AuthStatusMessage>
              ) : null}

              <PasswordField
                autoComplete="new-password"
                error={form.formState.errors.newPassword?.message}
                id="admin-user-new-password"
                label="New password"
                minLength={8}
                placeholder="New password"
                required
                {...form.register("newPassword")}
              />

              <PasswordField
                autoComplete="new-password"
                error={form.formState.errors.confirmPassword?.message}
                id="admin-user-confirm-password"
                label="Confirm password"
                minLength={8}
                placeholder="New password again"
                required
                {...form.register("confirmPassword")}
              />
            </FieldGroup>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={form.formState.isSubmitting}>
              Cancel
            </AlertDialogCancel>

            <Button disabled={form.formState.isSubmitting} type="submit">
              <Save data-icon="inline-start" />
              {form.formState.isSubmitting ? "Saving..." : "Save password"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function AdminUserPasswordResetDialog({
  className,
  currentEmail,
}: AdminUserEmailUpdateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isSending, setIsSending] = React.useState(false);

  async function sendLink() {
    setStatus(undefined);
    setIsSending(true);

    try {
      const result = await authClient.requestPasswordReset({
        email: currentEmail,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setStatus({
        text:
          result.data?.message ||
          "If this account can receive reset email, a link is on the way.",
        tone: "success",
      });
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <UpdateDialogButton className={className} icon={Mail}>
          Reset link
        </UpdateDialogButton>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Send password reset link</AlertDialogTitle>
          <AlertDialogDescription>
            Send a password reset link to {currentEmail}.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {status ? (
          <AuthStatusMessage className="text-left" tone={status.tone}>
            {status.text}
          </AuthStatusMessage>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSending}>Cancel</AlertDialogCancel>

          <Button disabled={isSending} onClick={sendLink} type="button">
            <Mail data-icon="inline-start" />
            {isSending ? "Sending..." : "Send reset link"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UpdateDialogButton({
  children,
  className,
  icon: Icon,
  ...props
}: React.ComponentProps<typeof Button> & {
  icon: LucideIcon;
}) {
  return (
    <Button
      className={cn("min-w-0 gap-2", className)}
      size="xs"
      type="button"
      variant="outline"
      {...props}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </Button>
  );
}
