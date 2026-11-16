import { parsePage } from "@evensurface/paginate";
import type { AdminEmailSubscriberQueryState } from "@/shared/schemas";
import { adminEmailSubscriberSearchParamsSchema } from "@/shared/schemas";
import {
  firstParamValue,
  rawHrefFromSearchParams,
  type SearchParamValue,
} from "./query-params";

export const ADMIN_EMAIL_LIST_PAGE_PATH = "/admin/email-list";
export const ADMIN_EMAIL_LIST_ALL_PAGE_PATH = "/admin/email-list/all";
export const ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH =
  "/admin/email-list/submissions";
export const ADMIN_EMAIL_SUBMISSIONS_PAGE_SIZE = 10;

export type AdminEmailListPageSearchParams = {
  [key: string]: SearchParamValue;

  listKey?: SearchParamValue;
  page?: SearchParamValue;
  q?: SearchParamValue;
  status?: SearchParamValue;
};

export type { AdminEmailSubscriberQueryState };

export type ParsedAdminEmailListSearchParams =
  AdminEmailSubscriberQueryState & {
    page: number;
  };

export function parseAdminEmailListSearchParams(
  params: AdminEmailListPageSearchParams,
): ParsedAdminEmailListSearchParams {
  const parsed = adminEmailSubscriberSearchParamsSchema.parse({
    listKey: firstParamValue(params.listKey),
    query: firstParamValue(params.q),
    status: firstParamValue(params.status),
  });

  return {
    ...parsed,
    page: parsePage(firstParamValue(params.page)),
  };
}

export function emailListPageHref(
  state: Partial<AdminEmailSubscriberQueryState> & {
    page?: number;
  },
) {
  const params = new URLSearchParams();

  if (state.page && state.page > 1) {
    params.set("page", String(state.page));
  }

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

export function adminEmailListRawHrefFromSearchParams(
  params: AdminEmailListPageSearchParams,
) {
  return rawHrefFromSearchParams(
    ADMIN_EMAIL_LIST_SUBMISSIONS_PAGE_PATH,
    params,
  );
}

export function adminEmailListHrefFromSearchParams(
  params: AdminEmailListPageSearchParams,
) {
  const { page, ...state } = parseAdminEmailListSearchParams(params);

  return emailListPageHref({
    page,
    ...state,
  });
}
