import {
  EmailButton,
  EmailLayout,
  EmailText,
} from "@/server/email/components/email-layout";

type RoleInviteEmailTemplateProps = {
  inviteUrl: string;
  name?: string | null;
  role: string;
};

export function RoleInviteEmailTemplate({
  inviteUrl,
  name,
  role,
}: RoleInviteEmailTemplateProps) {
  return (
    <EmailLayout
      previewText={`You have been invited to join Mirage as a ${role}.`}
      title={`Join Mirage as a ${role}`}
    >
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>
        You have been invited to join Mirage as a {role}. Accept the invite to
        create your account or sign in with this email address.
      </EmailText>
      <EmailButton href={inviteUrl}>Accept invite</EmailButton>
      <EmailText>
        If the button does not work, paste this link into your browser:
        <br />
        <a href={inviteUrl}>{inviteUrl}</a>
      </EmailText>
    </EmailLayout>
  );
}
