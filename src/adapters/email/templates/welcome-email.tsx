import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components/email-layout";

type WelcomeEmailTemplateProps = {
  appUrl: string;
  name?: string | null;
};

export function WelcomeEmailTemplate({
  appUrl,
  name,
}: WelcomeEmailTemplateProps) {
  return (
    <EmailLayout previewText="Welcome to Mirage." title="Welcome to Mirage">
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>
        Welcome to Mirage. Please verify your email address to keep your account
        secure.
      </EmailText>
      <EmailButton href={appUrl}>Open Mirage</EmailButton>
    </EmailLayout>
  );
}
