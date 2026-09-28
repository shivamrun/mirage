import {
  EmailLayout,
  EmailText,
} from "@/adapters/email/components/email-layout";
import { sendEmail } from "@/adapters/email/send-email";
import { EmailListVerificationTemplate } from "@/adapters/email/templates/email-list-verification";
import { ResetPasswordTemplate } from "@/adapters/email/templates/reset-password";
import { VerifyEmailTemplate } from "@/adapters/email/templates/verify-email";
import { WelcomeEmailTemplate } from "@/adapters/email/templates/welcome-email";
import { env } from "@/shared/env";

import type { NotificationPayloadMap } from "../../domain/types";
import type { NotificationChannelHandler } from "../types";

type EmailNotificationType =
  | "account.two_factor_email_code"
  | "auth.email_verification"
  | "auth.password_reset"
  | "auth.welcome"
  | "email_list.verification";

function assertNever(type: never): never {
  throw new Error(`Unsupported email notification type: ${type}`);
}

export const emailNotificationChannel = {
  channel: "email",
  async deliver(input) {
    switch (input.type as EmailNotificationType) {
      case "account.two_factor_email_code": {
        const data =
          input.data as NotificationPayloadMap["account.two_factor_email_code"];
        const isDisabling = data.action === "disable";
        const heading = isDisabling
          ? "Confirm disabling two-factor authentication"
          : "Confirm two-factor setup";
        const intro = isDisabling
          ? "Use this code to disable authenticator app sign-in for your Mirage account."
          : "Use this code to continue setting up authenticator app sign-in for your Mirage account.";

        return {
          email: await sendEmail({
            react: (
              <EmailLayout
                previewText="Use this code to confirm your two-factor authentication change."
                title={heading}
              >
                <EmailText>Hi {data.name || "there"},</EmailText>
                <EmailText>{intro}</EmailText>
                <EmailText>
                  Your code is: <strong>{data.code}</strong>
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
              `Hi ${data.name || "there"},`,
              intro,
              `Your code is: ${data.code}`,
              "This code expires in 10 minutes.",
            ].join("\n\n"),
            to: data.email,
          }),
        };
      }
      case "auth.email_verification": {
        const data =
          input.data as NotificationPayloadMap["auth.email_verification"];

        return {
          email: await sendEmail({
            react: (
              <VerifyEmailTemplate
                actionLabel={data.actionLabel}
                heading={data.heading}
                intro={data.intro}
                name={data.name}
                verificationUrl={data.verificationUrl}
              />
            ),
            subject: data.heading ?? "Verify your Mirage email",
            tags: [
              {
                name: "category",
                value: "email-verification",
              },
            ],
            text: [
              `Hi ${data.name || "there"},`,
              data.intro ||
                "Confirm this email address so we can keep your Mirage account secure.",
              `${data.actionLabel ?? "Verify email"}: ${data.verificationUrl}`,
            ].join("\n\n"),
            to: data.email,
          }),
        };
      }
      case "auth.password_reset": {
        const data =
          input.data as NotificationPayloadMap["auth.password_reset"];

        return {
          email: await sendEmail({
            react: (
              <ResetPasswordTemplate
                name={data.name}
                resetUrl={data.resetUrl}
              />
            ),
            subject: "Reset your Mirage password",
            tags: [
              {
                name: "category",
                value: "password-reset",
              },
            ],
            text: [
              `Hi ${data.name || "there"},`,
              "We received a request to reset your Mirage password. Use the link below to choose a new one.",
              `Reset password: ${data.resetUrl}`,
              "If you did not request a password reset, no changes have been made.",
            ].join("\n\n"),
            to: data.email,
          }),
        };
      }
      case "auth.welcome": {
        const data = input.data as NotificationPayloadMap["auth.welcome"];
        const appUrl = data.appUrl ?? env.NEXT_PUBLIC_BASE_URL;

        return {
          email: await sendEmail({
            react: <WelcomeEmailTemplate appUrl={appUrl} name={data.name} />,
            subject: "Welcome to Mirage",
            tags: [
              {
                name: "category",
                value: "welcome",
              },
            ],
            text: [
              `Hi ${data.name || "there"},`,
              "Welcome to Mirage. Please verify your email address to keep your account secure.",
              `Open Mirage: ${appUrl}`,
            ].join("\n\n"),
            to: data.email,
          }),
        };
      }
      case "email_list.verification": {
        const data =
          input.data as NotificationPayloadMap["email_list.verification"];

        return {
          email: await sendEmail({
            react: (
              <EmailListVerificationTemplate
                listName={data.listName}
                verificationUrl={data.verificationUrl}
              />
            ),
            subject: `Confirm your ${data.listName} signup`,
            tags: [
              {
                name: "category",
                value: "email-list-verification",
              },
              {
                name: "list",
                value: data.listKey,
              },
            ],
            text: [
              "Hi there,",
              `Confirm this email address to finish joining ${data.listName}.`,
              `Confirm signup: ${data.verificationUrl}`,
            ].join("\n\n"),
            to: data.email,
          }),
        };
      }
      default:
        assertNever(input.type as never);
    }
  },
} satisfies NotificationChannelHandler;
