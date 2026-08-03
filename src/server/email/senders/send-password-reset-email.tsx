import { ResetPasswordTemplate } from "@/server/email/templates/reset-password";

import { sendEmail } from "../send-email";

type SendPasswordResetEmailOptions = {
  email: string;
  name?: string | null;
  resetUrl: string;
};

export function sendPasswordResetEmail({
  email,
  name,
  resetUrl,
}: SendPasswordResetEmailOptions) {
  return sendEmail({
    react: <ResetPasswordTemplate name={name} resetUrl={resetUrl} />,
    subject: "Reset your Grove password",
    tags: [
      {
        name: "category",
        value: "password-reset",
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      "We received a request to reset your Grove password. Use the link below to choose a new one.",
      `Reset password: ${resetUrl}`,
      "If you did not request a password reset, no changes have been made.",
    ].join("\n\n"),
    to: email,
  });
}
