import type { InvitationEffectiveStatus } from "@/shared/schemas";

export const ADMIN_INVITATIONS_PAGE_PATH = "/admin/invitations";

export type AdminInvitationsPageSearchParams = {
  effectiveStatus?: InvitationEffectiveStatus | string | string[];
  page?: string | string[];
};

const effectiveStatusValues = new Set<InvitationEffectiveStatus>([
  "accepted",
  "expired",
  "pending",
  "revoked",
]);

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const parsed = Number(firstValue(value));

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseEffectiveStatus(value: string | string[] | undefined) {
  const candidate = firstValue(value);

  return candidate &&
    effectiveStatusValues.has(candidate as InvitationEffectiveStatus)
    ? (candidate as InvitationEffectiveStatus)
    : undefined;
}

export function parseAdminInvitationsSearchParams(
  params: AdminInvitationsPageSearchParams,
) {
  return {
    effectiveStatus: parseEffectiveStatus(params.effectiveStatus),
    page: parsePage(params.page),
  };
}

export function invitationsPageHref({
  effectiveStatus,
  page,
}: {
  effectiveStatus?: InvitationEffectiveStatus;
  page?: number;
}) {
  const params = new URLSearchParams();

  if (effectiveStatus) {
    params.set("effectiveStatus", effectiveStatus);
  }

  if (page && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query
    ? `${ADMIN_INVITATIONS_PAGE_PATH}?${query}`
    : ADMIN_INVITATIONS_PAGE_PATH;
}
