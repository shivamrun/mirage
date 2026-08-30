import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/server/email/components/email-layout";

type ResetPasswordTemplateProps = {
  name?: string | null;
  resetUrl: string;
};

export function ResetPasswordTemplate({
  name,
  resetUrl,
}: ResetPasswordTemplateProps) {
  return (
    <EmailLayout
      previewText="Reset your Mirage password."
      title="Reset your password"
    >
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>
        We received a request to reset your Mirage password. Use the link below
        to choose a new one.
      </EmailText>
      <EmailButton href={resetUrl}>Reset password</EmailButton>
      <EmailText>
        If you did not request a password reset, no changes have been made.
      </EmailText>
      <EmailText>
        If the button does not work, paste this link into your browser:
        <br />
        <a href={resetUrl}>{resetUrl}</a>
      </EmailText>
    </EmailLayout>
  );
}
