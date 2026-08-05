import type { Metadata } from "next";

import { RoleInvitesPage } from "@/components/admin/role-invites-page";

export const metadata: Metadata = {
  title: "Creator Invites | Grove Admin",
};

export default function AdminCreatorInvitesPage() {
  return (
    <RoleInvitesPage
      emptyMessage="No creator invites found."
      inviteRole="creator"
      title="Creator invites"
    />
  );
}
