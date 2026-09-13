import {
  type AdminContactSubmissionPageSearchParams,
  type ContactSubmissionHrefOptions,
  type ContactSubmissionStatus,
  parseAdminContactSubmissionSearchParams,
} from "@/lib/admin/contact-submission-query";

export type {
  AdminContactSubmissionListItem,
  AdminContactSubmissionPageSearchParams,
  AdminContactSubmissionQueryState,
  ContactSubmissionFilterField,
  ContactSubmissionHrefOptions,
  ContactSubmissionSearchParamValue,
  ContactSubmissionStatus,
} from "@/lib/admin/contact-submission-query";
export { parseAdminContactSubmissionSearchParams } from "@/lib/admin/contact-submission-query";

export const ADMIN_CONTACT_SUBMISSION_PAGE_PATH =
  "/admin/contact-submission/all";

function allParamValues(value?: string | string[] | undefined) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function contactSubmissionsPageHref({
  filterField,
  filterValue,
  query,
}: ContactSubmissionHrefOptions = {}) {
  const params = new URLSearchParams();

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
  const searchParams = new URLSearchParams();

  for (const [key, paramValue] of Object.entries(params)) {
    for (const value of allParamValues(paramValue)) {
      searchParams.append(key, value);
    }
  }

  const search = searchParams.toString();

  return search
    ? `${ADMIN_CONTACT_SUBMISSION_PAGE_PATH}?${search}`
    : ADMIN_CONTACT_SUBMISSION_PAGE_PATH;
}

export function adminContactSubmissionHrefFromSearchParams(
  params: AdminContactSubmissionPageSearchParams,
) {
  return contactSubmissionsPageHref(
    parseAdminContactSubmissionSearchParams(params),
  );
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
