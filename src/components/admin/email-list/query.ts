import type { AdminEmailSubscriberQueryState } from "@/zod";
import { adminEmailSubscriberSearchParamsSchema } from "@/zod";

export const ADMIN_EMAIL_LIST_PAGE_PATH = "/admin/email-list";
export const ADMIN_EMAIL_LIST_ALL_PAGE_PATH = "/admin/email-list/all";
export const ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH =
  "/admin/email-list/submissions";

export type AdminEmailListPageSearchParams = {
  listKey?: string | string[];
  q?: string | string[];
  status?: string | string[];
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminEmailListSearchParams(
  params: AdminEmailListPageSearchParams,
): AdminEmailSubscriberQueryState {
  return adminEmailSubscriberSearchParamsSchema.parse({
    listKey: firstParam(params.listKey),
    query: firstParam(params.q),
    status: firstParam(params.status),
  });
}

export function emailListPageHref(
  state: Partial<AdminEmailSubscriberQueryState>,
) {
  const params = new URLSearchParams();

  if (state.listKey) {
    params.set("listKey", state.listKey);
  }

  if (state.status) {
    params.set("status", state.status);
  }

  if (state.query) {
    params.set("q", state.query);
  }

  const query = params.toString();

  return query
    ? `${ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH}?${query}`
    : ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH;
}
