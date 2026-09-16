import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components/email-layout";

type EmailListVerificationTemplateProps = {
  listName: string;
  verificationUrl: string;
};

export function EmailListVerificationTemplate({
  listName,
  verificationUrl,
}: EmailListVerificationTemplateProps) {
  return (
    <EmailLayout
      previewText={`Confirm your ${listName} signup.`}
      title={`Confirm your ${listName} signup`}
    >
      <EmailText>Hi there,</EmailText>
      <EmailText>
        Confirm this email address to finish joining {listName}.
      </EmailText>
      <EmailButton href={verificationUrl}>Confirm signup</EmailButton>
      <EmailText>
        If the button does not work, paste this link into your browser:
        <br />
        <a href={verificationUrl}>{verificationUrl}</a>
      </EmailText>
    </EmailLayout>
  );
}
