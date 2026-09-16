import { WelcomeEmailTemplate } from "@/adapters/email/templates/welcome-email";
import { env } from "@/shared/env";

import { sendEmail } from "../send-email";

type SendWelcomeEmailOptions = {
  appUrl?: string;
  email: string;
  name?: string | null;
};

export function sendWelcomeEmail({
  appUrl = env.NEXT_PUBLIC_BASE_URL,
  email,
  name,
}: SendWelcomeEmailOptions) {
  return sendEmail({
    react: <WelcomeEmailTemplate appUrl={appUrl} name={name} />,
    subject: "Welcome to Mirage",
    tags: [
      {
        name: "category",
        value: "welcome",
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      "Welcome to Mirage. Please verify your email address to keep your account secure.",
      `Open Mirage: ${appUrl}`,
    ].join("\n\n"),
    to: email,
  });
}
