import { EmailListVerificationTemplate } from "@/server/email/templates/email-list-verification";

import { sendEmail } from "../send-email";

type SendEmailListVerificationEmailOptions = {
  email: string;
  listKey: string;
  listName: string;
  verificationUrl: string;
};

export function sendEmailListVerificationEmail({
  email,
  listKey,
  listName,
  verificationUrl,
}: SendEmailListVerificationEmailOptions) {
  return sendEmail({
    react: (
      <EmailListVerificationTemplate
        listName={listName}
        verificationUrl={verificationUrl}
      />
    ),
    subject: `Confirm your ${listName} signup`,
    tags: [
      {
        name: "category",
        value: "email-list-verification",
      },
      {
        name: "list",
        value: listKey,
      },
    ],
    text: [
      "Hi there,",
      `Confirm this email address to finish joining ${listName}.`,
      `Confirm signup: ${verificationUrl}`,
    ].join("\n\n"),
    to: email,
  });
}
