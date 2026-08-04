"use client";

import { Eye, EyeOff } from "lucide-react";
import * as React from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

type AuthInputFieldProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  "type"
> & {
  label: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
};

function AuthInputField({
  id,
  label,
  description,
  error,
  type = "text",
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: AuthInputFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const invalid =
    Boolean(error) || ariaInvalid === true || ariaInvalid === "true";
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          type={type}
          className={className}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...props}
        />
      </InputGroup>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

type EmailFieldProps = Omit<AuthInputFieldProps, "label" | "type"> & {
  label?: string;
};

function EmailField({ label = "Email", ...props }: EmailFieldProps) {
  return (
    <AuthInputField
      autoCapitalize="none"
      autoComplete="email"
      autoCorrect="off"
      inputMode="email"
      label={label}
      placeholder="name@example.com"
      type="email"
      {...props}
    />
  );
}

type NameFieldProps = Omit<AuthInputFieldProps, "label" | "type"> & {
  label?: string;
};

function NameField({ label = "Name", ...props }: NameFieldProps) {
  return (
    <AuthInputField
      autoComplete="name"
      label={label}
      placeholder="Jane Appleseed"
      type="text"
      {...props}
    />
  );
}

type PasswordFieldProps = Omit<AuthInputFieldProps, "label" | "type"> & {
  label?: string;
};

function PasswordField({
  id,
  label = "Password",
  description,
  error,
  className,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  autoComplete = "current-password",
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const invalid =
    Boolean(error) || ariaInvalid === true || ariaInvalid === "true";
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          className={cn("pr-0", className)}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={isVisible ? "Hide password" : "Show password"}
            aria-pressed={isVisible}
            size="icon-xs"
            onClick={() => setIsVisible((current) => !current)}
          >
            {isVisible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

export { AuthInputField, EmailField, NameField, PasswordField };
