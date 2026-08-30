import { RoleInviteEmailTemplate } from "@/server/email/templates/role-invite-email";

import { sendEmail } from "../send-email";

type SendRoleInviteEmailOptions = {
  email: string;
  inviteUrl: string;
  name?: string | null;
  role: string;
};

export function sendRoleInviteEmail({
  email,
  inviteUrl,
  name,
  role,
}: SendRoleInviteEmailOptions) {
  return sendEmail({
    react: (
      <RoleInviteEmailTemplate inviteUrl={inviteUrl} name={name} role={role} />
    ),
    subject: `You are invited to join Mirage as a ${role}`,
    tags: [
      {
        name: "category",
        value: `${role}-invite`,
      },
    ],
    text: [
      `Hi ${name || "there"},`,
      `You have been invited to join Mirage as a ${role}.`,
      `Accept invite: ${inviteUrl}`,
    ].join("\n\n"),
    to: email,
  });
}
