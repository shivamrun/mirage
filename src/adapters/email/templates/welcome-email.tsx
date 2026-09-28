import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/adapters/email/components";
import { EmailRawLink } from "../components/email-raw-link";

type WelcomeEmailTemplateProps = {
  appUrl: string;
  name?: string | null;
};

function WelcomeEmailTemplate({ appUrl, name }: WelcomeEmailTemplateProps) {
  return (
    <EmailLayout
      previewText="Your Mirage account is ready."
      title={`Welcome${name ? `, ${name}` : ""}.`}
      description="Your account is ready. Head into Mirage whenever you're ready to get started."
      appUrl={appUrl}
    >
      <EmailText className="mb-0">
        Everything is set up and ready to go. Open Mirage to start using your
        workspace.
      </EmailText>

      <EmailButton href={appUrl}>Open Mirage</EmailButton>

      <EmailText>
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <EmailRawLink href={appUrl} />
      </EmailText>

      <EmailText className="mb-0">
        If you didn&apos;t create this account, you can ignore this email.
      </EmailText>
    </EmailLayout>
  );
}

WelcomeEmailTemplate.PreviewProps = {
  appUrl: "https://example.com",
  name: "Shivam",
} satisfies WelcomeEmailTemplateProps;

export default WelcomeEmailTemplate;
