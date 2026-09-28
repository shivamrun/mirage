import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components";
import { EmailRawLink } from "../components/email-raw-link";

type EmailListVerificationTemplateProps = {
  listName: string;
  verificationUrl: string;
};

function EmailListVerificationTemplate({
  listName,
  verificationUrl,
}: EmailListVerificationTemplateProps) {
  return (
    <EmailLayout
      previewText={`Confirm your ${listName} signup.`}
      title={`Join ${listName}`}
      description={`Confirm your email address to finish joining ${listName}.`}
    >
      <EmailText className="mb-0">
        You&apos;re almost done. Confirm your signup using the button below.
      </EmailText>

      <EmailButton href={verificationUrl}>Confirm signup</EmailButton>

      <EmailText className="mb-0">
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <EmailRawLink href={verificationUrl} />
      </EmailText>
    </EmailLayout>
  );
}

EmailListVerificationTemplate.PreviewProps = {
  listName: "Mirage Updates",
  verificationUrl:
    "https://example.com/email-list/verify?token=example-verification-token",
} satisfies EmailListVerificationTemplateProps;

export default EmailListVerificationTemplate;
