import type { sendEmail } from "@/adapters/email/send-email";

type EmailOptions = Parameters<typeof sendEmail>[0];

export const testEmailOutbox: EmailOptions[] = [];
let deliveryHook: ((options: EmailOptions) => Promise<void>) | null = null;

export function setTestEmailDeliveryHook(hook: typeof deliveryHook) {
  deliveryHook = hook;
}

export async function sendTestEmail(options: EmailOptions) {
  await deliveryHook?.(options);
  testEmailOutbox.push(options);
  return {
    id: `test-email-${testEmailOutbox.length}`,
    skipped: false,
  } as const;
}
