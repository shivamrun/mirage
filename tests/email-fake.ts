import type { sendEmail } from "@/server/email/send-email";

type EmailOptions = Parameters<typeof sendEmail>[0];

export const testEmailOutbox: EmailOptions[] = [];

export async function sendTestEmail(options: EmailOptions) {
  testEmailOutbox.push(options);
  return {
    id: `test-email-${testEmailOutbox.length}`,
    skipped: false,
  } as const;
}
