import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/server/email/components/email-layout";

type WelcomeEmailTemplateProps = {
  appUrl: string;
  name?: string | null;
};

export function WelcomeEmailTemplate({
  appUrl,
  name,
}: WelcomeEmailTemplateProps) {
  return (
    <EmailLayout previewText="Welcome to Grove." title="Welcome to Grove">
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>
        Your email is verified and your Grove account is ready. You can head
        back to your workspace whenever you are ready.
      </EmailText>
      <EmailButton href={appUrl}>Open Grove</EmailButton>
    </EmailLayout>
  );
}
