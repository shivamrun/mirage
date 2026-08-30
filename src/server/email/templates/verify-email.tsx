import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/server/email/components/email-layout";

type VerifyEmailTemplateProps = {
  actionLabel?: string;
  heading?: string;
  intro?: string;
  name?: string | null;
  verificationUrl: string;
};

export function VerifyEmailTemplate({
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
    >
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>{intro}</EmailText>
      <EmailButton href={verificationUrl}>{actionLabel}</EmailButton>
      <EmailText>
        If the button does not work, paste this link into your browser:
        <br />
        <a href={verificationUrl}>{verificationUrl}</a>
      </EmailText>
    </EmailLayout>
  );
}
