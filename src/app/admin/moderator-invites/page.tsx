import type { Metadata } from "next";

import { RoleInvitesPage } from "@/components/admin/role-invites-page";

export const metadata: Metadata = {
  title: "Moderator Invites | Grove Admin",
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
