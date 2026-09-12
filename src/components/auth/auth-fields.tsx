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
  labelSrOnly?: boolean;
  description?: React.ReactNode;
  error?: React.ReactNode;
  type?: React.HTMLInputTypeAttribute;
};

function AuthInputField({
  id,
  label,
  labelSrOnly = false,
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
      <FieldLabel className={cn(labelSrOnly && "sr-only")} htmlFor={inputId}>
        {label}
      </FieldLabel>
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

type AuthOtpFieldProps = Omit<
  React.ComponentProps<"input">,
  "className" | "maxLength" | "minLength" | "onChange" | "type" | "value"
> & {
  label: string;
  labelSrOnly?: boolean;
  value: string;
  onChange: (value: string) => void;
  description?: React.ReactNode;
  error?: React.ReactNode;
  length?: number;
};

function AuthOtpField({
  id,
  label,
  labelSrOnly = false,
  value,
  onChange,
  description,
  error,
  length = 6,
  disabled,
  required,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  onBlur,
  onFocus,
  ...props
}: AuthOtpFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const invalid =
    Boolean(error) || ariaInvalid === true || ariaInvalid === "true";
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy =
    [ariaDescribedBy, descriptionId, errorId].filter(Boolean).join(" ") ||
    undefined;
  const inputsRef = React.useRef<Array<HTMLInputElement | null>>([]);
  const normalizedValue = value.replace(/\D/g, "").slice(0, length);
  const digits = Array.from(
    { length },
    (_, index) => normalizedValue[index] ?? "",
  );
  const splitAt = Math.ceil(length / 2);

  function commit(nextDigits: string[], focusIndex?: number) {
    onChange(nextDigits.join("").replace(/\D/g, "").slice(0, length));

    if (typeof focusIndex === "number") {
      window.requestAnimationFrame(() => {
        inputsRef.current[
          Math.min(Math.max(focusIndex, 0), length - 1)
        ]?.focus();
      });
    }
  }

  function handleChange(index: number, nextValue: string) {
    const nextNumbers = nextValue.replace(/\D/g, "");

    if (!nextNumbers) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      commit(nextDigits);
      return;
    }

    const nextDigits = [...digits];
    for (let offset = 0; offset < nextNumbers.length; offset += 1) {
      const targetIndex = index + offset;

      if (targetIndex >= length) {
        break;
      }

      nextDigits[targetIndex] = nextNumbers[offset];
    }

    commit(nextDigits, Math.min(index + nextNumbers.length, length - 1));
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();

      const nextDigits = [...digits];
      nextDigits[index - 1] = "";
      commit(nextDigits, index - 1);
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) {
    const pastedDigits = event.clipboardData.getData("text").replace(/\D/g, "");

    if (!pastedDigits) {
      return;
    }

    event.preventDefault();
    handleChange(index, pastedDigits);
  }

  function renderDigitInput(index: number) {
    return (
      <input
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        aria-label={`${label} digit ${index + 1}`}
        autoComplete={index === 0 ? "one-time-code" : "off"}
        disabled={disabled}
        id={index === 0 ? inputId : undefined}
        inputMode="numeric"
        key={index}
        maxLength={1}
        onBlur={onBlur}
        onChange={(event) => handleChange(index, event.target.value)}
        onFocus={(event) => {
          event.target.select();
          onFocus?.(event);
        }}
        onKeyDown={(event) => handleKeyDown(index, event)}
        onPaste={(event) => handlePaste(index, event)}
        pattern="[0-9]*"
        ref={(input) => {
          inputsRef.current[index] = input;
        }}
        required={required}
        type="text"
        value={digits[index]}
        className="h-12 w-10 border-input border-r bg-transparent text-center font-mono text-lg tabular-nums outline-none transition-colors placeholder:text-muted-foreground focus-visible:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50 last:border-r-0 sm:h-14 sm:w-12 sm:text-xl"
        {...props}
      />
    );
  }

  const segmentClassName = cn(
    "flex overflow-hidden rounded-xl border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
    invalid &&
      "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
  );

  return (
    <Field data-invalid={invalid}>
      <FieldLabel className={cn(labelSrOnly && "sr-only")} htmlFor={inputId}>
        {label}
      </FieldLabel>
      <fieldset
        className="flex w-full items-center justify-center gap-2.5 sm:gap-3"
        aria-describedby={describedBy}
      >
        <legend className="sr-only">{label}</legend>
        <div className={segmentClassName}>
          {digits.slice(0, splitAt).map((_, index) => renderDigitInput(index))}
        </div>
        <span
          aria-hidden="true"
          className="h-0.5 w-5 shrink-0 rounded-full bg-muted-foreground/70 sm:w-6"
        />
        <div className={segmentClassName}>
          {digits
            .slice(splitAt)
            .map((_, index) => renderDigitInput(index + splitAt))}
        </div>
      </fieldset>
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
  labelSrOnly = false,
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
      <FieldLabel className={cn(labelSrOnly && "sr-only")} htmlFor={inputId}>
        {label}
      </FieldLabel>
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

export { AuthInputField, AuthOtpField, EmailField, NameField, PasswordField };
