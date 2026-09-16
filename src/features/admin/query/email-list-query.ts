import type { AdminEmailSubscriberQueryState } from "@/shared/schemas";
import { adminEmailSubscriberSearchParamsSchema } from "@/shared/schemas";
import { firstParamValue, type SearchParamValue } from "./query-params";

export const ADMIN_EMAIL_LIST_PAGE_PATH = "/admin/email-list";
export const ADMIN_EMAIL_LIST_ALL_PAGE_PATH = "/admin/email-list/all";
export const ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH =
  "/admin/email-list/submissions";

export type AdminEmailListPageSearchParams = {
  [key: string]: SearchParamValue;

  listKey?: SearchParamValue;
  q?: SearchParamValue;
  status?: SearchParamValue;
};

export type { AdminEmailSubscriberQueryState };

export function parseAdminEmailListSearchParams(
  params: AdminEmailListPageSearchParams,
): AdminEmailSubscriberQueryState {
  return adminEmailSubscriberSearchParamsSchema.parse({
    listKey: firstParamValue(params.listKey),
    query: firstParamValue(params.q),
    status: firstParamValue(params.status),
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
