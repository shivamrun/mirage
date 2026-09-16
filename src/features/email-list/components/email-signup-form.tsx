"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AuthStatusMessage } from "@/features/auth/components";
import { EmailField } from "@/features/auth/components/auth-fields";
import {
  captureBrowserAttribution,
  hasAttribution,
} from "@/features/email-list/attribution";
import { api } from "@/shared/api/client";
import {
  type EmailSubscriptionInput,
  type EmailSubscriptionValues,
  emailSubscriptionSchema,
} from "@/shared/schemas";

type EmailSignupFormProps = {
  inputId?: string;
  listKey: string;
  source?: string;
  submitLabel?: string;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "value" in error) {
    const value = error.value;

    if (value && typeof value === "object" && "message" in value) {
      return typeof value.message === "string"
        ? value.message
        : "We could not save your email. Please try again.";
    }
  }

  return "We could not save your email. Please try again.";
}

function isVerificationRequiredResponse(
  data: unknown,
): data is { verificationRequired: true } {
  return (
    data !== null &&
    typeof data === "object" &&
    "verificationRequired" in data &&
    data.verificationRequired === true
  );
}

function getSignupMetadata(): EmailSubscriptionValues["metadata"] {
  const attribution = captureBrowserAttribution();
  if (!hasAttribution(attribution)) return null;

  return {
    landing_path: attribution.landingPath ?? undefined,
    referrer: attribution.referrer ?? undefined,
    utm_campaign: attribution.utmCampaign ?? undefined,
    utm_content: attribution.utmContent ?? undefined,
    utm_medium: attribution.utmMedium ?? undefined,
    utm_source: attribution.utmSource ?? undefined,
    utm_term: attribution.utmTerm ?? undefined,
  };
}

function EmailSignupForm({
  inputId,
  listKey,
  source = "home",
  submitLabel = "Join list",
}: EmailSignupFormProps) {
  const generatedId = React.useId();
  const emailInputId = inputId ?? `${generatedId}-email`;
  const [statusMessage, setStatusMessage] = React.useState<{
    tone: "error" | "success";
    message: string;
  }>();
  const form = useForm<
    EmailSubscriptionInput,
    undefined,
    EmailSubscriptionValues
  >({
    resolver: zodResolver(emailSubscriptionSchema),
    defaultValues: {
      email: "",
      listKey,
      source,
      website: "",
    },
  });

  async function onSubmit(values: EmailSubscriptionValues) {
    setStatusMessage(undefined);

    try {
      const result = await api.api["email-list"].post({
        ...values,
        metadata: getSignupMetadata(),
      });

      if (result.error) {
        setStatusMessage({
          tone: "error",
          message: getErrorMessage(result.error),
        });
        return;
      }

      form.reset({
        email: "",
        listKey,
        source,
        website: "",
      });
      setStatusMessage({
        tone: "success",
        message: isVerificationRequiredResponse(result.data)
          ? "Check your email to confirm your signup."
          : "You are on the list. We will be in touch soon.",
      });
    } catch {
      setStatusMessage({
        tone: "error",
        message: "We could not save your email. Please try again.",
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {statusMessage ? (
        <AuthStatusMessage tone={statusMessage.tone}>
          {statusMessage.message}
        </AuthStatusMessage>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <EmailField
          error={form.formState.errors.email?.message}
          id={emailInputId}
          label="Email"
          placeholder="you@company.com"
          required
          {...form.register("email")}
        />
        <Button
          className="self-end"
          disabled={form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting ? "Joining..." : submitLabel}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
      <input
        aria-hidden="true"
        autoComplete="off"
        className="contact-entry-r8n4"
        tabIndex={-1}
        {...form.register("website")}
      />
      <input type="hidden" {...form.register("listKey")} />
      <input type="hidden" {...form.register("source")} />
    </form>
  );
}

export { EmailSignupForm };
