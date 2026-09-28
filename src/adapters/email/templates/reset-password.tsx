import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components";
import { EmailRawLink } from "../components/email-raw-link";

type ResetPasswordTemplateProps = {
  name?: string | null;
  resetUrl: string;
};

function ResetPasswordTemplate({ name, resetUrl }: ResetPasswordTemplateProps) {
  return (
    <EmailLayout
      previewText="Reset your Mirage password."
      title="Reset your password"
      description="We received a request to reset the password for your Mirage account."
    >
      <EmailText className="mb-0">
        Hi {name || "there"}, use the button below to choose a new password.
      </EmailText>

      <EmailButton href={resetUrl}>Reset password</EmailButton>

      <EmailText>
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <EmailRawLink href={resetUrl} />
      </EmailText>

      <EmailText className="mb-0">
        If you didn&apos;t request this, you don&apos;t need to do anything.
        Your password hasn&apos;t been changed.
      </EmailText>
    </EmailLayout>
  );
}

ResetPasswordTemplate.PreviewProps = {
  name: "Shivam",
  resetUrl: "https://example.com/reset-password?token=example-reset-token",
} satisfies ResetPasswordTemplateProps;

export default ResetPasswordTemplate;
