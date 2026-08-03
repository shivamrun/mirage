import { env } from "@/lib/env";
import { WelcomeEmailTemplate } from "@/server/email/templates/welcome-email";

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
    subject: "Welcome to Grove",
    tags: [
      {
        name: "category",
        value: "welcome",
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      "Welcome to Grove. Please verify your email address to keep your account secure.",
      `Open Grove: ${appUrl}`,
    ].join("\n\n"),
    to: email,
  });
}
