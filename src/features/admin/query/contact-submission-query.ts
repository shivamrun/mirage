import { DEFAULT_PAGE_SIZE, parsePageParam } from "@/shared/pagination";
import {
  adminContactSubmissionSearchParamsSchema,
  type ContactSubmissionStatus,
} from "@/shared/schemas/contact-submission";
import {
  firstParamValue,
  rawHrefFromSearchParams,
  type SearchParamValue,
} from "./query-params";

export type { ContactSubmissionStatus };

export const ADMIN_CONTACT_SUBMISSION_PAGE_PATH =
  "/admin/contact-submission/all";
export const ADMIN_CONTACT_SUBMISSION_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type ContactSubmissionSearchParamValue = SearchParamValue;

export type AdminContactSubmissionPageSearchParams = {
  [key: string]: ContactSubmissionSearchParamValue;

  filterField?: ContactSubmissionSearchParamValue;
  filterValue?: ContactSubmissionSearchParamValue;
  page?: ContactSubmissionSearchParamValue;
  q?: ContactSubmissionSearchParamValue;
};

export type ContactSubmissionFilterField = "status";

export type AdminContactSubmissionQueryState = {
  filterField: ContactSubmissionFilterField;
  filterValue: ContactSubmissionStatus | "";
  query: string;
};

export type ParsedAdminContactSubmissionSearchParams =
  AdminContactSubmissionQueryState & {
    page: number;
  };

export type AdminContactSubmissionListItem = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: ContactSubmissionStatus;
  createdAt: Date | string;
};

export type ContactSubmissionHrefOptions = {
  filterField?: ContactSubmissionFilterField;
  filterValue?: ContactSubmissionStatus | "";
  page?: number;
  query?: string;
};

export function parseAdminContactSubmissionSearchParams(
  params: AdminContactSubmissionPageSearchParams,
): ParsedAdminContactSubmissionSearchParams {
  const parsed = adminContactSubmissionSearchParamsSchema.parse({
    filterField: firstParamValue(params.filterField),
    filterValue: firstParamValue(params.filterValue),
    q: firstParamValue(params.q),
  });

  return {
    filterField: "status",
    filterValue: parsed.filterField === "status" ? parsed.filterValue : "",
    page: parsePageParam(params.page),
    query: parsed.q,
  };
}

export function contactSubmissionsPageHref({
  filterField,
  filterValue,
  page = 1,
  query,
}: ContactSubmissionHrefOptions = {}) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (query) {
    params.set("q", query);
  }

  if (filterField && filterValue) {
    params.set("filterField", filterField);
    params.set("filterValue", filterValue);
  }

  const search = params.toString();

  return search
    ? `${ADMIN_CONTACT_SUBMISSION_PAGE_PATH}?${search}`
    : ADMIN_CONTACT_SUBMISSION_PAGE_PATH;
}

export function adminContactSubmissionRawHrefFromSearchParams(
  params: AdminContactSubmissionPageSearchParams,
) {
  return rawHrefFromSearchParams(ADMIN_CONTACT_SUBMISSION_PAGE_PATH, params);
}

export function adminContactSubmissionHrefFromSearchParams(
  params: AdminContactSubmissionPageSearchParams,
) {
  const { page, ...state } = parseAdminContactSubmissionSearchParams(params);

  return contactSubmissionsPageHref({
    page,
    ...state,
  });
}

export function adminContactSubmissionStatusHrefFromSearchParams(
  params: AdminContactSubmissionPageSearchParams,
  status: ContactSubmissionStatus,
) {
  const state = parseAdminContactSubmissionSearchParams(params);

  return contactSubmissionsPageHref({
    filterField: "status",
    filterValue: status,
    query: state.query,
  });
}
