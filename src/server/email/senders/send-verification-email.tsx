import { VerifyEmailTemplate } from "@/server/email/templates/verify-email";

import { sendEmail } from "../send-email";

type SendVerificationEmailOptions = {
  actionLabel?: string;
  email: string;
  heading?: string;
  intro?: string;
  name?: string | null;
  verificationUrl: string;
};

export function sendVerificationEmail({
  actionLabel,
  email,
  heading,
  intro,
  name,
  verificationUrl,
}: SendVerificationEmailOptions) {
  return sendEmail({
    react: (
      <VerifyEmailTemplate
        actionLabel={actionLabel}
        heading={heading}
        intro={intro}
        name={name}
        verificationUrl={verificationUrl}
      />
    ),
    subject: heading ?? "Verify your Mirage email",
    tags: [
      {
        name: "category",
        value: "email-verification",
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      intro ||
        "Confirm this email address so we can keep your Mirage account secure.",
      `${actionLabel ?? "Verify email"}: ${verificationUrl}`,
    ].join("\n\n"),
    to: email,
  });
}
