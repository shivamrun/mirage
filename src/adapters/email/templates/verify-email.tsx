import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components";
import { EmailRawLink } from "../components/email-raw-link";

type VerifyEmailTemplateProps = {
  actionLabel?: string;
  heading?: string;
  intro?: string;
  name?: string | null;
  verificationUrl: string;
};

function VerifyEmailTemplate({
  actionLabel = "Verify email",
  heading = "Verify your email",
  intro = "Confirm this email address so we can keep your Mirage account secure.",
  name,
  verificationUrl,
}: VerifyEmailTemplateProps) {
  return (
    <EmailLayout
      previewText="Confirm your Mirage email address."
      title={heading}
      description={intro}
    >
      <EmailText className="mb-0">
        Hi {name || "there"}, use the button below to verify your email address.
      </EmailText>

      <EmailButton href={verificationUrl}>{actionLabel}</EmailButton>

      <EmailText className="mb-0">
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <EmailRawLink href={verificationUrl} />
      </EmailText>
    </EmailLayout>
  );
}

VerifyEmailTemplate.PreviewProps = {
  actionLabel: "Verify email",
  heading: "Verify your email",
  intro:
    "Confirm this email address so we can keep your Mirage account secure.",
  name: "Shivam",
  verificationUrl:
    "https://example.com/verify-email?token=example-verification-token",
} satisfies VerifyEmailTemplateProps;

export default VerifyEmailTemplate;
