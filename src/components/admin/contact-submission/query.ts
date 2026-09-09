export const ADMIN_CONTACT_SUBMISSION_PAGE_PATH =
  "/admin/contact-submission/all";

export type ContactSubmissionSearchParamValue = string | string[] | undefined;

export type AdminContactSubmissionPageSearchParams = {
  [key: string]: ContactSubmissionSearchParamValue;

  filterField?: ContactSubmissionSearchParamValue;
  filterValue?: ContactSubmissionSearchParamValue;
  q?: ContactSubmissionSearchParamValue;
};

export type ContactSubmissionStatus = "new" | "read" | "archived";
export type ContactSubmissionFilterField = "status";

export type AdminContactSubmissionQueryState = {
  filterField: ContactSubmissionFilterField;
  filterValue: ContactSubmissionStatus | "";
  query: string;
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
  query?: string;
};

function firstParamValue(value?: ContactSubmissionSearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function allParamValues(value?: ContactSubmissionSearchParamValue) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function parseAdminContactSubmissionSearchParams(
  params: AdminContactSubmissionPageSearchParams,
): AdminContactSubmissionQueryState {
  const filterValue = firstParamValue(params.filterValue);

  return {
    filterField: "status",
    filterValue:
      firstParamValue(params.filterField) === "status" &&
      (filterValue === "new" ||
        filterValue === "read" ||
        filterValue === "archived")
        ? filterValue
        : "",
    query: firstParamValue(params.q)?.trim() ?? "",
  };
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
