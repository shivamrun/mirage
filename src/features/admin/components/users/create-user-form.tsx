"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { authClient } from "@/features/auth/client";
import {
  AuthInputField,
  AuthStatusMessage,
  EmailField,
  PasswordField,
} from "@/features/auth/components";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { type AuthRole, authRoles } from "@/features/auth/roles";
import {
  type AdminUserCreateInput,
  type AdminUserCreateValues,
  adminUserCreateSchema,
} from "@/shared/schemas";

import { formatRoleName } from "../shared/user-display";

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

function normalizeCreateRoles(roles: AuthRole[]) {
  return Array.from(new Set<AuthRole>(["user", ...roles]));
}

export function AdminUserCreateForm() {
  const router = useRouter();
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isRedirecting, setIsRedirecting] = React.useState(false);
  const form = useForm<AdminUserCreateInput, undefined, AdminUserCreateValues>({
    resolver: zodResolver(adminUserCreateSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
      roles: ["user"],
    },
  });

  async function onSubmit(values: AdminUserCreateValues) {
    setStatus(undefined);

    try {
      const result = await authClient.admin.createUser({
        email: values.email,
        password: values.password,
        name: values.name,
        role: normalizeCreateRoles(values.roles),
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setIsRedirecting(true);
      router.push(`/admin/users/${result.data.user.id}`);
      router.refresh();
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    }
  }

  return (
    <FormProvider {...form}>
      <form
        className="flex w-full max-w-2xl flex-col gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          {status ? (
            <AuthStatusMessage className="text-left" tone={status.tone}>
              {status.text}
            </AuthStatusMessage>
          ) : null}

          <AuthInputField
            autoComplete="name"
            error={form.formState.errors.name?.message}
            id="admin-create-user-name"
            label="Name"
            placeholder="Jane Appleseed"
            required
            {...form.register("name")}
          />

          <EmailField
            error={form.formState.errors.email?.message}
            id="admin-create-user-email"
            required
            {...form.register("email")}
          />

          <PasswordField
            autoComplete="new-password"
            description="Use at least 8 characters."
            error={form.formState.errors.password?.message}
            id="admin-create-user-password"
            minLength={8}
            placeholder="Create a password"
            required
            {...form.register("password")}
          />

          <Controller
            control={form.control}
            name="roles"
            render={({ field, fieldState }) => {
              const selectedRoles = normalizeCreateRoles(field.value);
              const errorId = fieldState.error
                ? "admin-create-user-roles-error"
                : undefined;

              function setRoleChecked(role: AuthRole, checked: boolean) {
                if (role === "user") {
                  return;
                }

                const nextRoles = checked
                  ? Array.from(new Set([...selectedRoles, role]))
                  : selectedRoles.filter(
                      (selectedRole) => selectedRole !== role,
                    );

                field.onChange(normalizeCreateRoles(nextRoles));
              }

              return (
                <FieldSet>
                  <FieldLabel asChild>
                    <legend>Roles</legend>
                  </FieldLabel>
                  <FieldDescription>
                    Choose every role this account should receive.
                  </FieldDescription>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {authRoles.map((role) => (
                      <Field
                        className="rounded-lg border p-3"
                        data-invalid={fieldState.invalid}
                        key={role}
                        orientation="horizontal"
                      >
                        <Checkbox
                          aria-describedby={errorId}
                          aria-invalid={fieldState.invalid || undefined}
                          checked={selectedRoles.includes(role)}
                          disabled={role === "user"}
                          id={`admin-create-user-role-${role}`}
                          onBlur={field.onBlur}
                          onCheckedChange={(checked) =>
                            setRoleChecked(role, checked === true)
                          }
                        />
                        <FieldLabel htmlFor={`admin-create-user-role-${role}`}>
                          <FieldContent>
                            <FieldTitle>{formatRoleName(role)}</FieldTitle>
                          </FieldContent>
                        </FieldLabel>
                      </Field>
                    ))}
                  </div>

                  {fieldState.error?.message ? (
                    <FieldError id={errorId}>
                      {fieldState.error.message}
                    </FieldError>
                  ) : null}
                </FieldSet>
              );
            }}
          />
        </FieldGroup>

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            disabled={form.formState.isSubmitting || isRedirecting}
            type="submit"
          >
            <Save data-icon="inline-start" />
            {isRedirecting
              ? "Opening user..."
              : form.formState.isSubmitting
                ? "Creating..."
                : "Create user"}
          </Button>
          <Button
            disabled={form.formState.isSubmitting || isRedirecting}
            onClick={() => router.push("/admin/users")}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
