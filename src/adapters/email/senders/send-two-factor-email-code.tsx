import {
  EmailLayout,
  EmailText,
} from "@/adapters/email/components/email-layout";

import { sendEmail } from "../send-email";

type SendTwoFactorEmailCodeOptions = {
  action: "enable" | "disable";
  code: string;
  email: string;
  name?: string | null;
};

export function sendTwoFactorEmailCode({
  action,
  code,
  email,
  name,
}: SendTwoFactorEmailCodeOptions) {
  const isDisabling = action === "disable";
  const heading = isDisabling
    ? "Confirm disabling two-factor authentication"
    : "Confirm two-factor setup";
  const intro = isDisabling
    ? "Use this code to disable authenticator app sign-in for your Mirage account."
    : "Use this code to continue setting up authenticator app sign-in for your Mirage account.";

  return sendEmail({
    react: (
      <EmailLayout
        previewText="Use this code to confirm your two-factor authentication change."
        title={heading}
      >
        <EmailText>Hi {name || "there"},</EmailText>
        <EmailText>{intro}</EmailText>
        <EmailText>
          Your code is: <strong>{code}</strong>
        </EmailText>
        <EmailText>This code expires in 10 minutes.</EmailText>
      </EmailLayout>
    ),
    subject: heading,
    tags: [
      {
        name: "category",
        value: "two-factor-authentication",
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      intro,
      `Your code is: ${code}`,
      "This code expires in 10 minutes.",
    ].join("\n\n"),
    to: email,
  });
}
