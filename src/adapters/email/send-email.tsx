import type { ReactElement } from "react";
import type { CreateEmailOptions } from "resend";

import { getResendClient } from "./client";
import { getEmailConfig } from "./config";
import { EmailConfigurationError, EmailDeliveryError } from "./errors";

type SendEmailOptions = {
  idempotencyKey?: string;
  react: ReactElement;
  subject: string;
  text: string;
  to: string | string[];
} & Pick<CreateEmailOptions, "replyTo" | "tags">;

export type SendEmailResult =
  | {
      id: string;
      skipped: false;
    }
  | {
      id: null;
      skipped: true;
    };

function getProviderErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message) {
      return message;
    }
  }

  return "Resend could not deliver the email.";
}

export async function sendEmail({
  idempotencyKey,
  react,
  replyTo,
  subject,
  tags,
  text,
  to,
}: SendEmailOptions): Promise<SendEmailResult> {
  const config = getEmailConfig();

  if (!config.enabled) {
    console.info(
      [
        `Email delivery skipped for ${Array.isArray(to) ? to.join(", ") : to}: ${subject}`,
        text,
      ].join("\n\n"),
    );

    return {
      id: null,
      skipped: true,
    };
  }

  if (!config.from) {
    throw new EmailConfigurationError("Missing EMAIL_FROM.");
  }

  const response = await getResendClient().emails.send(
    {
      from: config.from,
      react,
      replyTo: replyTo ?? config.replyTo,
      subject,
      tags,
      text,
      to,
    },
    idempotencyKey ? { idempotencyKey } : undefined,
  );

  if (response.error) {
    throw new EmailDeliveryError(
      getProviderErrorMessage(response.error),
      response.error,
    );
  }

  if (!response.data?.id) {
    throw new EmailDeliveryError("Resend did not return an email id.");
  }

  return {
    id: response.data.id,
    skipped: false,
  };
}
