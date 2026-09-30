import {
  type AdminInvitationListItem,
  type InvitationRecord,
  listAdminInvitations,
} from "@/server/db/dal/invitations";
import {
  getEffectiveInvitationStatus,
  type InvitationCreateResult,
} from "@/server/db/services/invitations/service";
import { resolvePaginatedView } from "@/server/db/services/pagination";
import type {
  AdminInvitationResponse,
  InvitationEffectiveStatus,
  InvitationRole,
} from "@/shared/schemas/invitations";

function toInvitationRole(role: string): InvitationRole {
  return role
    .split(",")
    .map((value) => value.trim())
    .includes("admin")
    ? "admin"
    : "user";
}

function nullableDateToIso(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function toAdminInvitationResponse(
  invitation: AdminInvitationListItem | InvitationRecord,
  now = new Date(),
): AdminInvitationResponse {
  return {
    acceptedAt: nullableDateToIso(invitation.acceptedAt),
    acceptedByUserId: invitation.acceptedByUserId,
    createdAt: invitation.createdAt.toISOString(),
    effectiveStatus: getEffectiveInvitationStatus(invitation, now),
    email: invitation.email,
    expiresAt: invitation.expiresAt.toISOString(),
    id: invitation.id,
    invitedByUserId: invitation.invitedByUserId,
    revokedAt: nullableDateToIso(invitation.revokedAt),
    role: toInvitationRole(invitation.role),
    status: invitation.status,
    updatedAt: invitation.updatedAt.toISOString(),
  };
}

export function toAdminCreateInvitationResponse(
  result: Extract<InvitationCreateResult, { status: "success" }>,
) {
  return {
    invitation: toAdminInvitationResponse(result.invitation),
    status: true as const,
  };
}

export async function listAdminInvitationsView({
  effectiveStatus,
  limit,
  page,
}: {
  effectiveStatus?: InvitationEffectiveStatus;
  limit: number;
  page: number;
}) {
  const now = new Date();
  const result = await resolvePaginatedView({
    limit,
    page,
    loadPage: async ({ limit, offset }) => {
      const result = await listAdminInvitations({
        effectiveStatus,
        limit,
        now,
        offset,
      });

      return {
        items: result.items.map((invitation) =>
          toAdminInvitationResponse(invitation, now),
        ),
        total: result.total,
      };
    },
  });

  return {
    ...result.pagination,
    invitations: result.items,
  };
}
