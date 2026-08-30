import type { Metadata } from "next";

import { RoleInvitesPage } from "@/components/admin/role-invites-page";

export const metadata: Metadata = {
  title: "Moderator Invites | Mirage Admin",
};

export default function AdminModeratorInvitesPage() {
  return (
    <RoleInvitesPage
      emptyMessage="No moderator invites found."
      inviteRole="moderator"
      title="Moderator invites"
    />
  );
}
