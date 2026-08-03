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
        Welcome to Grove. Please verify your email address to keep your account
        secure.
      </EmailText>
      <EmailButton href={appUrl}>Open Grove</EmailButton>
    </EmailLayout>
  );
}
