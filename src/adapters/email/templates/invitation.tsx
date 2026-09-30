import {
  EmailButton,
  EmailLayout,
  EmailRawLink,
  EmailText,
} from "@/adapters/email/components";

type InvitationTemplateProps = {
  acceptUrl: string;
  email: string;
  expiresAt: string;
};

function formatExpiration(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function InvitationTemplate({
  acceptUrl,
  email,
  expiresAt,
}: InvitationTemplateProps) {
  const formattedExpiration = formatExpiration(expiresAt);

  return (
    <EmailLayout
      previewText="You have been invited to join Mirage."
      title="Accept your Mirage invitation"
      description={`Create your Mirage account for ${email}.`}
    >
      <EmailText className="mb-0">
        Hi there, you have been invited to create a Mirage account for {email}.
      </EmailText>

      <EmailButton href={acceptUrl}>Accept invitation</EmailButton>

      <EmailText>
        This invitation expires {formattedExpiration}. Existing Mirage accounts
        cannot accept this invitation.
      </EmailText>

      <EmailText className="mb-0">
        If the button doesn&apos;t work, copy and paste this link into your
        browser:
        <br />
        <EmailRawLink href={acceptUrl} />
      </EmailText>
    </EmailLayout>
  );
}

InvitationTemplate.PreviewProps = {
  acceptUrl: "https://example.com/invite/accept?token=example-invite-token",
  email: "teammate@example.com",
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
} satisfies InvitationTemplateProps;

export { formatExpiration as formatInvitationExpiration };
export default InvitationTemplate;
