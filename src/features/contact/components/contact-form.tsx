"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Send } from "lucide-react";
import * as React from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { AuthStatusMessage } from "@/features/auth/components";
import {
  AuthInputField,
  EmailField,
} from "@/features/auth/components/auth-fields";
import { api } from "@/shared/api/client";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  type ContactSubmissionInput,
  type ContactSubmissionValues,
  contactSubmissionSchema,
} from "@/shared/schemas";

function ContactForm() {
  const [statusMessage, setStatusMessage] = React.useState<{
    tone: "error" | "success";
    message: string;
  }>();
  const form = useForm<
    ContactSubmissionInput,
    undefined,
    ContactSubmissionValues
  >({
    resolver: zodResolver(contactSubmissionSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      message: "",
      website: "",
    },
  });
  const message = form.watch("message") ?? "";
  const messageLength = message.length;

  async function onSubmit(values: ContactSubmissionValues) {
    setStatusMessage(undefined);

    try {
      const result = await api.api.contact.post(values);

      if (result.error) {
        setStatusMessage({
          tone: "error",
          message:
            result.error.value && typeof result.error.value === "object"
              ? "message" in result.error.value &&
                typeof result.error.value.message === "string"
                ? result.error.value.message
                : "We could not send your message. Please try again."
              : "We could not send your message. Please try again.",
        });
        return;
      }

      form.reset();
      setStatusMessage({
        tone: "success",
        message: "Thanks, your message has been received.",
      });
    } catch {
      setStatusMessage({
        tone: "error",
        message: "We could not send your message. Please try again.",
      });
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup>
        {statusMessage ? (
          <AuthStatusMessage tone={statusMessage.tone}>
            {statusMessage.message}
          </AuthStatusMessage>
        ) : null}
        <AuthInputField
          autoComplete="name"
          className="contact-entry-4m9q"
          error={form.formState.errors.name?.message}
          id="name"
          label="Name"
          placeholder="Jane Appleseed"
          required
          {...form.register("name")}
        />
        <EmailField
          className="contact-entry-v2r8"
          error={form.formState.errors.email?.message}
          id="email"
          placeholder="you@company.com"
          required
          {...form.register("email")}
        />
        <AuthInputField
          autoComplete="organization"
          className="contact-entry-p7x1"
          error={form.formState.errors.company?.message}
          id="company"
          label="Company (optional)"
          placeholder="Acme Studio"
          {...form.register("company")}
        />
        <Field data-invalid={Boolean(form.formState.errors.message)}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="message">Message</FieldLabel>
            <span className="text-muted-foreground text-xs tabular-nums">
              {messageLength}/{CONTACT_MESSAGE_MAX_LENGTH}
            </span>
          </div>
          <Textarea
            aria-describedby="message-description"
            aria-invalid={Boolean(form.formState.errors.message) || undefined}
            className="contact-entry-k6t3 min-h-36 resize-y"
            id="message"
            maxLength={CONTACT_MESSAGE_MAX_LENGTH}
            placeholder="Tell me what you are building, where you are stuck, or what you would like to discuss."
            required
            {...form.register("message")}
          />
          <FieldDescription id="message-description">
            Share enough context to make the first reply useful.
          </FieldDescription>
          {form.formState.errors.message ? (
            <FieldError>{form.formState.errors.message.message}</FieldError>
          ) : null}
        </Field>
        <input
          aria-hidden="true"
          autoComplete="off"
          className="contact-entry-r8n4"
          tabIndex={-1}
          {...form.register("website")}
        />
      </FieldGroup>
      <Button
        className="w-full"
        disabled={form.formState.isSubmitting}
        type="submit"
      >
        {form.formState.isSubmitting ? "Sending..." : "Send message"}
        <Send data-icon="inline-end" />
      </Button>
    </form>
  );
}

export { ContactForm };
