import { Resend } from "resend";

import { getEmailConfig } from "./config";
import { EmailConfigurationError } from "./errors";

let resendClient: Resend | null = null;

export function getResendClient() {
  const { apiKey } = getEmailConfig();

  if (!apiKey) {
    throw new EmailConfigurationError("Missing RESEND_API_KEY.");
  }

  resendClient ??= new Resend(apiKey);

  return resendClient;
}
