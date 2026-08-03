import { env } from "@/lib/env";

import { EmailConfigurationError } from "./errors";

const providerName = "resend" as const;

export type EmailConfig = {
  apiKey: string | undefined;
  enabled: boolean;
  from: string | undefined;
  provider: typeof providerName;
  replyTo: string | undefined;
};

export function getEmailConfig(): EmailConfig {
  const config = {
    apiKey: env.RESEND_API_KEY,
    enabled: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
    from: env.EMAIL_FROM,
    provider: providerName,
    replyTo: env.EMAIL_REPLY_TO,
  };

  if (env.NODE_ENV === "production" && !config.enabled) {
    throw new EmailConfigurationError(
      "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    );
  }

  return config;
}
