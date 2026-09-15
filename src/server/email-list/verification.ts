import { randomBytes } from "node:crypto";

import { z } from "zod";

export const EMAIL_LIST_VERIFICATION_PREFIX = "email-list";
export const EMAIL_LIST_VERIFICATION_EXPIRES_IN_MS = 1000 * 60 * 60 * 24;

const EMAIL_LIST_VERIFICATION_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export const emailListVerificationPayloadSchema = z.object({
  email: z.string(),
  listKey: z.string(),
  subscriptionId: z.string(),
  token: z.string(),
});

export type EmailListVerificationPayload = z.infer<
  typeof emailListVerificationPayloadSchema
>;

export function createEmailListVerificationToken() {
  return randomBytes(32).toString("hex");
}

export function isValidEmailListVerificationToken(token: string) {
  return EMAIL_LIST_VERIFICATION_TOKEN_PATTERN.test(token);
}

export function getEmailListVerificationIdentifier(token: string) {
  return `${EMAIL_LIST_VERIFICATION_PREFIX}:${token}`;
}

export function parseEmailListVerificationPayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return emailListVerificationPayloadSchema.parse(JSON.parse(value));
  } catch {
    return null;
  }
}
