import { parsePage } from "@evensurface/paginate";
import {
  firstParamValue,
  rawHrefFromSearchParams,
  type SearchParamValue,
} from "@/features/admin/query/query-params";

export const NOTIFICATIONS_PAGE_PATH = "/account/notifications";
export const NOTIFICATIONS_PAGE_SIZE = 10;

export type NotificationsPageSearchParams = {
  [key: string]: SearchParamValue;
  page?: SearchParamValue;
};

export function parseNotificationsSearchParams(
  params: NotificationsPageSearchParams,
) {
  return {
    page: parsePage(firstParamValue(params.page)),
  };
}

export function notificationsPageHref({ page = 1 }: { page?: number } = {}) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  const search = params.toString();

  return search
    ? `${NOTIFICATIONS_PAGE_PATH}?${search}`
    : NOTIFICATIONS_PAGE_PATH;
}

export function notificationsRawHrefFromSearchParams(
  params: NotificationsPageSearchParams,
) {
  return rawHrefFromSearchParams(NOTIFICATIONS_PAGE_PATH, params);
}

export function notificationsHrefFromSearchParams(
  params: NotificationsPageSearchParams,
) {
  return notificationsPageHref(parseNotificationsSearchParams(params));
}
